type ToolColor = { r: number; g: number; b: number; a: number }
type Params = Record<string, never>
type RunMsg =
  | { type: 'action'; id: string; params: Partial<Params> }
  | { type: 'resize'; height: number }
  | { type: 'export'; format: 'json' | 'css' }

const TOOL_ID = "9c676d1a-bbdf-48b8-8f4d-682bee3d9ac7"
const DISPLAY_NAME = "Design token extractor"
const SEEN_KEY = TOOL_ID + ':seen'

const FRAME_COLOR_NAME  = '🎨 Colors'
const FRAME_FONT_NAME   = '🎨 Typography'
const FRAME_RADIUS_NAME = '🎨 Radius'

const GROUP_NEUTRAL     = 'group-neutral'
const GROUP_GRAY        = 'group-gray'
const GROUP_BLACK_ALPHA = 'group-black-alpha'
const GROUP_WHITE_ALPHA = 'group-white-alpha'
const GROUP_CHROMA      = 'group-color'
const SWATCH_ROW        = 'swatch-row'

const SW = 40, PADDING = 20, COL = 8, TEXT_H = 48, GAP = 8
const FRAME_W = PADDING * 2 + COL * SW + (COL - 1) * GAP   // 416
const INNER_W = FRAME_W - PADDING * 2                        // 376
const ALPHA_STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90]

interface SeenTokens {
  colorKeys: string[]
  textKeys: string[]
  weightKeys: string[]
  familyKeys: string[]
  roleKeys: string[]
  textStyleKeys: string[]
  radiusKeys: number[]
  hasNeutral: boolean
  hasGray: boolean
  hasBlackAlpha: boolean
  hasWhiteAlpha: boolean
  colorCount: number
  textCount: number
}

function roleToStyleName(role: string): string {
  const [cat, sz] = role.split('/')
  const C = cat.charAt(0).toUpperCase() + cat.slice(1)
  const S: Record<string, string> = { lg: 'Large', md: 'Medium', sm: 'Small', xl: 'XLarge', xs: 'XSmall' }
  return `${C}/${S[sz] ?? sz.toUpperCase()}`
}
function normalizeFamilyName(family: string): string {
  const slug = family.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '')
  return slug || `font-${Math.abs(family.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)).toString(36)}`
}
function classifyStyle(fontSize: number, fontWeight: number): string {
  if (fontSize >= 57) return 'display/lg'
  if (fontSize >= 45) return 'display/md'
  if (fontSize >= 36) return 'display/sm'
  if (fontSize >= 32) return 'headline/lg'
  if (fontSize >= 28) return 'headline/md'
  if (fontSize >= 24) return 'headline/sm'
  if (fontSize >= 22) return 'title/lg'
  if (fontSize >= 18) return 'title/md'
  if (fontSize >= 16) return fontWeight >= 600 ? 'title/sm' : 'body/lg'
  if (fontSize >= 14) return fontWeight >= 600 ? 'label/lg' : 'body/md'
  if (fontSize >= 12) return fontWeight >= 600 ? 'label/md' : 'body/sm'
  if (fontSize >= 11) return 'label/sm'
  return 'caption/xs'
}
function styleToNumericWeight(style: string): number {
  const all = style.replace(/[\s\-_]+/g, '').toLowerCase()
  if (/^\d+$/.test(all)) return parseInt(all)
  const num = all.match(/\d+/); if (num) return parseInt(num[0])
  if (all.includes('thin'))                               return 100
  if (all.includes('extralight') || all.includes('ultralight')) return 200
  if (all.includes('light'))                              return 300
  if (all.includes('medium'))                             return 500
  if (all.includes('semibold') || all.includes('demibold')) return 600
  if (all.includes('extrabold') || all.includes('ultrabold')) return 800
  if (all.includes('black') || all.includes('heavy'))     return 900
  if (all.includes('bold'))                               return 700
  return 400
}
function numericToWeightName(n: number): string {
  const m: Record<number, string> = { 100:'thin', 200:'extralight', 300:'light', 400:'regular', 500:'medium', 600:'semibold', 700:'bold', 800:'extrabold', 900:'black' }
  return m[n] ?? `w${n}`
}
function normalizeWeightName(style: string): string {
  const num = style.replace(/[\s\-_]+/g, '').toLowerCase()
  if (/^\d+$/.test(num)) return numericToWeightName(parseInt(num))
  return num.replace(/italic$/, '').replace(/oblique$/, '') || 'regular'
}

type TokenColor = { r: number; g: number; b: number; a: number }
const DEFAULTS: Params = {}
let latestParams: Params = DEFAULTS
let isExecuting = false
function normalizeParams(_input: Partial<Params> | null | undefined): Params { return {} }

function solidPaint(c: ToolColor): SolidPaint {
  return { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }
}
function uniqueSceneNodes(nodes: readonly SceneNode[]): SceneNode[] {
  return [...new Set(nodes)].filter((n) => !n.removed)
}
function attachRelaunch(nodes: readonly SceneNode[]): void {
  const unique = uniqueSceneNodes(nodes)
  if (unique.length > 0) for (const n of unique) n.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME })
  else figma.root.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME })
}

