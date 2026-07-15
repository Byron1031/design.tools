import { isCompleteOutcome, sameOrderedIds, typographyStyleVariant, visibleGradientIndex, type ApplyCandidateOutcome } from './safety'

type TokenGroup = 'colors' | 'typography' | 'radius'
type TokenStatus = 'match' | 'new' | 'conflict' | 'invalid' | 'skip' | 'applied'
type ExportFormat = 'json' | 'css'
type TokenColor = { r: number; g: number; b: number; a: number }
type RadiusBindableField = 'topLeftRadius' | 'topRightRadius' | 'bottomLeftRadius' | 'bottomRightRadius'
type BindingRef =
  | { group: 'colors'; nodeId: string; property: 'fills' | 'strokes'; paintIndex: number; key: string }
  | { group: 'typography'; nodeId: string; key: string }
  | { group: 'radius'; nodeId: string; key: string; properties: RadiusBindableField[] }

type BaseCandidate = {
  id: string
  group: TokenGroup
  status: TokenStatus
  suggestedName: string
  targetName: string
  nameOverride?: string
  reason?: string
  selected?: boolean
  refs: BindingRef[]
}
type SolidColorCandidate = BaseCandidate & {
  group: 'colors'
  kind: 'solid'
  value: TokenColor
  valueKey: string
  hex: string
}
type GradientColorCandidate = BaseCandidate & {
  group: 'colors'
  kind: 'gradient'
  paints: Paint[]
  valueKey: string
  hex: string
  gradientType: string
  stopCount: number
  preview: string
}
type ColorCandidate = SolidColorCandidate | GradientColorCandidate
type TypographyCandidate = BaseCandidate & {
  group: 'typography'
  fontFamily: string
  fontStyle: string
  fontSize: number
  fontWeight: number
  lineHeightPx: number | null
  letterSpacingPx: number
  valueKey: string
  matchedStyleId?: string
  matchedStyleRemote?: boolean
}
type RadiusCandidate = BaseCandidate & {
  group: 'radius'
  value: number
  valueKey: string
}
type TokenCandidate = ColorCandidate | TypographyCandidate | RadiusCandidate

type GroupSummary = Record<TokenStatus, number>
type AuditSummary = {
  localCollections: number
  localVariables: number
  localColorVariables: number
  localPaintStyles: number
  localTypographyVariables: number
  localTextStyles: number
  localComponents: number
  remoteComponents: number
  remoteStyles: number
  remotePaintStyles: number
  remoteCollections: number
  remoteVariables: number
  remoteColorVariables: number
  remoteTypographyVariables: number
  remoteAvailableColorVariables: number
  remoteAvailableTypographyVariables: number
  remoteBoundColorVariables: number
  remoteBoundTypographyVariables: number
  remoteLibraryNames: string[]
  hasLocalLibrary: boolean
  hasRemoteLibrary: boolean
  colorCollectionName: string
  typographyCollectionName: string
  radiusCollectionName: string
}
type LibraryAudit = {
  summary: AuditSummary
  localCollections: VariableCollection[]
  localVariables: Variable[]
  localPaintStyles: PaintStyle[]
  localTextStyles: TextStyle[]
  typographyStylesBySignature: Map<string, TypographyStyleRecord>
  typographyTemplates: TypographyNameTemplate[]
  typographyTemplatesByFamilySize: Map<string, TypographyNameTemplate[]>
  typographyUsesMultiLayerNames: boolean
  remoteVariables: Array<{ name: string; resolvedType: VariableResolvedDataType; collectionName: string }>
  remoteStyleNames: string[]
  localComponentNames: string[]
  remoteComponentNames: string[]
  namesByGroup: Record<TokenGroup, Set<string>>
  valueNamesByGroup: Record<TokenGroup, Map<string, string>>
  colorVariableIdsByValue: Map<string, string>
  paintStyleNamesByKey: Map<string, string>
  paintStyleIdsByKey: Map<string, string>
  colorPrefix: string
  radiusPrefix: string
}
type TypographyStyleRecord = {
  id: string
  name: string
  fontFamily: string
  fontStyle: string
  fontSize: number
  fontWeight: number
  lineHeightPx: number | null
  letterSpacingPx: number
  signature: string
  remote: boolean
}
type TypographyNameTemplate = {
  name: string
  segments: string[]
  prefixSegments: string[]
  roleSegments: string[]
  weightIndex: number | null
  fontFamily: string
  fontSize: number
  fontWeight: number
  roleFamily: string
  remote: boolean
  multiLayer: boolean
}
type BoundVariableRef = {
  id: string
  consumer: SceneNode
}
type Proposal = {
  audit: AuditSummary
  selectionIds: string[]
  groups: Record<TokenGroup, TokenCandidate[]>
  summaries: Record<TokenGroup, GroupSummary>
}
type ActiveAction = 'audit' | 'preview' | 'export' | `apply-${TokenGroup}` | null

type UiMsg =
  | { type: 'resize'; height: number }
  | { type: 'audit' }
  | { type: 'extract-preview' }
  | { type: 'rename-token'; group: TokenGroup; id: string; targetName: string }
  | { type: 'toggle-token-selection'; group: TokenGroup; id: string; selected: boolean }
  | { type: 'apply-group'; group: TokenGroup }
  | { type: 'export'; format: ExportFormat }

const TOOL_ID = '9c676d1a-bbdf-48b8-8f4d-682bee3d9ac7'
const DISPLAY_NAME = 'Distill'
const COLOR_COLLECTION = 'Colors'
const TYPOGRAPHY_COLLECTION = 'Typography'
const RADIUS_COLLECTION = 'Radius'

let isExecuting = false
let activeAction: ActiveAction = null
let currentAudit: LibraryAudit | null = null
let currentProposal: Proposal | null = null