function rgbToHex(r: number, g: number, b: number): string {
  return [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}
function colorValueToString(val: VariableValue, includeAlpha: boolean): string {
  if (typeof val === 'object' && val !== null && 'r' in val) {
    const c = val as { r: number; g: number; b: number; a?: number }
    const hex = rgbToHex(c.r, c.g, c.b)
    if (includeAlpha && c.a !== undefined && c.a < 0.999) {
      const alpha = Math.round(c.a * 255).toString(16).padStart(2, '0')
      return `#${hex}${alpha}`
    }
    return `#${hex}`
  }
  return String(val)
}
async function buildExportPayload(): Promise<{
  colors: Record<string, string>
  typography: Record<string, number | string>
  radius: Record<string, number>
}> {
  const allVars = await figma.variables.getLocalVariablesAsync()
  const allCols = await figma.variables.getLocalVariableCollectionsAsync()
  const colorCol      = allCols.find(c => c.name === 'Colors')
  const typographyCol = allCols.find(c => c.name === 'Typography')
  const radiusCol     = allCols.find(c => c.name === 'Radius')
  const colors: Record<string, string> = {}
  const typography: Record<string, number | string> = {}
  const radius: Record<string, number> = {}
  for (const v of allVars) {
    const col = allCols.find(c => c.id === v.variableCollectionId)
    if (!col) continue
    const modeId = col.defaultModeId
    let val = v.valuesByMode[modeId]
    if (val && typeof val === 'object' && 'type' in val && (val as { type: string }).type === 'VARIABLE_ALIAS') {
      const aliasId = (val as { id: string }).id
      const aliasVar = allVars.find(av => av.id === aliasId)
      if (aliasVar) {
        const aliasCol = allCols.find(c => c.id === aliasVar.variableCollectionId)
        if (aliasCol) val = aliasVar.valuesByMode[aliasCol.defaultModeId]
      }
    }
    if (colorCol && v.variableCollectionId === colorCol.id) {
      colors[v.name] = colorValueToString(val, true)
    } else if (typographyCol && v.variableCollectionId === typographyCol.id) {
      typography[v.name] = typeof val === 'number' ? val : String(val)
    } else if (radiusCol && v.variableCollectionId === radiusCol.id) {
      radius[v.name] = typeof val === 'number' ? val : 0
    }
  }
  return { colors, typography, radius }
}
function tokensToJson(payload: { colors: Record<string, string>; typography: Record<string, number | string>; radius: Record<string, number> }): string {
  return JSON.stringify(payload, null, 2)
}
function tokensToCSS(payload: { colors: Record<string, string>; typography: Record<string, number | string>; radius: Record<string, number> }): string {
  const lines: string[] = [':root {']
  for (const [key, val] of Object.entries(payload.colors)) {
    lines.push(`  --${key.replace(/\//g, '-')}: ${val};`)
  }
  for (const [key, val] of Object.entries(payload.typography)) {
    const cssVal = typeof val === 'number' ? `${val}${key.includes('size') || key.includes('height') || key.includes('spacing') ? 'px' : ''}` : val
    lines.push(`  --${key.replace(/\//g, '-')}: ${cssVal};`)
  }
  for (const [key, val] of Object.entries(payload.radius)) {
    lines.push(`  --${key.replace(/\//g, '-')}: ${val}px;`)
  }
  lines.push('}')
  return lines.join('\n')
}

function setupColorFrameAL(frame: FrameNode): void {
  frame.layoutMode = 'VERTICAL'
  frame.primaryAxisSizingMode = 'AUTO'
  frame.counterAxisSizingMode = 'FIXED'
  frame.paddingTop = frame.paddingBottom = PADDING
  frame.paddingLeft = frame.paddingRight = PADDING
  frame.itemSpacing = 16
  frame.resize(FRAME_W, 100)
}
function findGroupInFrame(colorFrame: FrameNode, groupName: string): FrameNode | null {
  return colorFrame.children.find(
    (n): n is FrameNode => n.type === 'FRAME' && n.name === groupName
  ) ?? null
}
function findSwatchRowInGroup(group: FrameNode): FrameNode | null {
  return group.children.find(
    (n): n is FrameNode => n.type === 'FRAME' && n.name === SWATCH_ROW
  ) ?? null
}
function createGroup(colorFrame: FrameNode, groupName: string, title: string, subLabel?: string): FrameNode {
  const group = figma.createFrame()
  group.name = groupName; group.fills = []
  group.layoutMode = 'VERTICAL'; group.primaryAxisSizingMode = 'AUTO'
  group.counterAxisSizingMode = 'FIXED'
  group.paddingTop = group.paddingBottom = group.paddingLeft = group.paddingRight = 0
  group.itemSpacing = 8
  colorFrame.appendChild(group)
  group.layoutSizingHorizontal = 'FILL'; group.layoutSizingVertical = 'HUG'
  const titleNode = figma.createText()
  titleNode.fontName = { family: 'Inter', style: 'Bold' }; titleNode.fontSize = 13
  titleNode.characters = title
  titleNode.fills = [solidPaint({ r: 0.15, g: 0.15, b: 0.15, a: 1 })]
  group.appendChild(titleNode)
  titleNode.layoutSizingHorizontal = 'FILL'; titleNode.layoutSizingVertical = 'HUG'
  if (subLabel) {
    const sub = figma.createText()
    sub.fontName = { family: 'Inter', style: 'Regular' }; sub.fontSize = 10
    sub.characters = subLabel
    sub.fills = [solidPaint({ r: 0.55, g: 0.55, b: 0.55, a: 1 })]
    group.appendChild(sub)
    sub.layoutSizingHorizontal = 'FILL'; sub.layoutSizingVertical = 'HUG'
  }
  const row = figma.createFrame()
  row.name = SWATCH_ROW; row.fills = []
  row.layoutMode = 'HORIZONTAL'; row.layoutWrap = 'WRAP'
  row.primaryAxisSizingMode = 'FIXED'; row.counterAxisSizingMode = 'AUTO'
  row.itemSpacing = GAP;
  (row as FrameNode & { counterAxisSpacing: number }).counterAxisSpacing = GAP
  group.appendChild(row)
  row.layoutSizingHorizontal = 'FILL'; row.layoutSizingVertical = 'HUG'
  return group
}
function createSwatchCell(c: TokenColor, label: string, affectedNodes: SceneNode[], bgColor?: TokenColor): FrameNode {
  const cell = figma.createFrame()
  cell.fills = bgColor ? [solidPaint(bgColor)] : []
  cell.resize(SW, SW + 14)
  if (bgColor) cell.cornerRadius = 6
  const sq = figma.createRectangle()
  sq.resize(SW, SW); sq.cornerRadius = 6
  sq.fills = [solidPaint({ r: c.r, g: c.g, b: c.b, a: c.a })]
  sq.effects = [{ type: 'DROP_SHADOW', color: { r:0, g:0, b:0, a:0.1 }, offset: { x:0, y:1 }, radius: 3, spread: 0, visible: true, blendMode: 'NORMAL' }]
  cell.appendChild(sq); sq.x = 0; sq.y = 0
  const lbl = figma.createText()
  lbl.fontName = { family: 'Inter', style: 'Regular' }; lbl.fontSize = 7
  lbl.characters = label
  lbl.fills = [solidPaint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })]
  lbl.resize(SW, 12); lbl.textAlignHorizontal = 'CENTER'
  cell.appendChild(lbl); lbl.x = 0; lbl.y = SW + 2
  affectedNodes.push(cell)
  return cell
}
function addToGroup(colorFrame: FrameNode, groupName: string, title: string, items: { color: TokenColor; label: string }[], affectedNodes: SceneNode[], bgColor?: TokenColor, subLabel?: string): void {
  let group = findGroupInFrame(colorFrame, groupName)
  if (!group) group = createGroup(colorFrame, groupName, title, subLabel)
  const row = findSwatchRowInGroup(group)
  if (!row) return
  for (const { color, label } of items) {
    const cell = createSwatchCell(color, label, affectedNodes, bgColor)
    row.appendChild(cell)
  }
}
function reconstructColorSeen(frame: FrameNode): Pick<SeenTokens, 'colorKeys' | 'hasNeutral' | 'hasGray' | 'hasBlackAlpha' | 'hasWhiteAlpha' | 'colorCount'> {
  const colorKeys: string[] = []
  const hasNeutral    = findGroupInFrame(frame, GROUP_NEUTRAL)     !== null
  const hasGray       = findGroupInFrame(frame, GROUP_GRAY)        !== null
  const hasBlackAlpha = findGroupInFrame(frame, GROUP_BLACK_ALPHA) !== null
  const hasWhiteAlpha = findGroupInFrame(frame, GROUP_WHITE_ALPHA) !== null
  const chromaGroup = findGroupInFrame(frame, GROUP_CHROMA)
  if (chromaGroup) {
    const row = findSwatchRowInGroup(chromaGroup)
    if (row) {
      for (const cell of row.children) {
        if (cell.type !== 'FRAME') continue
        const rect = (cell as FrameNode).children.find((n): n is RectangleNode => n.type === 'RECTANGLE')
        if (rect) {
          const fills = rect.fills as readonly Paint[]
          if (fills.length > 0 && fills[0].type === 'SOLID') {
            const f = fills[0] as SolidPaint
            const sat = Math.max(f.color.r, f.color.g, f.color.b) - Math.min(f.color.r, f.color.g, f.color.b)
            if (sat >= 0.08) {
              const key = `${Math.round(f.color.r*255)},${Math.round(f.color.g*255)},${Math.round(f.color.b*255)},${Math.round((f.opacity ?? 1)*100)}`
              if (!colorKeys.includes(key)) colorKeys.push(key)
            }
          }
        }
      }
    }
  }
  return { colorKeys, hasNeutral, hasGray, hasBlackAlpha, hasWhiteAlpha, colorCount: colorKeys.length }
}
function reconstructFontSeen(frame: FrameNode): Pick<SeenTokens, 'textKeys' | 'textCount'> {
  const textKeys: string[] = []
  for (const child of frame.children) {
    if (child.type !== 'FRAME') continue
    const c = child as FrameNode
    if (Math.abs(c.height - TEXT_H) < 4 && c.width > SW * 2) {
      const metaNode = c.children.find((n): n is TextNode => n.type === 'TEXT' && (n as TextNode).fontSize === 11)
      if (metaNode) {
        const parts = metaNode.characters.split('  ')
        if (parts.length >= 3) {
          const family = parts[0].trim()
          const sizeStr = parts[1].replace('px', '').trim()
          const style = parts[2].trim()
          const fontSize = parseFloat(sizeStr)
          if (family && !isNaN(fontSize)) {
            const key = `${family}|${fontSize}|${style}`
            if (!textKeys.includes(key)) textKeys.push(key)
          }
        }
      }
    }
  }
  return { textKeys, textCount: textKeys.length }
}