function emptySummary(): GroupSummary {
  return { match: 0, new: 0, conflict: 0, invalid: 0, skip: 0, applied: 0 }
}
function summarize(candidates: TokenCandidate[]): GroupSummary {
  const summary = emptySummary()
  for (const c of candidates) summary[c.status]++
  return summary
}
function summarizeProposal(groups: Record<TokenGroup, TokenCandidate[]>): Record<TokenGroup, GroupSummary> {
  return {
    colors: summarize(groups.colors),
    typography: summarize(groups.typography),
    radius: summarize(groups.radius),
  }
}
function normalizeName(name: string): string {
  return name.trim().replace(/\s*\/\s*/g, '/').replace(/\s+/g, '-')
}
function currentSelection(): SceneNode[] {
  return figma.currentPage.selection.filter((node): node is SceneNode => 'type' in node)
}
function selectionIds(nodes: readonly SceneNode[] = currentSelection()): string[] {
  return nodes.map(node => node.id)
}
function proposalSelectionIsCurrent(proposal: Proposal): boolean {
  return sameOrderedIds(proposal.selectionIds, selectionIds())
}
function round2(value: number): number {
  return Math.round(value * 100) / 100
}
function cleanKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}
function isInvalidTokenName(name: string): string | null {
  const n = name.trim()
  if (!n) return '名称不能为空'
  if (n.startsWith('/') || n.endsWith('/')) return '名称不能以 / 开头或结尾'
  if (n.includes('//')) return '名称不能包含连续 //'
  return null
}
function rgbToHex(r: number, g: number, b: number): string {
  return [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}
function isOpaqueGray(c: TokenColor): boolean {
  if (c.a < 0.999) return false
  const r = Math.round(c.r * 255)
  const g = Math.round(c.g * 255)
  const b = Math.round(c.b * 255)
  return r === g && g === b
}
function hsbBrightnessPercent(c: TokenColor): number {
  return Math.round(Math.max(c.r, c.g, c.b) * 100)
}
function colorKey(c: TokenColor): string {
  return `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${Math.round(c.a * 100)}`
}
function hexColor(c: TokenColor): string {
  const hex = rgbToHex(c.r, c.g, c.b)
  if (c.a < 0.999) return `#${hex}${Math.round(c.a * 255).toString(16).padStart(2, '0')}`
  return `#${hex}`
}
function colorStopToHex(stop: ColorStop): string {
  return hexColor({ r: stop.color.r, g: stop.color.g, b: stop.color.b, a: stop.color.a })
}
function alphaPercent(c: TokenColor): number {
  return Math.round(c.a * 100)
}
function isGradientPaint(paint: Paint): paint is GradientPaint {
  return paint.type === 'GRADIENT_LINEAR' || paint.type === 'GRADIENT_RADIAL' || paint.type === 'GRADIENT_ANGULAR' || paint.type === 'GRADIENT_DIAMOND'
}
function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}
function stableHash(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36).slice(0, 6)
}
function gradientLabel(type: GradientPaint['type']): string {
  if (type === 'GRADIENT_RADIAL') return 'radial'
  if (type === 'GRADIENT_ANGULAR') return 'angular'
  if (type === 'GRADIENT_DIAMOND') return 'diamond'
  return 'linear'
}
function clonePaints(paints: readonly Paint[]): Paint[] {
  return paints.map(paint => JSON.parse(JSON.stringify(paint)) as Paint)
}
function paintKey(paint: Paint): string {
  if (paint.type === 'SOLID') {
    return JSON.stringify({
      type: paint.type,
      color: {
        r: Math.round(paint.color.r * 255),
        g: Math.round(paint.color.g * 255),
        b: Math.round(paint.color.b * 255),
      },
      opacity: round4(paint.opacity ?? 1),
      blendMode: paint.blendMode ?? 'NORMAL',
      visible: paint.visible !== false,
    })
  }
  if (isGradientPaint(paint)) {
    return JSON.stringify({
      type: paint.type,
      opacity: round4(paint.opacity ?? 1),
      blendMode: paint.blendMode ?? 'NORMAL',
      visible: paint.visible !== false,
      transform: paint.gradientTransform.map(row => row.map(round4)),
      stops: paint.gradientStops.map(stop => ({
        position: round4(stop.position),
        color: {
          r: Math.round(stop.color.r * 255),
          g: Math.round(stop.color.g * 255),
          b: Math.round(stop.color.b * 255),
          a: Math.round(stop.color.a * 100),
        },
      })),
    })
  }
  return JSON.stringify(paint)
}
function paintListKey(paints: readonly Paint[]): string {
  return paints.map(paintKey).join('|')
}
function gradientPreview(paint: GradientPaint): string {
  const stops = paint.gradientStops.map(stop => `${colorStopToHex(stop)} ${Math.round(stop.position * 100)}%`).join(', ')
  return `linear-gradient(90deg, ${stops})`
}
function valuesEqual(a: VariableValue, b: VariableValue): boolean {
  if (typeof a !== typeof b) return false
  if (typeof a === 'number' || typeof a === 'string' || typeof a === 'boolean') return a === b
  if (a && b && typeof a === 'object' && typeof b === 'object' && 'r' in a && 'r' in b) {
    const ca = a as { r: number; g: number; b: number; a?: number }
    const cb = b as { r: number; g: number; b: number; a?: number }
    return colorKey({ r: ca.r, g: ca.g, b: ca.b, a: ca.a ?? 1 }) === colorKey({ r: cb.r, g: cb.g, b: cb.b, a: cb.a ?? 1 })
  }
  return JSON.stringify(a) === JSON.stringify(b)
}
function resolveVariableValue(
  value: VariableValue,
  variables: readonly Variable[],
  collections: readonly VariableCollection[],
  visited = new Set<string>()
): VariableValue {
  let current = value
  while (current && typeof current === 'object' && 'type' in current && (current as { type: string }).type === 'VARIABLE_ALIAS') {
    const aliasId = (current as { id: string }).id
    if (visited.has(aliasId)) return current
    visited.add(aliasId)
    const aliasVar = variables.find(v => v.id === aliasId)
    if (!aliasVar) return current
    const aliasCol = collections.find(c => c.id === aliasVar.variableCollectionId)
    if (!aliasCol) return current
    current = aliasVar.valuesByMode[aliasCol.defaultModeId]
  }
  return current
}
function colorValueToString(val: VariableValue, includeAlpha: boolean): string {
  if (typeof val === 'object' && val !== null && 'r' in val) {
    const c = val as { r: number; g: number; b: number; a?: number }
    const hex = rgbToHex(c.r, c.g, c.b)
    if (includeAlpha && c.a !== undefined && c.a < 0.999) {
      return `#${hex}${Math.round(c.a * 255).toString(16).padStart(2, '0')}`
    }
    return `#${hex}`
  }
  return String(val)
}
function classifyStyle(fontSize: number, fontWeight: number): string {
  if (fontSize >= 34) return 'largeTitle'
  if (fontSize >= 28) return 'title1'
  if (fontSize >= 22) return 'title2'
  if (fontSize >= 20) return 'title3'
  if (fontSize >= 17) return fontWeight >= 600 ? 'headline' : 'body'
  if (fontSize >= 16) return 'callout'
  if (fontSize >= 15) return 'subheadline'
  if (fontSize >= 13) return 'footnote'
  if (fontSize >= 12) return 'caption1'
  return 'caption2'
}
function roleToStyleName(role: string): string {
  const iosNames: Record<string, string> = {
    largeTitle: 'LargeTitle',
    title1: 'Title1',
    title2: 'Title2',
    title3: 'Title3',
    headline: 'Headline',
    body: 'Body',
    callout: 'Callout',
    subheadline: 'Subheadline',
    footnote: 'Footnote',
    caption1: 'Caption1',
    caption2: 'Caption2',
  }
  if (iosNames[role]) return iosNames[role]
  const [cat, sz] = role.split('/')
  const C = cat.charAt(0).toUpperCase() + cat.slice(1)
  const S: Record<string, string> = { lg: 'Large', md: 'Medium', sm: 'Small', xl: 'XLarge', xs: 'XSmall' }
  return `${C}/${S[sz] ?? sz.toUpperCase()}`
}
function roleFamily(name: string): string {
  const n = cleanKey(name).replace(/[\s/_-]+/g, '')
  if (n.includes('largetitle')) return 'largetitle'
  if (n.includes('subheadline')) return 'subheadline'
  if (n.includes('headline')) return 'headline'
  if (n.includes('title')) return 'title'
  if (n.includes('body')) return 'body'
  if (n.includes('callout')) return 'callout'
  if (n.includes('footnote')) return 'footnote'
  if (n.includes('caption')) return 'caption'
  return n
}
function styleToNumericWeight(style: string): number {
  const all = style.replace(/[\s\-_]+/g, '').toLowerCase()
  if (/^\d+$/.test(all)) return parseInt(all)
  const num = all.match(/\d+/)
  if (num) return parseInt(num[0])
  if (all.includes('thin')) return 100
  if (all.includes('extralight') || all.includes('ultralight')) return 200
  if (all.includes('light')) return 300
  if (all.includes('medium')) return 500
  if (all.includes('semibold') || all.includes('demibold')) return 600
  if (all.includes('extrabold') || all.includes('ultrabold')) return 800
  if (all.includes('black') || all.includes('heavy')) return 900
  if (all.includes('bold')) return 700
  return 400
}
function numericToWeightName(n: number): string {
  const m: Record<number, string> = { 100: 'thin', 200: 'extralight', 300: 'light', 400: 'regular', 500: 'medium', 600: 'semibold', 700: 'bold', 800: 'extrabold', 900: 'black' }
  return m[n] ?? `w${n}`
}
function normalizeWeightName(style: string): string {
  const num = style.replace(/[\s\-_]+/g, '').toLowerCase()
  if (/^\d+$/.test(num)) return numericToWeightName(parseInt(num))
  return num.replace(/italic$/, '').replace(/oblique$/, '') || 'regular'
}
function weightLabel(fontStyle: string): string {
  const weight = numericToWeightName(styleToNumericWeight(fontStyle))
  const base = weight.charAt(0).toUpperCase() + weight.slice(1)
  const variant = typographyStyleVariant(fontStyle)
  if (variant === 'normal') return base
  if (variant === 'italic') return `${base} Italic`
  if (variant === 'oblique') return `${base} Oblique`
  return fontStyle.trim().replace(/\s+/g, ' ')
}
function typographySignature(fontFamily: string, fontSize: number, fontWeight: number, fontStyle: string): string {
  return `${cleanKey(fontFamily)}|${round2(fontSize)}|${fontWeight}|${typographyStyleVariant(fontStyle)}`
}
function typographyFamilySizeKey(fontFamily: string, fontSize: number): string {
  return `${cleanKey(fontFamily)}|${round2(fontSize)}`
}
function lineHeightToPx(lineHeight: LineHeight, fontSize: number): number | null {
  if (lineHeight.unit === 'PIXELS') return round2(lineHeight.value)
  if (lineHeight.unit === 'PERCENT') return round2(fontSize * lineHeight.value / 100)
  return 0
}
function letterSpacingToPx(letterSpacing: LetterSpacing, fontSize: number): number {
  if (letterSpacing.unit === 'PIXELS') return round2(letterSpacing.value)
  if (letterSpacing.unit === 'PERCENT') return round2(fontSize * letterSpacing.value / 100)
  return 0
}
function typographyRecordFromStyle(style: TextStyle): TypographyStyleRecord {
  const fontWeight = styleToNumericWeight(style.fontName.style)
  return {
    id: style.id,
    name: style.name,
    fontFamily: style.fontName.family,
    fontStyle: style.fontName.style,
    fontSize: round2(style.fontSize),
    fontWeight,
    lineHeightPx: lineHeightToPx(style.lineHeight, style.fontSize),
    letterSpacingPx: letterSpacingToPx(style.letterSpacing, style.fontSize),
    signature: typographySignature(style.fontName.family, style.fontSize, fontWeight, style.fontName.style),
    remote: style.remote,
  }
}
function findRoleIndex(segments: string[]): number {
  return segments.findIndex(segment => {
    const family = roleFamily(segment)
    return ['largetitle', 'title', 'headline', 'subheadline', 'body', 'callout', 'footnote', 'caption'].includes(family)
  })
}
function findWeightIndex(segments: string[]): number | null {
  const index = segments.findIndex(segment => {
    const normalized = normalizeWeightName(segment)
    return ['thin', 'extralight', 'light', 'regular', 'medium', 'semibold', 'bold', 'extrabold', 'black'].includes(normalized) || /^w\d+$/.test(normalized)
  })
  return index >= 0 ? index : null
}
function typographyTemplateFromRecord(record: TypographyStyleRecord): TypographyNameTemplate | null {
  const segments = record.name.split('/').map(segment => segment.trim()).filter(Boolean)
  if (segments.length === 0) return null
  const weightIndex = findWeightIndex(segments)
  const roleIndex = findRoleIndex(segments)
  if (roleIndex < 0) return null
  const roleEnd = weightIndex !== null && weightIndex > roleIndex ? weightIndex - 1 : segments.length - 1
  const roleSegments = segments.slice(roleIndex, roleEnd + 1)
  return {
    name: record.name,
    segments,
    prefixSegments: segments.slice(0, roleIndex),
    roleSegments,
    weightIndex,
    fontFamily: record.fontFamily,
    fontSize: record.fontSize,
    fontWeight: record.fontWeight,
    roleFamily: roleFamily(roleSegments.join(' ')),
    remote: record.remote,
    multiLayer: segments.length >= 3,
  }
}
function mostCommonPrefix(names: string[], fallback: string): string {
  const counts = new Map<string, number>()
  for (const name of names) {
    const idx = name.indexOf('/')
    if (idx > 0) counts.set(name.slice(0, idx), (counts.get(name.slice(0, idx)) ?? 0) + 1)
  }
  let best = fallback
  let count = 0
  for (const [prefix, n] of counts) {
    if (n > count) {
      best = prefix
      count = n
    }
  }
  return best
}
function isTypographyVariableName(name: string): boolean {
  return /(^|\/|-)(font|type|text|line-height|letter-spacing|paragraph|weight|size)(\/|-|$)/i.test(name)
}
function collectVariableAliasIds(value: unknown, ids: Set<string>): void {
  if (!value || typeof value !== 'object') return
  if ('type' in value && (value as { type?: unknown }).type === 'VARIABLE_ALIAS' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string') ids.add(id)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectVariableAliasIds(item, ids)
    return
  }
  for (const item of Object.values(value as Record<string, unknown>)) collectVariableAliasIds(item, ids)
}
function collectVariableAliasRefs(value: unknown, consumer: SceneNode, refs: BoundVariableRef[]): void {
  if (!value || typeof value !== 'object') return
  if ('type' in value && (value as { type?: unknown }).type === 'VARIABLE_ALIAS' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string') refs.push({ id, consumer })
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectVariableAliasRefs(item, consumer, refs)
    return
  }
  for (const item of Object.values(value as Record<string, unknown>)) collectVariableAliasRefs(item, consumer, refs)
}

async function auditLibraries(): Promise<LibraryAudit> {
  const localCollections = await figma.variables.getLocalVariableCollectionsAsync()
  const localVariables = await figma.variables.getLocalVariablesAsync()
  const localPaintStyles = await figma.getLocalPaintStylesAsync()
  const localTextStyles = await figma.getLocalTextStylesAsync()
  const nodes = figma.currentPage.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET', 'INSTANCE'] })
  const localComponentNames: string[] = []
  const remoteComponentNames = new Set<string>()
  for (const node of nodes) {
    if (node.type === 'INSTANCE') {
      try {
        const main = await node.getMainComponentAsync()
        if (main?.remote) remoteComponentNames.add(main.name)
        else localComponentNames.push(node.name)
      } catch {
        localComponentNames.push(node.name)
      }
    } else if (node.remote) {
      remoteComponentNames.add(node.name)
    } else {
      localComponentNames.push(node.name)
    }
  }

  const styleIds = new Set<string>()
  const boundVariableIds = new Set<string>()
  const boundVariableRefs: BoundVariableRef[] = []
  const styleNodes = figma.currentPage.findAll()
  function addStyleId(value: unknown): void {
    if (typeof value === 'string' && value) styleIds.add(value)
  }
  for (const node of styleNodes) {
    if ('fillStyleId' in node) addStyleId(node.fillStyleId)
    if ('strokeStyleId' in node) addStyleId(node.strokeStyleId)
    if ('textStyleId' in node) addStyleId(node.textStyleId)
    if ('effectStyleId' in node) addStyleId(node.effectStyleId)
    if ('boundVariables' in node) {
      collectVariableAliasIds(node.boundVariables, boundVariableIds)
      collectVariableAliasRefs(node.boundVariables, node, boundVariableRefs)
    }
  }
  const remoteStyleNames: string[] = []
  const remotePaintStyleRecords: PaintStyle[] = []
  const remoteTextStyleRecords: TypographyStyleRecord[] = []
  for (const id of styleIds) {
    try {
      const style = await figma.getStyleByIdAsync(id)
      if (style?.remote) remoteStyleNames.push(style.name)
      if (style?.remote && style.type === 'PAINT') remotePaintStyleRecords.push(style)
      if (style?.remote && style.type === 'TEXT') remoteTextStyleRecords.push(typographyRecordFromStyle(style))
      if (style && 'boundVariables' in style) collectVariableAliasIds(style.boundVariables, boundVariableIds)
    } catch {
      // Style lookup can fail for deleted or unavailable remote styles.
    }
  }

  const remoteVariables: Array<{ name: string; resolvedType: VariableResolvedDataType; collectionName: string }> = []
  const remoteAvailableVariables: Array<{ name: string; resolvedType: VariableResolvedDataType; collectionName: string }> = []
  const remoteBoundVariables: Array<{ name: string; resolvedType: VariableResolvedDataType; collectionName: string }> = []
  const remoteColorValueNames = new Map<string, string>()
  const colorVariableIdsByValue = new Map<string, string>()
  const remoteLibraryNames = new Set<string>()
  let remoteCollections = 0
  try {
    const libs = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()
    remoteCollections = libs.length
    for (const lib of libs) {
      remoteLibraryNames.add(lib.libraryName || lib.name)
      try {
        const vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(lib.key)
        for (const v of vars) {
          const remoteVar = { name: v.name, resolvedType: v.resolvedType, collectionName: lib.name }
          remoteVariables.push(remoteVar)
          remoteAvailableVariables.push(remoteVar)
        }
      } catch {
        // Ignore unavailable library collections; the audit remains useful with partial data.
      }
    }
  } catch {
    // Team library access can fail if no libraries are enabled or the user is offline.
  }
  for (const id of boundVariableIds) {
    try {
      const variable = await figma.variables.getVariableByIdAsync(id)
      if (!variable?.remote) continue
      const remoteVar = { name: variable.name, resolvedType: variable.resolvedType, collectionName: variable.variableCollectionId }
      remoteVariables.push(remoteVar)
      remoteBoundVariables.push(remoteVar)
      if (variable.resolvedType === 'COLOR') {
        for (const ref of boundVariableRefs.filter(ref => ref.id === id)) {
          try {
            const resolved = variable.resolveForConsumer(ref.consumer)
            if (resolved.resolvedType === 'COLOR') {
              const valueKey = colorValueToString(resolved.value, true)
              remoteColorValueNames.set(valueKey, variable.name)
              if (!colorVariableIdsByValue.has(valueKey)) colorVariableIdsByValue.set(valueKey, variable.id)
            }
          } catch {
            // Some remote color variables cannot resolve for every consumer; keep the audit partial.
          }
        }
      }
      try {
        const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId)
        if (collection?.remote) remoteLibraryNames.add(collection.name)
      } catch {
        // Remote collection lookup can fail even when the variable itself is readable.
      }
    } catch {
      // Some remote variables referenced by library internals may not be readable in this file.
    }
  }
  const uniqueRemoteVariables = [
    ...new Map(remoteVariables.map(v => [`${v.collectionName}:${v.resolvedType}:${v.name}`, v])).values(),
  ]
  const uniqueRemoteAvailableVariables = [
    ...new Map(remoteAvailableVariables.map(v => [`${v.collectionName}:${v.resolvedType}:${v.name}`, v])).values(),
  ]
  const uniqueRemoteBoundVariables = [
    ...new Map(remoteBoundVariables.map(v => [`${v.collectionName}:${v.resolvedType}:${v.name}`, v])).values(),
  ]

  const colorNames = localVariables.filter(v => v.resolvedType === 'COLOR').map(v => v.name)
  const radiusNames = localVariables.filter(v => v.resolvedType === 'FLOAT' && v.name.toLowerCase().includes('radius')).map(v => v.name)
  const namesByGroup: Record<TokenGroup, Set<string>> = {
    colors: new Set([
      ...localVariables.filter(v => v.resolvedType === 'COLOR').map(v => v.name),
      ...uniqueRemoteVariables.filter(v => v.resolvedType === 'COLOR').map(v => v.name),
      ...localPaintStyles.map(s => s.name),
      ...remotePaintStyleRecords.map(s => s.name),
    ]),
    typography: new Set([
      ...localTextStyles.map(s => s.name),
      ...remoteStyleNames,
      ...localVariables.filter(v => v.resolvedType === 'FLOAT' || v.resolvedType === 'STRING').map(v => v.name),
      ...uniqueRemoteVariables.filter(v => v.resolvedType === 'FLOAT' || v.resolvedType === 'STRING').map(v => v.name),
    ]),
    radius: new Set([
      ...radiusNames,
      ...uniqueRemoteVariables.filter(v => v.resolvedType === 'FLOAT' && v.name.toLowerCase().includes('radius')).map(v => v.name),
    ]),
  }
  const valueNamesByGroup: Record<TokenGroup, Map<string, string>> = { colors: new Map(), typography: new Map(), radius: new Map() }
  const paintStyleNamesByKey = new Map<string, string>()
  const paintStyleIdsByKey = new Map<string, string>()
  for (const style of [...localPaintStyles, ...remotePaintStyleRecords]) {
    const key = paintListKey(style.paints)
    if (!paintStyleNamesByKey.has(key) || !style.remote) {
      paintStyleNamesByKey.set(key, style.name)
      paintStyleIdsByKey.set(key, style.id)
    }
  }
  const localTextStyleRecords = localTextStyles.map(typographyRecordFromStyle)
  const typographyStyleRecords = [...localTextStyleRecords, ...remoteTextStyleRecords]
  const typographyStylesBySignature = new Map<string, TypographyStyleRecord>()
  for (const record of typographyStyleRecords) {
    if (!typographyStylesBySignature.has(record.signature) || !record.remote) {
      typographyStylesBySignature.set(record.signature, record)
    }
  }
  const typographyTemplates = typographyStyleRecords
    .map(typographyTemplateFromRecord)
    .filter((template): template is TypographyNameTemplate => Boolean(template))
  const typographyTemplatesByFamilySize = new Map<string, TypographyNameTemplate[]>()
  for (const template of typographyTemplates) {
    const key = typographyFamilySizeKey(template.fontFamily, template.fontSize)
    const templates = typographyTemplatesByFamilySize.get(key) ?? []
    templates.push(template)
    typographyTemplatesByFamilySize.set(key, templates)
  }
  const typographyUsesMultiLayerNames = typographyTemplates.some(template => template.multiLayer)
  for (const v of localVariables) {
    const col = localCollections.find(c => c.id === v.variableCollectionId)
    if (!col) continue
    const val = resolveVariableValue(v.valuesByMode[col.defaultModeId], localVariables, localCollections)
    if (v.resolvedType === 'COLOR') {
      const valueKey = colorValueToString(val, true)
      valueNamesByGroup.colors.set(valueKey, v.name)
      colorVariableIdsByValue.set(valueKey, v.id)
    }
    if (v.resolvedType === 'FLOAT' && v.name.toLowerCase().includes('radius') && typeof val === 'number') valueNamesByGroup.radius.set(String(val), v.name)
  }
  for (const [value, name] of remoteColorValueNames) {
    if (!valueNamesByGroup.colors.has(value)) valueNamesByGroup.colors.set(value, name)
  }
  for (const s of localTextStyles) valueNamesByGroup.typography.set(s.name, s.name)

  const colorCollectionName = localCollections.find(c => c.name.toLowerCase().includes('color'))?.name ?? COLOR_COLLECTION
  const typographyCollectionName = localCollections.find(c => c.name.toLowerCase().includes('typography') || c.name.toLowerCase().includes('type'))?.name ?? TYPOGRAPHY_COLLECTION
  const radiusCollectionName = localCollections.find(c => c.name.toLowerCase().includes('radius'))?.name ?? RADIUS_COLLECTION
  const localColorVariables = localVariables.filter(v => v.resolvedType === 'COLOR').length
  const localTypographyVariables = localVariables.filter(v => {
    const col = localCollections.find(c => c.id === v.variableCollectionId)
    return (col?.name === typographyCollectionName || isTypographyVariableName(v.name)) && v.resolvedType !== 'COLOR'
  }).length
  const remoteColorVariables = uniqueRemoteVariables.filter(v => v.resolvedType === 'COLOR').length
  const remotePaintStyles = remotePaintStyleRecords.length
  const remoteTypographyVariables = uniqueRemoteVariables.filter(v => v.resolvedType !== 'COLOR').length
  const remoteAvailableColorVariables = uniqueRemoteAvailableVariables.filter(v => v.resolvedType === 'COLOR').length
  const remoteAvailableTypographyVariables = uniqueRemoteAvailableVariables.filter(v => v.resolvedType !== 'COLOR').length
  const remoteBoundColorVariables = uniqueRemoteBoundVariables.filter(v => v.resolvedType === 'COLOR').length
  const remoteBoundTypographyVariables = uniqueRemoteBoundVariables.filter(v => v.resolvedType !== 'COLOR').length
  const summary: AuditSummary = {
    localCollections: localCollections.length,
    localVariables: localVariables.length,
    localColorVariables,
    localPaintStyles: localPaintStyles.length,
    localTypographyVariables,
    localTextStyles: localTextStyles.length,
    localComponents: localComponentNames.length,
    remoteComponents: remoteComponentNames.size,
    remoteStyles: remoteStyleNames.length,
    remotePaintStyles,
    remoteCollections,
    remoteVariables: uniqueRemoteVariables.length,
    remoteColorVariables,
    remoteTypographyVariables,
    remoteAvailableColorVariables,
    remoteAvailableTypographyVariables,
    remoteBoundColorVariables,
    remoteBoundTypographyVariables,
    remoteLibraryNames: [...remoteLibraryNames],
    hasLocalLibrary: localCollections.length > 0 || localTextStyles.length > 0 || localComponentNames.length > 0,
    hasRemoteLibrary: remoteCollections > 0 || remoteVariables.length > 0 || remoteComponentNames.size > 0 || remoteStyleNames.length > 0,
    colorCollectionName,
    typographyCollectionName,
    radiusCollectionName,
  }
  return {
    summary,
    localCollections,
    localVariables,
    localPaintStyles,
    localTextStyles,
    typographyStylesBySignature,
    typographyTemplates,
    typographyTemplatesByFamilySize,
    typographyUsesMultiLayerNames,
    remoteVariables: uniqueRemoteVariables,
    remoteStyleNames,
    localComponentNames,
    remoteComponentNames: [...remoteComponentNames],
    namesByGroup,
    valueNamesByGroup,
    colorVariableIdsByValue,
    paintStyleNamesByKey,
    paintStyleIdsByKey,
    colorPrefix: mostCommonPrefix(colorNames, 'color'),
    radiusPrefix: mostCommonPrefix(radiusNames, 'radius'),
  }
}