function evaluateEnabled_extract(selection: readonly SceneNode[]): boolean {
  return selection.length >= 1
}
function actionTarget_extract(): SceneNode | null {
  const sel = figma.currentPage.selection
  return sel.length >= 1 ? (sel[0] ?? null) : null
}

async function action_extract(_params: Params, target: SceneNode | null, _prev: unknown | null): Promise<{ affectedNodes: SceneNode[]; state: unknown | null }> {
  const affectedNodes: SceneNode[] = target != null ? [target] : []
  const selection = figma.currentPage.selection
  await (async () => {
    const sel = selection.filter((n): n is FrameNode => n.type === 'FRAME')
    if (sel.length === 0) { figma.notify('请先选中至少一个 Frame'); return }
    const colorMap = new Map<string, TokenColor & { count: number }>()
    const textStyleMap = new Map<string, { fontSize: number; fontWeight: string; fontFamily: string; lineHeightPx: number | null; letterSpacingPx: number; count: number }>()
    const weightMap = new Map<string, { normalizedName: string; numericValue: number }>()
    const familyMap = new Map<string, string>()
    const roleMap = new Map<string, { fontSize: number; fontWeight: number; lineHeightPx: number | null; letterSpacingPx: number }>()
    const radiusMap = new Map<number, string>()
    function rgbaKey(c: { r: number; g: number; b: number }, op: number): string {
      return `${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${Math.round(op*100)}`
    }
    function collectFills(node: SceneNode): void {
      if ('fills' in node && Array.isArray(node.fills)) {
        for (const f of node.fills)
          if (f.type === 'SOLID' && f.visible !== false) {
            const k = rgbaKey(f.color, f.opacity ?? 1)
            const ex = colorMap.get(k)
            if (ex) ex.count++; else colorMap.set(k, { ...f.color, a: f.opacity ?? 1, count: 1 })
          }
      }
      if ('strokes' in node && Array.isArray(node.strokes)) {
        for (const s of node.strokes)
          if (s.type === 'SOLID' && s.visible !== false) {
            const k = rgbaKey(s.color, s.opacity ?? 1)
            const ex = colorMap.get(k)
            if (ex) ex.count++; else colorMap.set(k, { ...s.color, a: s.opacity ?? 1, count: 1 })
          }
      }
      if ('children' in node) for (const ch of node.children) collectFills(ch)
    }
    async function collectText(node: SceneNode): Promise<void> {
      if (node.type === 'TEXT') {
        const fontSize = typeof node.fontSize === 'number' ? node.fontSize : 14
        if (node.fontName === figma.mixed) { return }
        const fontName = node.fontName
        const wm = fontName.style.match(/\d+/)
        let lineHeightPx: number | null = null
        if (node.lineHeight !== figma.mixed) {
          const lh = node.lineHeight
          if (lh.unit === 'PIXELS')       lineHeightPx = Math.round(lh.value * 100) / 100
          else if (lh.unit === 'PERCENT') lineHeightPx = Math.round(fontSize * lh.value / 100 * 100) / 100
          else                            lineHeightPx = 0
        }
        let letterSpacingPx: number = 0
        if (node.letterSpacing !== figma.mixed) {
          const ls = node.letterSpacing
          if (ls.unit === 'PIXELS')       letterSpacingPx = Math.round(ls.value * 100) / 100
          else if (ls.unit === 'PERCENT') letterSpacingPx = Math.round(fontSize * ls.value / 100 * 100) / 100
        }
        const key = `${fontName.family}|${fontSize}|${fontName.style}`
        const ex = textStyleMap.get(key)
        if (ex) ex.count++
        else textStyleMap.set(key, { fontSize, fontWeight: wm ? wm[0] : fontName.style, fontFamily: fontName.family, lineHeightPx, letterSpacingPx, count: 1 })
        const wNorm = normalizeWeightName(fontName.style)
        if (!weightMap.has(wNorm)) weightMap.set(wNorm, { normalizedName: wNorm, numericValue: styleToNumericWeight(fontName.style) })
        const fNorm = normalizeFamilyName(fontName.family)
        if (!familyMap.has(fNorm)) familyMap.set(fNorm, fontName.family)
        const numWeight = styleToNumericWeight(fontName.style)
        const role = classifyStyle(fontSize, numWeight)
        if (!roleMap.has(role)) roleMap.set(role, { fontSize, fontWeight: numWeight, lineHeightPx, letterSpacingPx })
      }
      if ('children' in node) for (const ch of node.children) await collectText(ch)
    }
    const ICON_HINTS = ['icon','ico_','_ico','ic/','/ic','arrow','chevron','caret','check','close','plus','minus','search','star','heart','shape','ornament','decoration','divider','separator','dot','bullet','indicator','thumbnail']
    const UI_HINTS = ['card','modal','dialog','sheet','overlay','popup','panel','button','btn','chip','badge','tag','field','input','toast','snackbar','tooltip','drawer','container','surface','fab','tile','item','cell','header','footer','section','bar','nav','menu','list','tab','pill']
    function isRadiusCandidate(node: SceneNode): boolean {
      if (!('cornerRadius' in node)) return false
      const cr = (node as SceneNode & { cornerRadius: number | symbol }).cornerRadius
      if (typeof cr !== 'number' || cr <= 0) return false
      if (cr !== Math.round(cr)) return false
      const w = ('width'  in node) ? (node as SceneNode & { width:  number }).width  : 0
      const h = ('height' in node) ? (node as SceneNode & { height: number }).height : 0
      if (w < 32 || h < 32) return false
      const nameLower = node.name.toLowerCase()
      const isIconNamed = ICON_HINTS.some(k => nameLower.includes(k))
      const isUINamed   = UI_HINTS.some(k => nameLower.includes(k))
      if (isIconNamed && !isUINamed && w < 64 && h < 64) return false
      return true
    }
    function collectRadius(node: SceneNode): void {
      if (isRadiusCandidate(node)) {
        const cr = (node as SceneNode & { cornerRadius: number }).cornerRadius
        if (!radiusMap.has(cr)) { const name = cr >= 9999 ? 'full' : String(cr); radiusMap.set(cr, name) }
      }
      if ('children' in node) for (const ch of node.children) collectRadius(ch)
    }
    for (const frame of sel) { collectFills(frame); await collectText(frame); collectRadius(frame) }
    const allColors = [...colorMap.entries()].sort((a, b) => b[1].count - a[1].count)
    const texts = [...textStyleMap.entries()].sort((a, b) => b[1].fontSize - a[1].fontSize)
    const neutralList: { name: string; color: TokenColor }[] = []
    const chromaList: TokenColor[] = []
    let detectedBlackAlpha = false
    let detectedWhiteAlpha = false
    for (const [, c] of allColors) {
      const lum = (c.r + c.g + c.b) / 3
      const sat = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)
      const isBlack = lum < 0.08 && sat < 0.06
      const isWhite = lum > 0.92 && sat < 0.06
      if (isBlack) { if (c.a < 0.99) detectedBlackAlpha = true; else neutralList.push({ name: 'black', color: { r:0, g:0, b:0, a:1 } }) }
      else if (isWhite) { if (c.a < 0.99) detectedWhiteAlpha = true; else neutralList.push({ name: 'white', color: { r:1, g:1, b:1, a:1 } }) }
      else if (sat >= 0.08) { chromaList.push(c) }
    }
    const seenNeutralSet = new Set<string>()
    const neutralDedup = neutralList.filter(n => { if (seenNeutralSet.has(n.name)) return false; seenNeutralSet.add(n.name); return true })
    const ANDROID_GRAY: { step: number; v: number }[] = [
      { step: 50, v: 250/255 }, { step: 100, v: 245/255 }, { step: 200, v: 238/255 },
      { step: 300, v: 224/255 }, { step: 400, v: 189/255 }, { step: 500, v: 158/255 },
      { step: 600, v: 117/255 }, { step: 700, v: 97/255 }, { step: 800, v: 66/255 }, { step: 900, v: 33/255 },
    ]
    let existingColorRoot = figma.currentPage.children.find((n): n is FrameNode => n.type === 'FRAME' && n.name === FRAME_COLOR_NAME) ?? null
    const existingFontRoot = figma.currentPage.children.find((n): n is FrameNode => n.type === 'FRAME' && n.name === FRAME_FONT_NAME) ?? null
    let existingRadiusRoot = figma.currentPage.children.find((n): n is FrameNode => n.type === 'FRAME' && n.name === FRAME_RADIUS_NAME) ?? null
    const emptySeenTokens: SeenTokens = { colorKeys: [], textKeys: [], weightKeys: [], familyKeys: [], roleKeys: [], textStyleKeys: [], radiusKeys: [], hasNeutral: false, hasGray: false, hasBlackAlpha: false, hasWhiteAlpha: false, colorCount: 0, textCount: 0 }
    let seen: SeenTokens = { ...emptySeenTokens }
    const seenSource = existingColorRoot ?? existingFontRoot
    if (seenSource) {
      const raw = seenSource.getPluginData(SEEN_KEY)
      if (raw) { try { seen = JSON.parse(raw) as SeenTokens } catch { /* use defaults */ } }
      else {
        if (existingColorRoot) Object.assign(seen, reconstructColorSeen(existingColorRoot))
        if (existingFontRoot)  Object.assign(seen, reconstructFontSeen(existingFontRoot))
      }
    }
    if (existingColorRoot) {
      const hasGroups = existingColorRoot.children.some((n) => n.type === 'FRAME' && n.name.startsWith('group-'))
      if (!hasGroups) {
        for (const child of [...existingColorRoot.children]) child.remove()
        seen.hasNeutral = false; seen.hasGray = false; seen.hasBlackAlpha = false; seen.hasWhiteAlpha = false
        seen.colorKeys = []; seen.colorCount = 0
      }
    }
    const seenColorSet = new Set(seen.colorKeys)
    const seenTextSet  = new Set(seen.textKeys)
    const newNeutrals   = seen.hasNeutral    ? [] : neutralDedup
    const addGray       = !seen.hasGray
    const addBlackAlpha = detectedBlackAlpha && !seen.hasBlackAlpha
    const addWhiteAlpha = detectedWhiteAlpha && !seen.hasWhiteAlpha
    const newChroma     = chromaList.filter(c => !seenColorSet.has(rgbaKey(c, c.a)))
    const newTexts      = texts.filter(([k]) => !seenTextSet.has(k))
    const newWeights    = [...weightMap.values()].filter(w => !(seen.weightKeys ?? []).includes(w.normalizedName)).sort((a, b) => a.numericValue - b.numericValue)
    const newFamilies   = [...familyMap.entries()].filter(([norm]) => !(seen.familyKeys ?? []).includes(norm))
    const newRoles      = [...roleMap.entries()].filter(([role]) => !(seen.roleKeys ?? []).includes(role)).sort(([a], [b]) => a.localeCompare(b))
    const seenRadiusSet = new Set(seen.radiusKeys ?? [])
    const newRadii = [...radiusMap.entries()].filter(([v]) => !seenRadiusSet.has(v)).sort(([a], [b]) => a - b)
    const hasColorChanges  = newNeutrals.length > 0 || addGray || addBlackAlpha || addWhiteAlpha || newChroma.length > 0
    const hasRadiusChanges = newRadii.length > 0
    const anyExisting      = existingColorRoot !== null || existingFontRoot !== null || existingRadiusRoot !== null
    const allCols = await figma.variables.getLocalVariableCollectionsAsync()
    function getOrCreate(name: string): VariableCollection {
      return allCols.find(c => c.name === name) ?? figma.variables.createVariableCollection(name)
    }
    const colorCol      = getOrCreate('Colors')
    const typographyCol = getOrCreate('Typography')
    const radiusCol     = getOrCreate('Radius')
    const existingVars = await figma.variables.getLocalVariablesAsync()
    function upsertVar(name: string, value: VariableValue, type: VariableResolvedDataType, col: VariableCollection): Variable | null {
      if (!name || name.startsWith('/') || name.endsWith('/') || name.includes('//')) return null
      const found = existingVars.find(v => v.name === name && v.variableCollectionId === col.id)
      if (found) {
        if (found.resolvedType !== type) {
          try { found.remove(); const nv = figma.variables.createVariable(name, col, type); nv.setValueForMode(col.defaultModeId, value); return nv } catch { return null }
        }
        try { found.setValueForMode(col.defaultModeId, value) } catch { /* skip */ }
        return found
      }
      try { const v = figma.variables.createVariable(name, col, type); v.setValueForMode(col.defaultModeId, value); return v } catch { return null }
    }
    const hasMissingLineSpacing = [...roleMap.keys()].some(role =>
      !existingVars.some(v => v.name === `${role}/letter-spacing` && v.variableCollectionId === typographyCol.id) ||
      !existingVars.some(v => v.name === `${role}/line-height`    && v.variableCollectionId === typographyCol.id)
    )
    void (newTexts.length > 0 || newWeights.length > 0 || newFamilies.length > 0 || newRoles.length > 0 || hasMissingLineSpacing)
    const newTsKeys: string[] = []
    {
      for (const n of neutralDedup)
        upsertVar(`neutral/${n.name}`, { r: n.color.r, g: n.color.g, b: n.color.b, a: n.color.a }, 'COLOR', colorCol)
      for (const { step, v } of ANDROID_GRAY)
        upsertVar(`gray/${step}`, { r: v, g: v, b: v, a: 1 }, 'COLOR', colorCol)
      if (detectedBlackAlpha)
        for (const pct of ALPHA_STEPS) upsertVar(`black/alpha-${pct}`, { r: 0, g: 0, b: 0, a: pct / 100 }, 'COLOR', colorCol)
      if (detectedWhiteAlpha)
        for (const pct of ALPHA_STEPS) upsertVar(`white/alpha-${pct}`, { r: 1, g: 1, b: 1, a: pct / 100 }, 'COLOR', colorCol)
      for (const c of chromaList) {
        const hex = [c.r, c.g, c.b].map(v => Math.round(v*255).toString(16).padStart(2,'0')).join('')
        upsertVar(`color/${hex}`, { r: c.r, g: c.g, b: c.b, a: c.a }, 'COLOR', colorCol)
      }
      let textVarIdx = seen.textCount
      for (const [, t] of newTexts) { textVarIdx++; upsertVar(`font-size-${textVarIdx}`, t.fontSize, 'FLOAT', typographyCol) }
      const fontWeightVarMap = new Map<string, Variable>()
      for (const v of existingVars) {
        if (v.variableCollectionId === typographyCol.id && v.name.startsWith('font-weight/'))
          fontWeightVarMap.set(v.name.slice('font-weight/'.length), v)
      }
      for (const w of weightMap.values()) {
        const v = upsertVar(`font-weight/${w.normalizedName}`, w.numericValue, 'FLOAT', typographyCol)
        if (v) fontWeightVarMap.set(w.normalizedName, v)
      }
      for (const [norm, original] of familyMap.entries()) upsertVar(`font-family/${norm}`, original, 'STRING', typographyCol)
      for (const [role, info] of roleMap.entries()) {
        upsertVar(`${role}/font-size`, info.fontSize, 'FLOAT', typographyCol)
        const weightName = numericToWeightName(info.fontWeight)
        const fwAliasVar = fontWeightVarMap.get(weightName)
        const roleWtName = `${role}/font-weight`
        const existingRoleWt = existingVars.find(v => v.name === roleWtName && v.variableCollectionId === typographyCol.id)
        const roleWtVar = existingRoleWt ?? figma.variables.createVariable(roleWtName, typographyCol, 'FLOAT')
        roleWtVar.setValueForMode(typographyCol.defaultModeId, fwAliasVar ? { type: 'VARIABLE_ALIAS', id: fwAliasVar.id } : info.fontWeight)
      }
      for (const [role, info] of roleMap.entries()) {
        if (info.lineHeightPx !== null) {
          if (info.lineHeightPx === 0) upsertVar(`${role}/line-height`, 'auto', 'STRING', typographyCol)
          else upsertVar(`${role}/line-height`, info.lineHeightPx, 'FLOAT', typographyCol)
        }
        upsertVar(`${role}/letter-spacing`, info.letterSpacingPx, 'FLOAT', typographyCol)
      }
      for (const [value, name] of radiusMap.entries()) upsertVar(`radius/${name}`, value, 'FLOAT', radiusCol)
    }
    {
      const existingTxtStyles = await figma.getLocalTextStylesAsync()
      const tsNameMap = new Map(existingTxtStyles.map(s => [s.name, s]))
      const rwFamilies = new Map<string, Set<string>>()
      for (const [key] of textStyleMap.entries()) {
        const [fam, szStr, fStyle] = key.split('|')
        const rName = roleToStyleName(classifyStyle(parseFloat(szStr), styleToNumericWeight(fStyle)))
        const rwKey = `${rName}/${fStyle}`
        if (!rwFamilies.has(rwKey)) rwFamilies.set(rwKey, new Set())
        rwFamilies.get(rwKey)!.add(fam)
      }
      const sortedForTs = [...textStyleMap.entries()].sort((a, b) => b[1].count - a[1].count)
      const assignedRW  = new Map<string, string>()
      for (const [key, t] of sortedForTs) {
        const [fontFamily, szStr, fontStyle] = key.split('|')
        const fontSize = parseFloat(szStr)
        const rName  = roleToStyleName(classifyStyle(fontSize, styleToNumericWeight(fontStyle)))
        const rwKey  = `${rName}/${fontStyle}`
        const base   = rwKey
        const families = rwFamilies.get(rwKey) ?? new Set()
        let styleName: string
        if (families.size <= 1) { styleName = base }
        else {
          const claimed = assignedRW.get(rwKey)
          if (!claimed) { styleName = base; assignedRW.set(rwKey, fontFamily) }
          else if (claimed === fontFamily) { styleName = base }
          else { styleName = `${base} · ${fontFamily}` }
        }
        let existingTs = tsNameMap.get(styleName)
        if (!existingTs) {
          const oldName = families.size <= 1 ? rName : `${rName} · ${fontFamily}`
          const legacyTs = tsNameMap.get(oldName)
          if (legacyTs) { legacyTs.name = styleName; tsNameMap.delete(oldName); tsNameMap.set(styleName, legacyTs); existingTs = legacyTs }
        }
        const targetLh: LineHeight = (t.lineHeightPx === null || t.lineHeightPx === 0) ? { unit: 'AUTO' } : { unit: 'PIXELS', value: t.lineHeightPx }
        if (existingTs) {
          try {
            await figma.loadFontAsync({ family: fontFamily, style: fontStyle })
            existingTs.fontName = { family: fontFamily, style: fontStyle }
            existingTs.fontSize = fontSize; existingTs.lineHeight = targetLh
            existingTs.letterSpacing = { unit: 'PIXELS', value: t.letterSpacingPx }
          } catch { /* font unavailable */ }
        } else {
          try { await figma.loadFontAsync({ family: fontFamily, style: fontStyle }) } catch { continue }
          const ts = figma.createTextStyle()
          ts.name = styleName; ts.fontSize = fontSize
          ts.fontName = { family: fontFamily, style: fontStyle }
          ts.lineHeight = targetLh; ts.letterSpacing = { unit: 'PIXELS', value: t.letterSpacingPx }
          tsNameMap.set(styleName, ts)
        }
        newTsKeys.push(key)
      }
    }

    const allVarsNow = await figma.variables.getLocalVariablesAsync()
    const colorVarByKey     = new Map<string, Variable>()
    const fontSizeVarBySize = new Map<number, Variable>()
    for (const v of allVarsNow) {
      if (v.variableCollectionId === colorCol.id && v.resolvedType === 'COLOR') {
        const modeVal = v.valuesByMode[colorCol.defaultModeId]
        if (modeVal && typeof modeVal === 'object' && 'r' in modeVal) {
          const cv = modeVal as { r: number; g: number; b: number; a?: number }
          colorVarByKey.set(`${Math.round(cv.r*255)},${Math.round(cv.g*255)},${Math.round(cv.b*255)},${Math.round((cv.a??1)*100)}`, v)
        }
      }
      if (v.variableCollectionId === typographyCol.id && v.resolvedType === 'FLOAT' && v.name.startsWith('font-size-')) {
        const modeVal = v.valuesByMode[typographyCol.defaultModeId]
        if (typeof modeVal === 'number') fontSizeVarBySize.set(modeVal, v)
      }
    }
    const textStyleKeyMap = new Map<string, string>()
    const allTsNow = await figma.getLocalTextStylesAsync()
    const tsNameLookup = new Map(allTsNow.map(s => [s.name, s]))
    const rfMapRW = new Map<string, Set<string>>()
    for (const [key] of textStyleMap.entries()) {
      const [fam, szStr, fStyle] = key.split('|')
      const rName = roleToStyleName(classifyStyle(parseFloat(szStr), styleToNumericWeight(fStyle)))
      const rwKey = `${rName}/${fStyle}`
      if (!rfMapRW.has(rwKey)) rfMapRW.set(rwKey, new Set())
      rfMapRW.get(rwKey)!.add(fam)
    }
    const assignedRWLookup = new Map<string, string>()
    const sortedForLookup = [...textStyleMap.entries()].sort((a, b) => b[1].count - a[1].count)
    for (const [key] of sortedForLookup) {
      const [fam, szStr, fStyle] = key.split('|')
      const rName = roleToStyleName(classifyStyle(parseFloat(szStr), styleToNumericWeight(fStyle)))
      const rwKey = `${rName}/${fStyle}`
      const base  = rwKey
      const families = rfMapRW.get(rwKey) ?? new Set()
      let styleName: string
      if (families.size <= 1) { styleName = base }
      else {
        const claimed = assignedRWLookup.get(rwKey)
        if (!claimed) { styleName = base; assignedRWLookup.set(rwKey, fam) }
        else if (claimed === fam) { styleName = base }
        else { styleName = `${base} · ${fam}` }
      }
      const ts = tsNameLookup.get(styleName)
      if (ts) textStyleKeyMap.set(key, ts.id)
    }
    const radiusVarByValue = new Map<number, Variable>()
    for (const v of allVarsNow) {
      if (v.variableCollectionId === radiusCol.id && v.resolvedType === 'FLOAT') {
        const modeVal = v.valuesByMode[radiusCol.defaultModeId]
        if (typeof modeVal === 'number') radiusVarByValue.set(modeVal, v)
      }
    }
    async function bindNode(node: SceneNode): Promise<void> {
      if ('fills' in node && Array.isArray(node.fills)) {
        try {
          const bound = (node.fills as Paint[]).map((paint) => {
            if (paint.type !== 'SOLID') return paint
            const v = colorVarByKey.get(`${Math.round((paint.color as RGB).r*255)},${Math.round((paint.color as RGB).g*255)},${Math.round((paint.color as RGB).b*255)},${Math.round((paint.opacity??1)*100)}`)
            return v ? figma.variables.setBoundVariableForPaint(paint, 'color', v) : paint
          })
          node.fills = bound
        } catch { /* skip */ }
      }
      if ('strokes' in node && Array.isArray(node.strokes)) {
        try {
          const bound = (node.strokes as Paint[]).map((paint) => {
            if (paint.type !== 'SOLID') return paint
            const v = colorVarByKey.get(`${Math.round((paint.color as RGB).r*255)},${Math.round((paint.color as RGB).g*255)},${Math.round((paint.color as RGB).b*255)},${Math.round((paint.opacity??1)*100)}`)
            return v ? figma.variables.setBoundVariableForPaint(paint, 'color', v) : paint
          })
          node.strokes = bound as Paint[]
        } catch { /* skip */ }
      }
      if (node.type === 'TEXT' && node.fontName !== figma.mixed && typeof node.fontSize === 'number') {
        const tsKey = `${(node.fontName as FontName).family}|${node.fontSize}|${(node.fontName as FontName).style}`
        const tsId = textStyleKeyMap.get(tsKey)
        if (tsId) { try { await node.setTextStyleIdAsync(tsId) } catch { /* skip */ } }
        else {
          const v = fontSizeVarBySize.get(node.fontSize)
          if (v) { try { node.setBoundVariable('fontSize', v) } catch { /* skip */ } }
        }
      }
      if ('cornerRadius' in node && typeof node.cornerRadius === 'number' && node.cornerRadius > 0 && node.cornerRadius === Math.round(node.cornerRadius)) {
        const rv = radiusVarByValue.get(node.cornerRadius)
        if (rv) {
          try {
            node.setBoundVariable('topLeftRadius', rv); node.setBoundVariable('topRightRadius', rv)
            node.setBoundVariable('bottomLeftRadius', rv); node.setBoundVariable('bottomRightRadius', rv)
          } catch { /* skip */ }
        }
      }
      if ('children' in node) for (const ch of node.children) await bindNode(ch)
    }
    for (const frame of sel) await bindNode(frame)
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
    await figma.loadFontAsync({ family: 'Inter', style: 'Bold' })
    if (hasColorChanges) {
      const isNew = existingColorRoot === null
      const colorRoot: FrameNode = existingColorRoot ?? figma.createFrame()
      colorRoot.name = FRAME_COLOR_NAME
      colorRoot.fills = [solidPaint({ r: 0.97, g: 0.97, b: 0.98, a: 1 })]
      colorRoot.cornerRadius = 12
      if (colorRoot.layoutMode !== 'VERTICAL') setupColorFrameAL(colorRoot)
      if (newNeutrals.length > 0) addToGroup(colorRoot, GROUP_NEUTRAL, 'Neutral', newNeutrals.map(n => ({ color: n.color, label: n.name })), affectedNodes)
      addToGroup(colorRoot, GROUP_GRAY, 'Gray — Android scale', ANDROID_GRAY.map(({ step, v }) => ({ color: { r:v, g:v, b:v, a:1 }, label: String(step) })), affectedNodes, undefined, '完整安卓灰阶色板，覆盖设计中提取的灰色')
      if (addBlackAlpha) addToGroup(colorRoot, GROUP_BLACK_ALPHA, 'Black alpha', ALPHA_STEPS.map(pct => ({ color: { r:0, g:0, b:0, a: pct/100 }, label: `${pct}%` })), affectedNodes, { r:1, g:1, b:1, a:1 }, '纯黑透明梯度，从 10% 到 90%')
      if (addWhiteAlpha) addToGroup(colorRoot, GROUP_WHITE_ALPHA, 'White alpha', ALPHA_STEPS.map(pct => ({ color: { r:1, g:1, b:1, a: pct/100 }, label: `${pct}%` })), affectedNodes, { r:0.2, g:0.2, b:0.2, a:1 }, '纯白透明梯度，从 10% 到 90%')
      if (newChroma.length > 0) addToGroup(colorRoot, GROUP_CHROMA, 'Color', newChroma.map(c => { const hex = [c.r, c.g, c.b].map(v => Math.round(v*255).toString(16).padStart(2,'0')).join('').toUpperCase(); return { color: c, label: `#${hex}` } }), affectedNodes)
      if (isNew) {
        if (existingFontRoot) { colorRoot.x = (existingFontRoot as FrameNode & { x: number; y: number }).x - FRAME_W - 40; colorRoot.y = (existingFontRoot as FrameNode & { x: number; y: number }).y }
        else { colorRoot.x = figma.viewport.center.x - FRAME_W - 20; colorRoot.y = figma.viewport.center.y - colorRoot.height / 2 }
      }
      affectedNodes.push(colorRoot); existingColorRoot = colorRoot
    }
    if (hasRadiusChanges || radiusMap.size > 0) {
      const isNewR = existingRadiusRoot === null
      const radiusRoot: FrameNode = existingRadiusRoot ?? figma.createFrame()
      radiusRoot.name = FRAME_RADIUS_NAME
      radiusRoot.fills = [solidPaint({ r: 0.97, g: 0.97, b: 0.98, a: 1 })]
      radiusRoot.cornerRadius = 12
      if (radiusRoot.layoutMode !== 'VERTICAL') {
        radiusRoot.layoutMode = 'VERTICAL'; radiusRoot.counterAxisSizingMode = 'FIXED'
        radiusRoot.paddingTop = radiusRoot.paddingBottom = PADDING
        radiusRoot.paddingLeft = radiusRoot.paddingRight = PADDING
        radiusRoot.itemSpacing = 16; radiusRoot.resize(FRAME_W, 100); radiusRoot.primaryAxisSizingMode = 'AUTO'
      }
      if (newRadii.length > 0) {
        const title = figma.createText()
        title.fontName = { family: 'Inter', style: 'Bold' }; title.fontSize = 13
        title.characters = `Corner Radius +${newRadii.length}`
        title.fills = [solidPaint({ r: 0.15, g: 0.15, b: 0.15, a: 1 })]
        radiusRoot.appendChild(title); title.layoutSizingHorizontal = 'FILL'; title.layoutSizingVertical = 'HUG'
        const swatchRow = figma.createFrame()
        swatchRow.name = 'radius-swatch-row'; swatchRow.fills = []
        swatchRow.layoutMode = 'HORIZONTAL'; swatchRow.layoutWrap = 'WRAP'
        swatchRow.primaryAxisSizingMode = 'FIXED'; swatchRow.counterAxisSizingMode = 'AUTO'
        swatchRow.itemSpacing = GAP;
        (swatchRow as FrameNode & { counterAxisSpacing: number }).counterAxisSpacing = GAP
        radiusRoot.appendChild(swatchRow); swatchRow.layoutSizingHorizontal = 'FILL'; swatchRow.layoutSizingVertical = 'HUG'
        const RSW = 56
        for (const [value, name] of newRadii) {
          const cell = figma.createFrame(); cell.fills = []; cell.resize(RSW, RSW + 16); swatchRow.appendChild(cell)
          const sq = figma.createRectangle(); sq.resize(RSW, RSW); sq.cornerRadius = Math.min(value, RSW / 2)
          sq.fills = [solidPaint({ r: 0.42, g: 0.35, b: 0.85, a: 1 })]
          sq.effects = [{ type: 'DROP_SHADOW', color: { r:0, g:0, b:0, a:0.1 }, offset: { x:0, y:2 }, radius: 4, spread: 0, visible: true, blendMode: 'NORMAL' }]
          cell.appendChild(sq); sq.x = 0; sq.y = 0
          const lbl = figma.createText(); lbl.fontName = { family: 'Inter', style: 'Regular' }; lbl.fontSize = 8
          lbl.characters = name === 'full' ? 'full' : `${value}px`
          lbl.fills = [solidPaint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })]
          lbl.resize(RSW, 14); lbl.textAlignHorizontal = 'CENTER'; cell.appendChild(lbl); lbl.x = 0; lbl.y = RSW + 2
          affectedNodes.push(cell)
        }
      }
      if (isNewR) {
        const sibling = (existingColorRoot ?? existingFontRoot) as (FrameNode & { x: number; y: number }) | null
        if (sibling) { radiusRoot.x = sibling.x + FRAME_W + 40; radiusRoot.y = sibling.y + (existingColorRoot ? (existingColorRoot as FrameNode & { height: number }).height + 40 : 0) }
        else { radiusRoot.x = figma.viewport.center.x + 20; radiusRoot.y = figma.viewport.center.y }
      }
      affectedNodes.push(radiusRoot); existingRadiusRoot = radiusRoot
    }
    if (textStyleMap.size > 0) {
      const isNewFontRoot = existingFontRoot === null
      const fontRoot: FrameNode = existingFontRoot ?? figma.createFrame()
      fontRoot.name = FRAME_FONT_NAME; fontRoot.fills = [solidPaint({ r: 0.97, g: 0.97, b: 0.98, a: 1 })]
      fontRoot.cornerRadius = 12; fontRoot.layoutMode = 'VERTICAL'; fontRoot.counterAxisSizingMode = 'FIXED'
      fontRoot.paddingTop = fontRoot.paddingBottom = PADDING; fontRoot.paddingLeft = fontRoot.paddingRight = PADDING
      fontRoot.itemSpacing = 8; fontRoot.resize(FRAME_W, fontRoot.height || 100); fontRoot.primaryAxisSizingMode = 'AUTO'
      for (const child of [...fontRoot.children]) child.remove()
      await figma.loadFontAsync({ family: 'Inter', style: 'Bold' }); await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
      const seenTsSet = new Set(seen.textStyleKeys ?? [])
      const sortedStyleEntries = [...textStyleMap.entries()].sort((a, b) => {
        const sizeA = a[1].fontSize, sizeB = b[1].fontSize
        if (Math.abs(sizeA - sizeB) > 0.01) return sizeB - sizeA
        return styleToNumericWeight(b[1].fontWeight) - styleToNumericWeight(a[1].fontWeight)
      })
      for (const [key, t] of sortedStyleEntries) {
        const isNew = !seenTsSet.has(key)
        const [fontFamily, , fontStyleStr] = key.split('|')
        const row = figma.createFrame()
        row.name = 'style-row'; row.fills = [solidPaint({ r:1, g:1, b:1, a:1 })]
        row.cornerRadius = 8; row.layoutMode = 'HORIZONTAL'; row.primaryAxisSizingMode = 'AUTO'
        row.counterAxisSizingMode = 'FIXED'; row.counterAxisAlignItems = 'CENTER'
        row.paddingTop = row.paddingBottom = 10; row.paddingLeft = row.paddingRight = 14; row.itemSpacing = 12
        row.resize(INNER_W, 50)
        row.effects = [{ type: 'DROP_SHADOW', color: { r:0, g:0, b:0, a:0.05 }, offset: { x:0, y:1 }, radius: 3, spread: 0, visible: true, blendMode: 'NORMAL' }]
        fontRoot.appendChild(row); row.layoutSizingHorizontal = 'FILL'; row.layoutSizingVertical = 'HUG'
        const prev = figma.createText()
        const tsId = textStyleKeyMap.get(key)
        let previewFontLoaded = false
        if (tsId) { try { await prev.setTextStyleIdAsync(tsId); previewFontLoaded = true } catch { /* fall through */ } }
        if (!previewFontLoaded) {
          try { await figma.loadFontAsync({ family: fontFamily, style: fontStyleStr }); prev.fontName = { family: fontFamily, style: fontStyleStr } }
          catch { prev.fontName = { family: 'Inter', style: 'Regular' } }
        }
        if (typeof prev.fontSize === 'number' && prev.fontSize > 28) prev.fontSize = 28
        prev.characters = 'Ag'; prev.fills = [solidPaint({ r:0.1, g:0.1, b:0.1, a:1 })]
        row.appendChild(prev); prev.layoutSizingHorizontal = 'FIXED'; prev.resize(44, prev.height || 24); prev.layoutSizingVertical = 'HUG'
        const meta = figma.createText()
        meta.fontName = { family: 'Inter', style: 'Regular' }; meta.fontSize = 11
        meta.characters = `${fontFamily}  ${t.fontSize}px  ${fontStyleStr}`
        meta.fills = [solidPaint({ r:0.5, g:0.5, b:0.5, a:1 })]
        row.appendChild(meta); meta.layoutSizingHorizontal = 'FILL'; meta.layoutSizingVertical = 'HUG'
        if (isNew) {
          const badge = figma.createFrame()
          badge.name = 'badge-new'; badge.fills = [solidPaint({ r: 0.13, g: 0.73, b: 0.46, a: 1 })]
          badge.cornerRadius = 10; badge.layoutMode = 'HORIZONTAL'; badge.primaryAxisSizingMode = 'AUTO'; badge.counterAxisSizingMode = 'AUTO'
          badge.paddingTop = badge.paddingBottom = 3; badge.paddingLeft = badge.paddingRight = 7
          row.appendChild(badge); badge.layoutSizingHorizontal = 'HUG'; badge.layoutSizingVertical = 'HUG'
          const badgeLbl = figma.createText()
          badgeLbl.fontName = { family: 'Inter', style: 'Bold' }; badgeLbl.fontSize = 9
          badgeLbl.characters = 'New'; badgeLbl.fills = [solidPaint({ r:1, g:1, b:1, a:1 })]
          badge.appendChild(badgeLbl)
        }
        affectedNodes.push(row)
      }
      if (isNewFontRoot) {
        const cs = existingColorRoot as (FrameNode & { x: number; y: number }) | null
        if (cs) { fontRoot.x = cs.x + FRAME_W + 40; fontRoot.y = cs.y }
        else { fontRoot.x = figma.viewport.center.x + 20; fontRoot.y = figma.viewport.center.y - fontRoot.height / 2 }
      }
      affectedNodes.push(fontRoot)
    }
    const updatedSeen: SeenTokens = {
      colorKeys:     [...new Set([...seen.colorKeys, ...newChroma.map(c => `${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${Math.round(c.a*100)}`)])],
      textKeys:      [...new Set([...seen.textKeys,  ...newTexts.map(([k]) => k)])],
      weightKeys:    [...weightMap.keys()],
      familyKeys:    [...familyMap.keys()],
      roleKeys:      [...roleMap.keys()],
      textStyleKeys: [...new Set([...(seen.textStyleKeys ?? []), ...newTsKeys])],
      radiusKeys:    [...new Set([...(seen.radiusKeys ?? []), ...newRadii.map(([v]) => v)])],
      hasNeutral:    seen.hasNeutral    || newNeutrals.length > 0,
      hasGray:       seen.hasGray       || addGray,
      hasBlackAlpha: seen.hasBlackAlpha || addBlackAlpha,
      hasWhiteAlpha: seen.hasWhiteAlpha || addWhiteAlpha,
      colorCount:    seen.colorCount,
      textCount:     seen.textCount + newTexts.length,
    }
    const dataTarget = figma.currentPage.children.find(
      (n): n is FrameNode => n.type === 'FRAME' && [FRAME_COLOR_NAME, FRAME_FONT_NAME, FRAME_RADIUS_NAME].includes(n.name)
    ) ?? null
    if (dataTarget) dataTarget.setPluginData(SEEN_KEY, JSON.stringify(updatedSeen))
    const parts: string[] = []
    if (newNeutrals.length > 0) parts.push(`neutral ${newNeutrals.length}`)
    if (addGray)        parts.push('gray 10 steps')
    if (addBlackAlpha)  parts.push('black alpha')
    if (addWhiteAlpha)  parts.push('white alpha')
    if (newChroma.length > 0)  parts.push(`color +${newChroma.length}`)
    if (newTexts.length > 0)   parts.push(`typography +${newTexts.length}`)
    if (newWeights.length  > 0) parts.push(`weights +${newWeights.length}`)
    if (newFamilies.length > 0) parts.push(`families +${newFamilies.length}`)
    if (newRoles.length    > 0) parts.push(`roles +${newRoles.length}`)
    if (newRadii.length    > 0) parts.push(`radius +${newRadii.length}`)
    figma.notify(`✅ ${anyExisting ? '更新' : '创建'} · 已引用 — ${parts.join(' · ')}`)
  })()
  return { affectedNodes, state: null }
}