function suggestColorName(audit: LibraryAudit, c: TokenColor): string {
  const existing = audit.valueNamesByGroup.colors.get(hexColor(c))
  if (existing) return existing
  const hex = rgbToHex(c.r, c.g, c.b)
  if (c.a < 0.999) {
    const alpha = alphaPercent(c)
    if (hex === '000000') return `black-alpha/${alpha}`
    if (hex === 'ffffff') return `white-alpha/${alpha}`
    return `alpha/${hex}/${alpha}`
  }
  if (isOpaqueGray(c)) return `gray/${hsbBrightnessPercent(c)}`
  return `${audit.colorPrefix}/${hex}`
}
function suggestGradientName(audit: LibraryAudit, paint: GradientPaint, key: string): string {
  const existing = audit.paintStyleNamesByKey.get(key)
  if (existing) return existing
  const first = paint.gradientStops[0]
  const last = paint.gradientStops[paint.gradientStops.length - 1]
  const firstHex = first ? colorStopToHex(first).replace('#', '') : 'start'
  const lastHex = last ? colorStopToHex(last).replace('#', '') : 'end'
  return `gradient/${firstHex}-${lastHex}/${stableHash(key)}`
}
function defaultTypographyName(fontSize: number, fontWeight: number, fontStyle: string, families: Set<string>, family: string): string {
  const role = roleToStyleName(classifyStyle(fontSize, fontWeight))
  const base = `${role}/${fontStyle}`
  return families.size > 1 ? `${base} · ${family}` : base
}
function nearestTypographyTemplate(
  audit: LibraryAudit,
  fontFamily: string,
  fontSize: number,
  fontWeight: number
): TypographyNameTemplate | null {
  if (!audit.typographyUsesMultiLayerNames) return null
  const desiredRoleFamily = roleFamily(roleToStyleName(classifyStyle(fontSize, fontWeight)))
  let best: TypographyNameTemplate | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const template of audit.typographyTemplates) {
    if (!template.multiLayer) continue
    const fontPenalty = cleanKey(template.fontFamily) === cleanKey(fontFamily) ? 0 : 500
    const rolePenalty = template.roleFamily === desiredRoleFamily ? 0 : 80
    const sizePenalty = Math.abs(template.fontSize - fontSize) * 10
    const weightPenalty = Math.abs(template.fontWeight - fontWeight) / 10
    const remotePenalty = template.remote ? 4 : 0
    const score = fontPenalty + rolePenalty + sizePenalty + weightPenalty + remotePenalty
    if (score < bestScore) {
      best = template
      bestScore = score
    }
  }
  return best
}
function nearestSameSizeTypographyTemplate(
  audit: LibraryAudit,
  fontFamily: string,
  fontSize: number,
  fontWeight: number
): TypographyNameTemplate | null {
  const candidates = audit.typographyTemplatesByFamilySize.get(typographyFamilySizeKey(fontFamily, fontSize)) ?? []
  let best: TypographyNameTemplate | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const template of candidates) {
    const remotePenalty = template.remote ? 1000 : 0
    const completenessPenalty = Math.max(0, 8 - template.segments.length) * 5
    const weightPenalty = Math.abs(template.fontWeight - fontWeight) / 10
    const score = remotePenalty + completenessPenalty + weightPenalty
    if (score < bestScore) {
      best = template
      bestScore = score
    }
  }
  return best
}
function typographyNameFromTemplate(template: TypographyNameTemplate, fontStyle: string): string {
  const segments = [...template.prefixSegments, ...template.roleSegments]
  if (template.weightIndex !== null) segments.push(weightLabel(fontStyle))
  return segments.join('/')
}
function suggestTypographyName(
  audit: LibraryAudit,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  fontStyle: string,
  families: Set<string>
): string {
  const fallback = defaultTypographyName(fontSize, fontWeight, fontStyle, families, fontFamily)
  const sameSizeTemplate = nearestSameSizeTypographyTemplate(audit, fontFamily, fontSize, fontWeight)
  if (sameSizeTemplate) return typographyNameFromTemplate(sameSizeTemplate, fontStyle)
  const template = nearestTypographyTemplate(audit, fontFamily, fontSize, fontWeight)
  if (!template) return fallback
  const desiredRole = roleToStyleName(classifyStyle(fontSize, fontWeight))
  const desiredRoleFamily = roleFamily(desiredRole)
  const roleSegments = template.roleFamily === desiredRoleFamily ? template.roleSegments : [desiredRole]
  const adaptedTemplate: TypographyNameTemplate = { ...template, roleSegments }
  return typographyNameFromTemplate(adaptedTemplate, fontStyle)
}
function formatSizeName(fontSize: number): string {
  return Number.isInteger(fontSize) ? String(fontSize) : String(round2(fontSize))
}
function withTypographyDisambiguation(candidates: TypographyCandidate[], audit: LibraryAudit): TypographyCandidate[] {
  const next = candidates.map(candidate => ({ ...candidate }))
  const names = new Map<string, TypographyCandidate[]>()
  for (const candidate of next) {
    if (candidate.status === 'new' || candidate.status === 'invalid') {
      const group = names.get(candidate.targetName) ?? []
      group.push(candidate)
      names.set(candidate.targetName, group)
    }
  }
  for (const [name, group] of names) {
    if (group.length < 2 || audit.namesByGroup.typography.has(name)) continue
    const uniqueSignatures = new Set(group.map(candidate => candidate.valueKey))
    if (uniqueSignatures.size < 2) continue
    for (const candidate of group) {
      if (candidate.nameOverride) continue
      const disambiguatedName = `${candidate.targetName}/${formatSizeName(candidate.fontSize)}`
      candidate.suggestedName = disambiguatedName
      candidate.targetName = disambiguatedName
    }
  }
  const secondPass = new Map<string, TypographyCandidate[]>()
  for (const candidate of next) {
    if (candidate.status === 'new' || candidate.status === 'invalid') {
      const group = secondPass.get(candidate.targetName) ?? []
      group.push(candidate)
      secondPass.set(candidate.targetName, group)
    }
  }
  for (const [name, group] of secondPass) {
    if (group.length < 2 || audit.namesByGroup.typography.has(name)) continue
    const uniqueSignatures = new Set(group.map(candidate => candidate.valueKey))
    if (uniqueSignatures.size < 2) continue
    for (const candidate of group) {
      if (candidate.nameOverride) continue
      const disambiguatedName = `${candidate.targetName}/${weightLabel(candidate.fontStyle)}`
      candidate.suggestedName = disambiguatedName
      candidate.targetName = disambiguatedName
    }
  }
  return next
}
function suggestRadiusName(audit: LibraryAudit, value: number): string {
  const existing = audit.valueNamesByGroup.radius.get(String(value))
  if (existing) return existing
  return `${audit.radiusPrefix}/${value >= 9999 ? 'full' : value}`
}
function classifyCandidate<T extends TokenCandidate>(candidate: T, audit: LibraryAudit, value: VariableValue | string): T {
  const invalid = isInvalidTokenName(candidate.targetName)
  if (invalid) return { ...candidate, status: 'invalid', reason: invalid }
  const names = audit.namesByGroup[candidate.group]
  if (candidate.group === 'typography') {
    const typographyCandidate = candidate as TypographyCandidate
    const match = audit.typographyStylesBySignature.get(typographyCandidate.valueKey)
    if (match) {
      const secondaryDiffers = match.lineHeightPx !== typographyCandidate.lineHeightPx || match.letterSpacingPx !== typographyCandidate.letterSpacingPx
      return {
        ...typographyCandidate,
        status: 'match',
        targetName: match.name,
        matchedStyleId: match.id,
        matchedStyleRemote: match.remote,
        reason: secondaryDiffers ? '核心属性匹配；提交后将绑定到已有库样式' : '核心属性匹配已有文字样式',
      } as T
    }
    if (names.has(typographyCandidate.targetName)) {
      return { ...typographyCandidate, status: 'conflict', reason: '名称已存在但文字属性不同' } as T
    }
    return { ...typographyCandidate, status: 'new', reason: undefined } as T
  }
  if (!names.has(candidate.targetName)) return { ...candidate, status: 'new', reason: undefined }
  if (candidate.group === 'colors') {
    const colorCandidate = candidate as ColorCandidate
    if (colorCandidate.kind === 'gradient') {
      const matchName = audit.paintStyleNamesByKey.get(colorCandidate.valueKey)
      return { ...colorCandidate, status: matchName === colorCandidate.targetName ? 'match' : 'conflict', reason: matchName === colorCandidate.targetName ? '已存在同值渐变样式' : '名称已存在但渐变参数不同' } as T
    }
    const matchName = audit.valueNamesByGroup.colors.get(colorValueToString(value as VariableValue, true))
    return { ...candidate, status: matchName === candidate.targetName ? 'match' : 'conflict', reason: matchName === candidate.targetName ? '已存在同值颜色' : '名称已存在但颜色值不同' }
  }
  if (candidate.group === 'radius') {
    const matchName = audit.valueNamesByGroup.radius.get(String(value))
    return { ...candidate, status: matchName === candidate.targetName ? 'match' : 'conflict', reason: matchName === candidate.targetName ? '已存在同值圆角' : '名称已存在但数值不同' }
  }
  return candidate
}
function validateDuplicates(groups: Record<TokenGroup, TokenCandidate[]>, audit: LibraryAudit): Record<TokenGroup, TokenCandidate[]> {
  const next: Record<TokenGroup, TokenCandidate[]> = { colors: [], typography: [], radius: [] }
  for (const group of Object.keys(groups) as TokenGroup[]) {
    const candidates = group === 'typography'
      ? withTypographyDisambiguation(groups[group] as TypographyCandidate[], audit)
      : groups[group]
    const counts = new Map<string, number>()
    for (const c of candidates) {
      if (c.status === 'new' || c.status === 'invalid') counts.set(c.targetName, (counts.get(c.targetName) ?? 0) + 1)
    }
    next[group] = candidates.map(c => {
      const invalid = isInvalidTokenName(c.targetName)
      if (invalid) return { ...c, status: 'invalid', reason: invalid } as TokenCandidate
      if (group === 'typography' && (c.status === 'new' || c.status === 'invalid')) {
        const typographyCandidate = c as TypographyCandidate
        const hasExistingName = audit.namesByGroup.typography.has(typographyCandidate.targetName)
        const hasExistingSignature = audit.typographyStylesBySignature.has(typographyCandidate.valueKey)
        if (hasExistingName && !hasExistingSignature) {
          return { ...typographyCandidate, status: 'conflict', reason: '名称已存在但文字属性不同' } as TokenCandidate
        }
      }
      if (group === 'colors' && (c.status === 'new' || c.status === 'invalid')) {
        const colorCandidate = c as ColorCandidate
        if (audit.namesByGroup.colors.has(colorCandidate.targetName)) {
          if (colorCandidate.kind === 'gradient') {
            const matchName = audit.paintStyleNamesByKey.get(colorCandidate.valueKey)
            return { ...colorCandidate, status: matchName === colorCandidate.targetName ? 'match' : 'conflict', reason: matchName === colorCandidate.targetName ? '已存在同值渐变样式' : '名称已存在但渐变参数不同' } as TokenCandidate
          }
          const matchName = audit.valueNamesByGroup.colors.get(colorCandidate.hex)
          return { ...colorCandidate, status: matchName === colorCandidate.targetName ? 'match' : 'conflict', reason: matchName === colorCandidate.targetName ? '已存在同值颜色' : '名称已存在但颜色值不同' } as TokenCandidate
        }
      }
      if (group === 'radius' && (c.status === 'new' || c.status === 'invalid')) {
        const radiusCandidate = c as RadiusCandidate
        if (audit.namesByGroup.radius.has(radiusCandidate.targetName)) {
          const matchName = audit.valueNamesByGroup.radius.get(String(radiusCandidate.value))
          return { ...radiusCandidate, status: matchName === radiusCandidate.targetName ? 'match' : 'conflict', reason: matchName === radiusCandidate.targetName ? '已存在同值圆角' : '名称已存在但数值不同' } as TokenCandidate
        }
      }
      if ((counts.get(c.targetName) ?? 0) > 1 && !audit.namesByGroup[group].has(c.targetName)) {
        return { ...c, status: 'invalid', reason: '本次新增中名称重复' } as TokenCandidate
      }
      return c
    })
  }
  return next
}
function sortCandidateGroups(groups: Record<TokenGroup, TokenCandidate[]>): Record<TokenGroup, TokenCandidate[]> {
  const typography = groups.typography as TypographyCandidate[]
  const radius = groups.radius as RadiusCandidate[]
  const statusOrder: Record<TokenStatus, number> = {
    new: 0,
    invalid: 1,
    conflict: 2,
    match: 3,
    applied: 4,
    skip: 5,
  }
  const compareStatus = (a: TokenCandidate, b: TokenCandidate): number => statusOrder[a.status] - statusOrder[b.status]
  return {
    colors: [...groups.colors].sort((a, b) => compareStatus(a, b) || a.targetName.localeCompare(b.targetName)),
    typography: [...typography].sort((a, b) => {
      const status = compareStatus(a, b)
      if (status) return status
      if (b.fontSize !== a.fontSize) return b.fontSize - a.fontSize
      if (b.fontWeight !== a.fontWeight) return b.fontWeight - a.fontWeight
      return a.targetName.localeCompare(b.targetName)
    }),
    radius: [...radius].sort((a, b) => compareStatus(a, b) || a.value - b.value || a.targetName.localeCompare(b.targetName)),
  }
}

function isSelectableNode(node: SceneNode): boolean {
  return 'width' in node && 'height' in node && node.width >= 32 && node.height >= 32
}
function isIntegerRadius(value: number): boolean {
  return value >= 0 && value === Math.round(value)
}
function radiusPropertiesForNode(node: SceneNode): Array<{ value: number; properties: RadiusBindableField[] }> {
  if (!('cornerRadius' in node) || !isSelectableNode(node)) return []
  if (typeof node.cornerRadius === 'number') {
    return isIntegerRadius(node.cornerRadius)
      ? [{ value: node.cornerRadius, properties: ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'] }]
      : []
  }
  const values: Array<{ property: RadiusBindableField; value: number }> = []
  const maybeCorner = node as SceneNode & Partial<Record<RadiusBindableField, number>>
  for (const property of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'] as RadiusBindableField[]) {
    const value = maybeCorner[property]
    if (typeof value === 'number' && isIntegerRadius(value)) values.push({ property, value })
  }
  const byValue = new Map<number, RadiusBindableField[]>()
  for (const item of values) {
    const properties = byValue.get(item.value) ?? []
    properties.push(item.property)
    byValue.set(item.value, properties)
  }
  return [...byValue.entries()].map(([value, properties]) => ({ value, properties }))
}

function collectSelectionCandidates(audit: LibraryAudit, selection: readonly SceneNode[]): Record<TokenGroup, TokenCandidate[]> {
  const colors = new Map<string, ColorCandidate>()
  const typography = new Map<string, TypographyCandidate>()
  const radius = new Map<string, RadiusCandidate>()
  const familiesByRoleWeight = new Map<string, Set<string>>()

  function collectTextFamilyGroups(node: SceneNode): void {
    if (node.type === 'TEXT' && node.fontName !== figma.mixed && typeof node.fontSize === 'number') {
      const fontName = node.fontName as FontName
      const weight = styleToNumericWeight(fontName.style)
      const roleWeight = `${roleToStyleName(classifyStyle(node.fontSize, weight))}/${fontName.style}`
      if (!familiesByRoleWeight.has(roleWeight)) familiesByRoleWeight.set(roleWeight, new Set())
      familiesByRoleWeight.get(roleWeight)!.add(fontName.family)
    }
    if ('children' in node) for (const child of node.children) collectTextFamilyGroups(child)
  }
  for (const node of selection) collectTextFamilyGroups(node)

  function addRadiusRef(value: number, node: SceneNode, properties: RadiusBindableField[]): void {
    const key = String(value)
    const existing = radius.get(key)
    const ref: BindingRef = { group: 'radius', nodeId: node.id, key, properties }
    if (existing) existing.refs.push(ref)
    else {
      const suggestedName = suggestRadiusName(audit, value)
      const candidate: RadiusCandidate = {
        id: `radius:${key}`,
        group: 'radius',
        status: 'new',
        suggestedName,
        targetName: suggestedName,
        selected: true,
        value,
        valueKey: key,
        refs: [ref],
      }
      radius.set(key, classifyCandidate(candidate, audit, value))
    }
  }

  function addGradientRef(
    paints: readonly Paint[],
    paint: GradientPaint,
    node: SceneNode,
    property: 'fills' | 'strokes',
    paintIndex: number
  ): void {
    const key = paintListKey(paints)
    const existing = colors.get(key)
    const ref: BindingRef = { group: 'colors', nodeId: node.id, property, paintIndex, key }
    if (existing) existing.refs.push(ref)
    else {
      const suggestedName = suggestGradientName(audit, paint, key)
      const candidate: GradientColorCandidate = {
        id: `gradient:${stableHash(key)}`,
        group: 'colors',
        kind: 'gradient',
        status: 'new',
        suggestedName,
        targetName: suggestedName,
        selected: true,
        paints: clonePaints(paints),
        valueKey: key,
        hex: 'gradient',
        gradientType: gradientLabel(paint.type),
        stopCount: paint.gradientStops.length,
        preview: gradientPreview(paint),
        refs: [ref],
      }
      colors.set(key, classifyCandidate(candidate, audit, key))
    }
  }

  function collectPaintProperty(node: SceneNode, property: 'fills' | 'strokes', paints: readonly Paint[]): void {
    const visiblePaints = paints.filter(paint => paint.visible !== false)
    const gradientIndex = visibleGradientIndex(paints)
    if (gradientIndex >= 0) {
      const gradient = paints[gradientIndex]
      if (isGradientPaint(gradient)) addGradientRef(paints, gradient, node, property, gradientIndex)
      return
    }
    visiblePaints.forEach(paint => {
      if (paint.type !== 'SOLID') return
      const paintIndex = paints.indexOf(paint)
      const value = { ...paint.color, a: paint.opacity ?? 1 }
      const key = colorKey(value)
      const existing = colors.get(key)
      const ref: BindingRef = { group: 'colors', nodeId: node.id, property, paintIndex, key }
      if (existing) existing.refs.push(ref)
      else {
        const suggestedName = suggestColorName(audit, value)
        const candidate: SolidColorCandidate = {
          id: `color:${key}`,
          group: 'colors',
          kind: 'solid',
          status: 'new',
          suggestedName,
          targetName: suggestedName,
          selected: true,
          value,
          valueKey: key,
          hex: hexColor(value),
          refs: [ref],
        }
        colors.set(key, classifyCandidate(candidate, audit, value))
      }
    })
  }

  function collect(node: SceneNode): void {
    if ('fills' in node && Array.isArray(node.fills)) collectPaintProperty(node, 'fills', node.fills)
    if ('strokes' in node && Array.isArray(node.strokes)) collectPaintProperty(node, 'strokes', node.strokes)
    if (node.type === 'TEXT' && node.fontName !== figma.mixed && typeof node.fontSize === 'number') {
      const fontName = node.fontName as FontName
      let lineHeightPx: number | null = null
      if (node.lineHeight !== figma.mixed) {
        lineHeightPx = lineHeightToPx(node.lineHeight, node.fontSize)
      }
      let letterSpacingPx = 0
      if (node.letterSpacing !== figma.mixed) {
        letterSpacingPx = letterSpacingToPx(node.letterSpacing, node.fontSize)
      }
      const fontWeight = styleToNumericWeight(fontName.style)
      const roleWeight = `${roleToStyleName(classifyStyle(node.fontSize, fontWeight))}/${fontName.style}`
      const key = typographySignature(fontName.family, node.fontSize, fontWeight, fontName.style)
      const existing = typography.get(key)
      const ref: BindingRef = { group: 'typography', nodeId: node.id, key }
      if (existing) existing.refs.push(ref)
      else {
        const suggestedName = suggestTypographyName(audit, fontName.family, node.fontSize, fontWeight, fontName.style, familiesByRoleWeight.get(roleWeight) ?? new Set([fontName.family]))
        const candidate: TypographyCandidate = {
          id: `type:${key}`,
          group: 'typography',
          status: 'new',
          suggestedName,
          targetName: suggestedName,
          selected: true,
          fontFamily: fontName.family,
          fontStyle: fontName.style,
          fontSize: node.fontSize,
          fontWeight,
          lineHeightPx,
          letterSpacingPx,
          valueKey: key,
          refs: [ref],
        }
        typography.set(key, classifyCandidate(candidate, audit, suggestedName))
      }
    }
    for (const item of radiusPropertiesForNode(node)) addRadiusRef(item.value, node, item.properties)
    if ('children' in node) for (const child of node.children) collect(child)
  }
  for (const node of selection) collect(node)
  return sortCandidateGroups(validateDuplicates({ colors: [...colors.values()], typography: [...typography.values()], radius: [...radius.values()] }, audit))
}

async function buildProposal(): Promise<Proposal> {
  const selection = currentSelection()
  const selectedIds = selectionIds(selection)
  const audit = await auditLibraries()
  if (!sameOrderedIds(selectedIds, selectionIds())) throw new Error('检测期间选区发生变化，请重新提取候选')
  currentAudit = audit
  const groups = collectSelectionCandidates(audit, selection)
  return { audit: audit.summary, selectionIds: selectedIds, groups, summaries: summarizeProposal(groups) }
}
function postState(extra?: Record<string, unknown>): void {
  figma.ui.postMessage({
    type: 'state',
    isExecuting,
    activeAction,
    hasSelection: figma.currentPage.selection.length > 0,
    audit: currentAudit?.summary ?? null,
    proposal: currentProposal,
    ...extra,
  })
}
function renameCandidate(group: TokenGroup, id: string, targetName: string): void {
  if (!currentProposal || !currentAudit) return
  const candidates = currentProposal.groups[group].map(c => {
    if (c.id !== id || (c.status !== 'new' && c.status !== 'invalid')) return c
    const nameOverride = targetName.trim() ? normalizeName(targetName) : ''
    return {
      ...c,
      nameOverride,
      targetName: nameOverride || c.suggestedName,
      status: 'new',
      reason: undefined,
    } as TokenCandidate
  })
  currentProposal.groups[group] = validateDuplicates({ ...currentProposal.groups, [group]: candidates }, currentAudit)[group]
  currentProposal.groups = sortCandidateGroups(currentProposal.groups)
  currentProposal.summaries = summarizeProposal(currentProposal.groups)
}
function toggleCandidateSelection(group: TokenGroup, id: string, selected: boolean): void {
  if (!currentProposal) return
  currentProposal.groups[group] = currentProposal.groups[group].map(c => {
    if (c.id !== id || (c.status !== 'new' && c.status !== 'invalid')) return c
    return { ...c, selected } as TokenCandidate
  })
}
function candidateClassificationValue(candidate: TokenCandidate): VariableValue | string {
  if (candidate.group === 'colors') return candidate.kind === 'gradient' ? candidate.valueKey : candidate.value
  if (candidate.group === 'radius') return candidate.value
  return candidate.targetName
}
function reclassifyGroup(group: TokenGroup, audit: LibraryAudit): void {
  if (!currentProposal) return
  const candidates = currentProposal.groups[group].map(candidate => {
    if (candidate.status === 'applied' || candidate.status === 'skip') return candidate
    const reset = { ...candidate, status: 'new' as TokenStatus, reason: undefined }
    if (reset.group === 'typography') {
      delete reset.matchedStyleId
      delete reset.matchedStyleRemote
    }
    return classifyCandidate(reset as TokenCandidate, audit, candidateClassificationValue(reset as TokenCandidate))
  })
  const groups = validateDuplicates({ ...currentProposal.groups, [group]: candidates }, audit)
  currentProposal.groups = sortCandidateGroups(groups)
  currentProposal.audit = audit.summary
  currentProposal.summaries = summarizeProposal(currentProposal.groups)
}
function getOrCreateCollection(name: string): VariableCollection {
  const existing = currentAudit?.localCollections.find(c => c.name === name)
  if (existing) return existing
  const collection = figma.variables.createVariableCollection(name)
  currentAudit?.localCollections.push(collection)
  return collection
}
function getNode(id: string): SceneNode | null {
  const node = figma.getNodeById(id)
  return node && 'type' in node ? node as SceneNode : null
}
function createOrReuseVariable(name: string, value: VariableValue, type: VariableResolvedDataType, collection: VariableCollection): Variable | null {
  const existing = currentAudit?.localVariables.find(v => v.variableCollectionId === collection.id && v.name === name)
  if (existing) {
    if (existing.resolvedType !== type) return null
    const existingValue = existing.valuesByMode[collection.defaultModeId]
    return valuesEqual(existingValue, value) ? existing : null
  }
  let created: Variable | null = null
  try {
    const v = figma.variables.createVariable(name, collection, type)
    created = v
    v.setValueForMode(collection.defaultModeId, value)
    currentAudit?.localVariables.push(v)
    return v
  } catch {
    if (created) {
      try {
        created.remove()
      } catch {
        // The failed variable may already have been removed by Figma.
      }
    }
    return null
  }
}
function makeOutcome(expectedBindings = 0): ApplyCandidateOutcome {
  return { resourceReady: false, expectedBindings, boundBindings: 0, errors: [] }
}
function addOutcomeError(outcome: ApplyCandidateOutcome, message: string): void {
  if (!outcome.errors.includes(message)) outcome.errors.push(message)
}
async function applyColors(candidates: ColorCandidate[]): Promise<Map<string, ApplyCandidateOutcome>> {
  let collection: VariableCollection | null = null
  const byKey = new Map<string, Variable>()
  const paintStyleIdsByKey = new Map<string, string>()
  const outcomes = new Map<string, ApplyCandidateOutcome>()
  for (const c of candidates) {
    const uniqueRefs = new Set(c.refs.map(ref => ref.group === 'colors' ? `${ref.nodeId}:${ref.property}:${c.kind === 'gradient' ? 'style' : ref.paintIndex}` : ''))
    const outcome = makeOutcome(uniqueRefs.size)
    outcomes.set(c.id, outcome)
    if (c.kind === 'gradient') {
      let styleId = currentAudit?.paintStyleIdsByKey.get(c.valueKey) ?? null
      if (c.status === 'new') {
        if (currentAudit?.localPaintStyles.some(style => style.name === c.targetName)) {
          addOutcomeError(outcome, '提交时发现同名颜色样式')
        } else {
          let createdStyle: PaintStyle | null = null
          try {
            const style = figma.createPaintStyle()
            createdStyle = style
            style.name = c.targetName
            style.paints = clonePaints(c.paints)
            currentAudit?.localPaintStyles.push(style)
            styleId = style.id
          } catch {
            if (createdStyle) {
              try {
                createdStyle.remove()
              } catch {
                // The failed style may already have been removed by Figma.
              }
            }
            addOutcomeError(outcome, '渐变样式创建失败')
          }
        }
      }
      if (styleId) {
        paintStyleIdsByKey.set(c.valueKey, styleId)
        outcome.resourceReady = true
      } else if (outcome.errors.length === 0) addOutcomeError(outcome, '没有可用的渐变样式')
      continue
    }
    let v: Variable | null = null
    if (c.status === 'new') {
      collection = collection ?? getOrCreateCollection(currentAudit?.summary.colorCollectionName ?? COLOR_COLLECTION)
      v = createOrReuseVariable(c.targetName, { r: c.value.r, g: c.value.g, b: c.value.b, a: c.value.a }, 'COLOR', collection)
    } else {
      v = currentAudit?.localVariables.find(v => v.name === c.targetName && v.resolvedType === 'COLOR') ?? null
      if (!v) {
        const id = currentAudit?.colorVariableIdsByValue.get(hexColor(c.value))
        if (id) v = await figma.variables.getVariableByIdAsync(id)
      }
    }
    if (v) {
      byKey.set(c.valueKey, v)
      outcome.resourceReady = true
    } else addOutcomeError(outcome, '颜色变量不存在或发生同名冲突')
  }
  for (const c of candidates) {
    const outcome = outcomes.get(c.id)!
    if (!outcome.resourceReady) continue
    const processed = new Set<string>()
    if (c.kind === 'gradient') {
      const styleId = paintStyleIdsByKey.get(c.valueKey)
      if (!styleId) continue
      for (const ref of c.refs) {
        if (ref.group !== 'colors') continue
        const refKey = `${ref.nodeId}:${ref.property}`
        if (processed.has(refKey)) continue
        processed.add(refKey)
        const node = getNode(ref.nodeId)
        if (!node) {
          addOutcomeError(outcome, '待绑定图层已不存在')
          continue
        }
        try {
          if (ref.property === 'fills' && 'fillStyleId' in node) {
            if (!Array.isArray(node.fills) || paintListKey(node.fills) !== c.valueKey) throw new Error('fills 已变化')
            const fillNode = node as SceneNode & { fillStyleId: string; setFillStyleIdAsync?: (styleId: string) => Promise<void> }
            if (fillNode.setFillStyleIdAsync) await fillNode.setFillStyleIdAsync(styleId)
            else fillNode.fillStyleId = styleId
            outcome.boundBindings++
          }
          if (ref.property === 'strokes' && 'strokeStyleId' in node) {
            if (!Array.isArray(node.strokes) || paintListKey(node.strokes) !== c.valueKey) throw new Error('strokes 已变化')
            const strokeNode = node as SceneNode & { strokeStyleId: string; setStrokeStyleIdAsync?: (styleId: string) => Promise<void> }
            if (strokeNode.setStrokeStyleIdAsync) await strokeNode.setStrokeStyleIdAsync(styleId)
            else strokeNode.strokeStyleId = styleId
            outcome.boundBindings++
          }
        } catch {
          addOutcomeError(outcome, '图层颜色已变化或样式绑定失败')
        }
      }
      continue
    }
    const v = byKey.get(c.valueKey)
    if (!v) continue
    for (const ref of c.refs) {
      if (ref.group !== 'colors') continue
      const refKey = `${ref.nodeId}:${ref.property}:${ref.paintIndex}`
      if (processed.has(refKey)) continue
      processed.add(refKey)
      const node = getNode(ref.nodeId)
      if (!node || !(ref.property in node)) {
        addOutcomeError(outcome, '待绑定图层已不存在')
        continue
      }
      const paints = (ref.property === 'fills' && 'fills' in node ? node.fills : ref.property === 'strokes' && 'strokes' in node ? node.strokes : []) as readonly Paint[]
      const nextPaints = paints.slice()
      const paint = paints[ref.paintIndex]
      if (!paint || paint.type !== 'SOLID' || colorKey({ ...paint.color, a: paint.opacity ?? 1 }) !== c.valueKey) {
        addOutcomeError(outcome, '图层颜色已变化，已跳过绑定')
        continue
      }
      nextPaints[ref.paintIndex] = figma.variables.setBoundVariableForPaint(paint, 'color', v)
      try {
        if (ref.property === 'fills' && 'fills' in node) node.fills = nextPaints
        if (ref.property === 'strokes' && 'strokes' in node) node.strokes = nextPaints
        outcome.boundBindings++
      } catch {
        addOutcomeError(outcome, '颜色变量绑定失败')
      }
    }
  }
  return outcomes
}
async function applyTypography(candidates: TypographyCandidate[]): Promise<Map<string, ApplyCandidateOutcome>> {
  let collection: VariableCollection | null = null
  const existingStyles = await figma.getLocalTextStylesAsync()
  const byKey = new Map<string, TextStyle>()
  const outcomes = new Map<string, ApplyCandidateOutcome>()
  for (const c of candidates) {
    const outcome = makeOutcome(new Set(c.refs.map(ref => ref.nodeId)).size)
    outcomes.set(c.id, outcome)
    if (c.status === 'match') {
      let matched: TextStyle | null = null
      if (c.matchedStyleId) {
        try {
          const style = await figma.getStyleByIdAsync(c.matchedStyleId)
          if (style?.type === 'TEXT') matched = style
        } catch {
          matched = null
        }
      }
      if (!matched) matched = existingStyles.find(s => s.name === c.targetName) ?? null
      if (matched) {
        byKey.set(c.valueKey, matched)
        outcome.resourceReady = true
      } else addOutcomeError(outcome, '匹配的文字样式已不可用')
      continue
    }
    if (existingStyles.some(style => style.name === c.targetName)) {
      addOutcomeError(outcome, '提交时发现同名文字样式')
      continue
    }
    let createdStyle: TextStyle | null = null
    const createdVariables: Variable[] = []
    let createdCollection: VariableCollection | null = null
    try {
      await figma.loadFontAsync({ family: c.fontFamily, style: c.fontStyle })
      const latestStyles = await figma.getLocalTextStylesAsync()
      if (latestStyles.some(style => style.name === c.targetName)) {
        addOutcomeError(outcome, '字体加载期间出现同名文字样式')
        continue
      }
      const style = figma.createTextStyle()
      createdStyle = style
      style.name = c.targetName
      style.fontName = { family: c.fontFamily, style: c.fontStyle }
      style.fontSize = c.fontSize
      style.lineHeight = c.lineHeightPx === null || c.lineHeightPx === 0 ? { unit: 'AUTO' } : { unit: 'PIXELS', value: c.lineHeightPx }
      style.letterSpacing = { unit: 'PIXELS', value: c.letterSpacingPx }
      currentAudit?.localTextStyles.push(style)

      if (!collection) {
        const collectionName = currentAudit?.summary.typographyCollectionName ?? TYPOGRAPHY_COLLECTION
        const existingCollection = currentAudit?.localCollections.find(item => item.name === collectionName) ?? null
        collection = getOrCreateCollection(collectionName)
        if (!existingCollection) createdCollection = collection
      }
      const variables: Array<[string, VariableValue, VariableResolvedDataType]> = [
        [`${c.targetName}/font-size`, c.fontSize, 'FLOAT'],
        [`${c.targetName}/font-weight`, c.fontWeight, 'FLOAT'],
        [`${c.targetName}/font-family`, c.fontFamily, 'STRING'],
        [`${c.targetName}/line-height`, c.lineHeightPx === null || c.lineHeightPx === 0 ? 'auto' : c.lineHeightPx, c.lineHeightPx === null || c.lineHeightPx === 0 ? 'STRING' : 'FLOAT'],
        [`${c.targetName}/letter-spacing`, c.letterSpacingPx, 'FLOAT'],
      ]
      for (const [name, value, type] of variables) {
        const existingVariable = currentAudit?.localVariables.find(variable => variable.variableCollectionId === collection!.id && variable.name === name) ?? null
        const variable = createOrReuseVariable(name, value, type, collection)
        if (!variable) throw new Error(`变量 ${name} 创建失败或同名冲突`)
        if (!existingVariable) createdVariables.push(variable)
      }
      outcome.resourceReady = true
      byKey.set(c.valueKey, style)
    } catch (error) {
      for (const variable of createdVariables) {
        try {
          variable.remove()
        } catch {
          // Rollback is best effort and never touches reused variables.
        }
      }
      if (createdVariables.length > 0 && currentAudit) {
        const createdIds = new Set(createdVariables.map(variable => variable.id))
        currentAudit.localVariables = currentAudit.localVariables.filter(variable => !createdIds.has(variable.id))
      }
      if (createdStyle) {
        try {
          createdStyle.remove()
        } catch {
          // Rollback is best effort and never touches reused styles.
        }
        if (currentAudit) currentAudit.localTextStyles = currentAudit.localTextStyles.filter(style => style.id !== createdStyle?.id)
      }
      if (createdCollection) {
        try {
          createdCollection.remove()
        } catch {
          // The collection is harmless if Figma refuses to remove it.
        }
        if (currentAudit) currentAudit.localCollections = currentAudit.localCollections.filter(item => item.id !== createdCollection?.id)
        collection = null
      }
      outcome.resourceReady = false
      addOutcomeError(outcome, error instanceof Error ? error.message : '字体不可用或文字样式创建失败')
    }
  }
  for (const c of candidates) {
    const outcome = outcomes.get(c.id)!
    const style = byKey.get(c.valueKey)
    if (!style) continue
    const processed = new Set<string>()
    for (const ref of c.refs) {
      if (ref.group !== 'typography') continue
      if (processed.has(ref.nodeId)) continue
      processed.add(ref.nodeId)
      const node = getNode(ref.nodeId)
      if (node?.type !== 'TEXT' || node.fontName === figma.mixed || typeof node.fontSize !== 'number') {
        addOutcomeError(outcome, '待绑定文字图层已不存在或属性已混合')
        continue
      }
      const currentWeight = styleToNumericWeight(node.fontName.style)
      if (typographySignature(node.fontName.family, node.fontSize, currentWeight, node.fontName.style) !== c.valueKey) {
        addOutcomeError(outcome, '文字属性已变化，已跳过绑定')
        continue
      }
      try {
        await node.setTextStyleIdAsync(style.id)
        outcome.boundBindings++
      } catch {
        addOutcomeError(outcome, '文字样式绑定失败')
      }
    }
  }
  return outcomes
}
async function applyRadius(candidates: RadiusCandidate[], selectedNodes: readonly SceneNode[]): Promise<Map<string, ApplyCandidateOutcome>> {
  let collection: VariableCollection | null = null
  const byKey = new Map<string, Variable>()
  const outcomes = new Map<string, ApplyCandidateOutcome>()
  for (const c of candidates) {
    const outcome = makeOutcome()
    outcomes.set(c.id, outcome)
    if (c.status === 'new') collection = collection ?? getOrCreateCollection(currentAudit?.summary.radiusCollectionName ?? RADIUS_COLLECTION)
    const v = c.status === 'new'
      ? createOrReuseVariable(c.targetName, c.value, 'FLOAT', collection!)
      : currentAudit?.localVariables.find(v => v.name === c.targetName && v.resolvedType === 'FLOAT') ?? null
    if (v) {
      byKey.set(c.valueKey, v)
      outcome.resourceReady = true
    } else addOutcomeError(outcome, '圆角变量不存在或发生同名冲突')
  }
  for (const node of selectedNodes) {
    for (const item of radiusPropertiesForNode(node)) {
      const v = byKey.get(String(item.value))
      if (!v) continue
      const candidate = candidates.find(c => c.valueKey === String(item.value))
      if (!candidate) continue
      const outcome = outcomes.get(candidate.id)!
      for (const property of item.properties) {
        outcome.expectedBindings++
        try {
          node.setBoundVariable(property, v)
          outcome.boundBindings++
        } catch {
          addOutcomeError(outcome, '圆角变量绑定失败')
        }
      }
    }
  }
  return outcomes
}
async function applyGroup(group: TokenGroup): Promise<void> {
  if (!currentProposal) return
  if (!proposalSelectionIsCurrent(currentProposal)) {
    currentProposal = null
    figma.notify('选区已变化，请重新提取候选', { error: true })
    return
  }
  const intended = currentProposal.groups[group].filter(c => c.status === 'match' || (c.status === 'new' && c.selected !== false))
  const intendedState = new Map(intended.map(candidate => [candidate.id, `${candidate.status}:${candidate.targetName}`]))
  const freshAudit = await auditLibraries()
  if (!currentProposal || !proposalSelectionIsCurrent(currentProposal)) {
    currentProposal = null
    figma.notify('检查期间选区发生变化，请重新提取候选', { error: true })
    return
  }
  currentAudit = freshAudit
  reclassifyGroup(group, freshAudit)
  const libraryChanged = intended.some(candidate => {
    const refreshed = currentProposal?.groups[group].find(item => item.id === candidate.id)
    return !refreshed || intendedState.get(candidate.id) !== `${refreshed.status}:${refreshed.targetName}`
  })
  if (libraryChanged) {
    figma.notify('设计库状态已变化，请审核更新后的候选后再提交', { error: true })
    return
  }
  const proposal = currentProposal
  const selectedNodes = currentSelection()
  if (!proposal || !sameOrderedIds(proposal.selectionIds, selectionIds(selectedNodes))) {
    currentProposal = null
    figma.notify('提交前选区发生变化，请重新提取候选', { error: true })
    return
  }
  const candidates = proposal.groups[group].filter((c): c is Extract<TokenCandidate, { group: typeof group }> => {
    if (c.status === 'match') return true
    return c.status === 'new' && c.selected !== false
  }) as TokenCandidate[]
  if (candidates.length === 0) {
    figma.notify('没有可添加或绑定的 token')
    return
  }
  let outcomes = new Map<string, ApplyCandidateOutcome>()
  if (group === 'colors') outcomes = await applyColors(candidates as ColorCandidate[])
  if (group === 'typography') outcomes = await applyTypography(candidates as TypographyCandidate[])
  if (group === 'radius') outcomes = await applyRadius(candidates as RadiusCandidate[], selectedNodes)
  let completed = 0
  proposal.groups[group] = proposal.groups[group].map(candidate => {
    const outcome = outcomes.get(candidate.id)
    if (!outcome) return candidate
    if (isCompleteOutcome(outcome)) {
      completed++
      return {
        ...candidate,
        status: 'applied',
        reason: candidate.status === 'match' ? '已复用匹配项并完成绑定' : '已添加并完成绑定',
      } as TokenCandidate
    }
    const bindingDetail = outcome.expectedBindings > 0 ? `绑定 ${outcome.boundBindings}/${outcome.expectedBindings}` : '无需绑定当前图层'
    const errorDetail = outcome.errors.length ? outcome.errors.join('；') : '提交未完成'
    return { ...candidate, reason: `${bindingDetail}；${errorDetail}` } as TokenCandidate
  })
  proposal.summaries = summarizeProposal(proposal.groups)
  currentAudit = await auditLibraries()
  const failed = candidates.length - completed
  figma.notify(failed > 0 ? `${group}：完成 ${completed} 个，未完成 ${failed} 个` : `${group}：已完成 ${completed} 个 token`, failed > 0 ? { error: true } : undefined)
}

async function buildExportPayload(): Promise<{
  colors: Record<string, string>
  typography: Record<string, number | string>
  radius: Record<string, number>
}> {
  const allVars = await figma.variables.getLocalVariablesAsync()
  const allCols = await figma.variables.getLocalVariableCollectionsAsync()
  const colorCol = allCols.find(c => c.name === (currentAudit?.summary.colorCollectionName ?? COLOR_COLLECTION))
  const typographyCol = allCols.find(c => c.name === (currentAudit?.summary.typographyCollectionName ?? TYPOGRAPHY_COLLECTION))
  const radiusCol = allCols.find(c => c.name === (currentAudit?.summary.radiusCollectionName ?? RADIUS_COLLECTION))
  const colors: Record<string, string> = {}
  const typography: Record<string, number | string> = {}
  const radius: Record<string, number> = {}
  for (const v of allVars) {
    const col = allCols.find(c => c.id === v.variableCollectionId)
    if (!col) continue
    const val = resolveVariableValue(v.valuesByMode[col.defaultModeId], allVars, allCols)
    if (colorCol && v.variableCollectionId === colorCol.id) colors[v.name] = colorValueToString(val, true)
    else if (typographyCol && v.variableCollectionId === typographyCol.id) typography[v.name] = typeof val === 'number' ? val : String(val)
    else if (radiusCol && v.variableCollectionId === radiusCol.id) radius[v.name] = typeof val === 'number' ? val : 0
  }
  return { colors, typography, radius }
}
function tokensToJson(payload: { colors: Record<string, string>; typography: Record<string, number | string>; radius: Record<string, number> }): string {
  return JSON.stringify(payload, null, 2)
}
function tokensToCSS(payload: { colors: Record<string, string>; typography: Record<string, number | string>; radius: Record<string, number> }): string {
  const lines: string[] = [':root {']
  for (const [key, val] of Object.entries(payload.colors)) lines.push(`  --${key.replace(/\//g, '-')}: ${val};`)
  for (const [key, val] of Object.entries(payload.typography)) {
    const cssVal = typeof val === 'number' ? `${val}${key.includes('size') || key.includes('height') || key.includes('spacing') ? 'px' : ''}` : val
    lines.push(`  --${key.replace(/\//g, '-')}: ${cssVal};`)
  }
  for (const [key, val] of Object.entries(payload.radius)) lines.push(`  --${key.replace(/\//g, '-')}: ${val}px;`)
  lines.push('}')
  return lines.join('\n')
}
async function runExport(format: ExportFormat): Promise<void> {
  const payload = await buildExportPayload()
  const totalVars = Object.keys(payload.colors).length + Object.keys(payload.typography).length + Object.keys(payload.radius).length
  if (totalVars === 0) {
    figma.notify('暂无已提交 token，请先添加一组 token', { error: true })
    return
  }
  figma.ui.postMessage({ type: 'download', format, content: format === 'css' ? tokensToCSS(payload) : tokensToJson(payload) })
}

figma.root.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME })
figma.showUI(__html__, { width: 420, height: 640 })
figma.on('selectionchange', () => {
  if (currentProposal && !proposalSelectionIsCurrent(currentProposal)) {
    currentProposal = null
    figma.notify('选区已变化，请重新提取候选')
  }
  postState()
})
postState()