async function runAction_extract(target: SceneNode | null, notify: boolean): Promise<void> {
  isExecuting = true
  try {
    const result = await action_extract(latestParams, target, null)
    attachRelaunch(result.affectedNodes)
    pushActionStates()
    if (notify) {
      const created = result.affectedNodes.filter((n) => n !== target)
      if (created.length > 0) { if (target == null) figma.currentPage.selection = created; figma.viewport.scrollAndZoomIntoView(created) }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    figma.notify(message, { error: true }); throw error
  } finally { isExecuting = false }
}

async function runAction_export(format: 'json' | 'css'): Promise<void> {
  try {
    const payload = await buildExportPayload()
    const totalVars = Object.keys(payload.colors).length + Object.keys(payload.typography).length + Object.keys(payload.radius).length
    if (totalVars === 0) { figma.notify('暂无 token，请先运行「提取并整理」', { error: true }); return }
    const content = format === 'css' ? tokensToCSS(payload) : tokensToJson(payload)
    figma.ui.postMessage({ type: 'download', format, content })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    figma.notify(message, { error: true })
  }
}

function pushActionStates(): void {
  const enabled = evaluateEnabled_extract(figma.currentPage.selection)
  figma.ui.postMessage({ type: 'action-state', actions: { extract: { enabled, label: '提取并整理', status: undefined } } })
}
function refreshSelection(): void { if (isExecuting) return; pushActionStates() }

const initialParams: Params = DEFAULTS
latestParams = initialParams
const html = __html__

figma.root.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME })
figma.showUI(html, { width: 280, height: 320 })
pushActionStates()
figma.on('selectionchange', refreshSelection)

figma.ui.onmessage = (msg: RunMsg) => {
  if (msg.type === 'resize') { figma.ui.resize(280, Math.max(120, Math.min(900, Math.round(msg.height)))); return }
  if (msg.type === 'action' && msg.id === 'extract') { const target = actionTarget_extract(); latestParams = normalizeParams(msg.params); void runAction_extract(target, true) }
  if (msg.type === 'export') { void runAction_export(msg.format) }
}