figma.ui.onmessage = (msg: UiMsg) => {
  void (async () => {
    if (msg.type === 'resize') {
      figma.ui.resize(420, Math.max(320, Math.min(900, Math.round(msg.height))))
      return
    }
    if (isExecuting) return
    isExecuting = true
    activeAction = msg.type === 'audit'
      ? 'audit'
      : msg.type === 'extract-preview'
        ? 'preview'
        : msg.type === 'apply-group'
          ? `apply-${msg.group}`
          : msg.type === 'export'
            ? 'export'
            : null
    postState()
    try {
      if (msg.type === 'audit') {
        currentAudit = await auditLibraries()
        currentProposal = null
      } else if (msg.type === 'extract-preview') {
        if (figma.currentPage.selection.length === 0) {
          figma.notify('请先选中至少一个图层或 Frame', { error: true })
        } else {
          currentProposal = await buildProposal()
        }
      } else if (msg.type === 'rename-token') {
        renameCandidate(msg.group, msg.id, msg.targetName)
      } else if (msg.type === 'toggle-token-selection') {
        toggleCandidateSelection(msg.group, msg.id, msg.selected)
      } else if (msg.type === 'apply-group') {
        await applyGroup(msg.group)
      } else if (msg.type === 'export') {
        await runExport(msg.format)
      }
    } catch (error) {
      figma.notify(error instanceof Error ? error.message : String(error), { error: true })
    } finally {
      isExecuting = false
      activeAction = null
      postState()
    }
  })()
}
