type TokenGroup = 'colors' | 'typography' | 'radius'
type TokenStatus = 'match' | 'new' | 'conflict' | 'invalid' | 'skip' | 'applied'
type ExportFormat = 'json' | 'css'
type TokenColor = { r: number; g: number; b: number; a: number }
type BindingRef =
  | { group: 'colors'; nodeId: string; property: 'fills' | 'strokes'; paintIndex: number; key: string }
  | { group: 'typography'; nodeId: string; key: string }
  | { group: 'radius'; nodeId: string; key: string }

type BaseCandidate = {
  id: string
  group: TokenGroup
  status: TokenStatus
  suggestedName: string
  targetName: string
  reason?: string
  refs: BindingRef[]
}
type ColorCandidate = BaseCandidate & {
  group: 'colors'
  value: TokenColor
  valueKey: string
  hex: string
}
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
  localTypographyVariables: number
  localTextStyles: number
  localComponents: number
  remoteComponents: number
  remoteStyles: number
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
  localTextStyles: TextStyle[]
  typographyStylesBySignature: Map<string, TypographyStyleRecord>
  typographyTemplates: TypographyNameTemplate[]
  typographyUsesMultiLayerNames: boolean
  remoteVariables: Array<{ name: string; resolvedType: VariableResolvedDataType; collectionName: string }>
  remoteStyleNames: string[]
  localComponentNames: string[]
  remoteComponentNames: string[]
  namesByGroup: Record<TokenGroup, Set<string>>
  valueNamesByGroup: Record<TokenGroup, Map<string, string>>
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
type Proposal = {
  audit: AuditSummary
  groups: Record<TokenGroup, TokenCandidate[]>
  summaries: Record<TokenGroup, GroupSummary>
}
type ActiveAction = 'audit' | 'preview' | 'export' | `apply-${TokenGroup}` | null

type UiMsg =
  | { type: 'resize'; height: number }
  | { type: 'audit' }
  | { type: 'extract-preview' }
  | { type: 'rename-token'; group: TokenGroup; id: string; targetName: string }
  | { type: 'apply-group'; group: TokenGroup }
  | { type: 'export'; format: ExportFormat }

const TOOL_ID = '9c676d1a-bbdf-48b8-8f4d-682bee3d9ac7'
const DISPLAY_NAME = 'Distill'
const COLOR_COLLECTION = 'Colors'
const TYPOGRAPHY_COLLECTION = 'Typography'
const RADIUS_COLLECTION = 'Radius'
const ALPHA_STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90]
const FRAME_COLOR_NAME = '🎨 Colors'
const FRAME_FONT_NAME = '🎨 Typography'
const FRAME_RADIUS_NAME = '🎨 Radius'

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
function colorKey(c: TokenColor): string {
  return `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${Math.round(c.a * 100)}`
}
function hexColor(c: TokenColor): string {
  const hex = rgbToHex(c.r, c.g, c.b)
  if (c.a < 0.999) return `#${hex}${Math.round(c.a * 255).toString(16).padStart(2, '0')}`
  return `#${hex}`
}
function solidPaint(c: TokenColor): SolidPaint {
  return { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }
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
function weightLabel(fontStyle: string, fontWeight: number): string {
  const normalized = normalizeWeightName(fontStyle)
  if (normalized.startsWith('w') && /^w\d+$/.test(normalized)) return normalized
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}
function typographySignature(fontFamily: string, fontSize: number, fontWeight: number): string {
  return `${cleanKey(fontFamily)}|${round2(fontSize)}|${fontWeight}`
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
    signature: typographySignature(style.fontName.family, style.fontSize, fontWeight),
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

async function auditLibraries(): Promise<LibraryAudit> {
  const localCollections = await figma.variables.getLocalVariableCollectionsAsync()
  const localVariables = await figma.variables.getLocalVariablesAsync()
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
  const styleNodes = figma.currentPage.findAll()
  function addStyleId(value: unknown): void {
    if (typeof value === 'string' && value) styleIds.add(value)
  }
  for (const node of styleNodes) {
    if ('fillStyleId' in node) addStyleId(node.fillStyleId)
    if ('strokeStyleId' in node) addStyleId(node.strokeStyleId)
    if ('textStyleId' in node) addStyleId(node.textStyleId)
    if ('effectStyleId' in node) addStyleId(node.effectStyleId)
    if ('boundVariables' in node) collectVariableAliasIds(node.boundVariables, boundVariableIds)
  }
  const remoteStyleNames: string[] = []
  const remoteTextStyleRecords: TypographyStyleRecord[] = []
  for (const id of styleIds) {
    try {
      const style = await figma.getStyleByIdAsync(id)
      if (style?.remote) remoteStyleNames.push(style.name)
      if (style?.remote && style.type === 'TEXT') remoteTextStyleRecords.push(typographyRecordFromStyle(style))
      if (style && 'boundVariables' in style) collectVariableAliasIds(style.boundVariables, boundVariableIds)
    } catch {
      // Style lookup can fail for deleted or unavailable remote styles.
    }
  }

  const remoteVariables: Array<{ name: string; resolvedType: VariableResolvedDataType; collectionName: string }> = []
  const remoteAvailableVariables: Array<{ name: string; resolvedType: VariableResolvedDataType; collectionName: string }> = []
  const remoteBoundVariables: Array<{ name: string; resolvedType: VariableResolvedDataType; collectionName: string }> = []
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
  const typographyUsesMultiLayerNames = typographyTemplates.some(template => template.multiLayer)
  for (const v of localVariables) {
    const col = localCollections.find(c => c.id === v.variableCollectionId)
    if (!col) continue
    const val = resolveVariableValue(v.valuesByMode[col.defaultModeId], localVariables, localCollections)
    if (v.resolvedType === 'COLOR') valueNamesByGroup.colors.set(colorValueToString(val, true), v.name)
    if (v.resolvedType === 'FLOAT' && v.name.toLowerCase().includes('radius') && typeof val === 'number') valueNamesByGroup.radius.set(String(val), v.name)
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
  const remoteTypographyVariables = uniqueRemoteVariables.filter(v => v.resolvedType !== 'COLOR').length
  const remoteAvailableColorVariables = uniqueRemoteAvailableVariables.filter(v => v.resolvedType === 'COLOR').length
  const remoteAvailableTypographyVariables = uniqueRemoteAvailableVariables.filter(v => v.resolvedType !== 'COLOR').length
  const remoteBoundColorVariables = uniqueRemoteBoundVariables.filter(v => v.resolvedType === 'COLOR').length
  const remoteBoundTypographyVariables = uniqueRemoteBoundVariables.filter(v => v.resolvedType !== 'COLOR').length
  const summary: AuditSummary = {
    localCollections: localCollections.length,
    localVariables: localVariables.length,
    localColorVariables,
    localTypographyVariables,
    localTextStyles: localTextStyles.length,
    localComponents: localComponentNames.length,
    remoteComponents: remoteComponentNames.size,
    remoteStyles: remoteStyleNames.length,
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
    localTextStyles,
    typographyStylesBySignature,
    typographyTemplates,
    typographyUsesMultiLayerNames,
    remoteVariables: uniqueRemoteVariables,
    remoteStyleNames,
    localComponentNames,
    remoteComponentNames: [...remoteComponentNames],
    namesByGroup,
    valueNamesByGroup,
    colorPrefix: mostCommonPrefix(colorNames, 'color'),
    radiusPrefix: mostCommonPrefix(radiusNames, 'radius'),
  }
}

function suggestColorName(audit: LibraryAudit, c: TokenColor): string {
  const existing = audit.valueNamesByGroup.colors.get(hexColor(c))
  if (existing) return existing
  const hex = rgbToHex(c.r, c.g, c.b)
  if (c.a < 0.999) return `${audit.colorPrefix}/${hex}-alpha-${Math.round(c.a * 100)}`
  return `${audit.colorPrefix}/${hex}`
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
function suggestTypographyName(
  audit: LibraryAudit,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  fontStyle: string,
  families: Set<string>
): string {
  const fallback = defaultTypographyName(fontSize, fontWeight, fontStyle, families, fontFamily)
  const template = nearestTypographyTemplate(audit, fontFamily, fontSize, fontWeight)
  if (!template) return fallback
  const desiredRole = roleToStyleName(classifyStyle(fontSize, fontWeight))
  const desiredRoleFamily = roleFamily(desiredRole)
  const roleSegments = template.roleFamily === desiredRoleFamily ? template.roleSegments : [desiredRole]
  const segments = [...template.prefixSegments, ...roleSegments]
  if (template.weightIndex !== null) segments.push(weightLabel(fontStyle, fontWeight))
  return segments.join('/')
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
    for (const candidate of group) candidate.targetName = `${candidate.targetName}/${formatSizeName(candidate.fontSize)}`
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
    for (const candidate of group) candidate.targetName = `${candidate.targetName}/${weightLabel(candidate.fontStyle, candidate.fontWeight)}`
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
  return {
    colors: groups.colors,
    typography: [...typography].sort((a, b) => {
      if (b.fontSize !== a.fontSize) return b.fontSize - a.fontSize
      if (b.fontWeight !== a.fontWeight) return b.fontWeight - a.fontWeight
      return a.targetName.localeCompare(b.targetName)
    }),
    radius: groups.radius,
  }
}

function collectSelectionCandidates(audit: LibraryAudit): Record<TokenGroup, TokenCandidate[]> {
  const frames = figma.currentPage.selection.filter((n): n is FrameNode => n.type === 'FRAME')
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
  for (const frame of frames) collectTextFamilyGroups(frame)

  function collect(node: SceneNode): void {
    if ('fills' in node && Array.isArray(node.fills)) {
      node.fills.forEach((paint, paintIndex) => {
        if (paint.type !== 'SOLID' || paint.visible === false) return
        const value = { ...paint.color, a: paint.opacity ?? 1 }
        const key = colorKey(value)
        const existing = colors.get(key)
        const ref: BindingRef = { group: 'colors', nodeId: node.id, property: 'fills', paintIndex, key }
        if (existing) existing.refs.push(ref)
        else {
          const suggestedName = suggestColorName(audit, value)
          const candidate: ColorCandidate = {
            id: `color:${key}`,
            group: 'colors',
            status: 'new',
            suggestedName,
            targetName: suggestedName,
            value,
            valueKey: key,
            hex: hexColor(value),
            refs: [ref],
          }
          colors.set(key, classifyCandidate(candidate, audit, value))
        }
      })
    }
    if ('strokes' in node && Array.isArray(node.strokes)) {
      node.strokes.forEach((paint, paintIndex) => {
        if (paint.type !== 'SOLID' || paint.visible === false) return
        const value = { ...paint.color, a: paint.opacity ?? 1 }
        const key = colorKey(value)
        const existing = colors.get(key)
        const ref: BindingRef = { group: 'colors', nodeId: node.id, property: 'strokes', paintIndex, key }
        if (existing) existing.refs.push(ref)
        else {
          const suggestedName = suggestColorName(audit, value)
          const candidate: ColorCandidate = {
            id: `color:${key}`,
            group: 'colors',
            status: 'new',
            suggestedName,
            targetName: suggestedName,
            value,
            valueKey: key,
            hex: hexColor(value),
            refs: [ref],
          }
          colors.set(key, classifyCandidate(candidate, audit, value))
        }
      })
    }
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
      const key = typographySignature(fontName.family, node.fontSize, fontWeight)
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
    if ('cornerRadius' in node && typeof node.cornerRadius === 'number' && node.cornerRadius > 0 && node.cornerRadius === Math.round(node.cornerRadius)) {
      const w = 'width' in node ? node.width : 0
      const h = 'height' in node ? node.height : 0
      const value = node.cornerRadius
      if (w >= 32 && h >= 32) {
        const key = String(value)
        const existing = radius.get(key)
        const ref: BindingRef = { group: 'radius', nodeId: node.id, key }
        if (existing) existing.refs.push(ref)
        else {
          const suggestedName = suggestRadiusName(audit, value)
          const candidate: RadiusCandidate = {
            id: `radius:${key}`,
            group: 'radius',
            status: 'new',
            suggestedName,
            targetName: suggestedName,
            value,
            valueKey: key,
            refs: [ref],
          }
          radius.set(key, classifyCandidate(candidate, audit, value))
        }
      }
    }
    if ('children' in node) for (const child of node.children) collect(child)
  }
  for (const frame of frames) collect(frame)
  return sortCandidateGroups(validateDuplicates({ colors: [...colors.values()], typography: [...typography.values()], radius: [...radius.values()] }, audit))
}

async function buildProposal(): Promise<Proposal> {
  const audit = currentAudit ?? await auditLibraries()
  currentAudit = audit
  const groups = collectSelectionCandidates(audit)
  return { audit: audit.summary, groups, summaries: summarizeProposal(groups) }
}
function postState(extra?: Record<string, unknown>): void {
  figma.ui.postMessage({
    type: 'state',
    isExecuting,
    activeAction,
    hasSelection: figma.currentPage.selection.some(n => n.type === 'FRAME'),
    audit: currentAudit?.summary ?? null,
    proposal: currentProposal,
    ...extra,
  })
}
function findCandidate(group: TokenGroup, id: string): TokenCandidate | null {
  return currentProposal?.groups[group].find(c => c.id === id) ?? null
}
function renameCandidate(group: TokenGroup, id: string, targetName: string): void {
  if (!currentProposal || !currentAudit) return
  const candidates = currentProposal.groups[group].map(c => {
    if (c.id !== id || (c.status !== 'new' && c.status !== 'invalid')) return c
    return { ...c, targetName: normalizeName(targetName), status: 'new', reason: undefined } as TokenCandidate
  })
  currentProposal.groups[group] = validateDuplicates({ ...currentProposal.groups, [group]: candidates }, currentAudit)[group]
  currentProposal.groups = sortCandidateGroups(currentProposal.groups)
  currentProposal.summaries = summarizeProposal(currentProposal.groups)
}
function getOrCreateCollection(name: string): VariableCollection {
  const existing = currentAudit?.localCollections.find(c => c.name === name)
  return existing ?? figma.variables.createVariableCollection(name)
}
function getNode(id: string): SceneNode | null {
  const node = figma.getNodeById(id)
  return node && 'type' in node ? node as SceneNode : null
}
function upsertVariable(name: string, value: VariableValue, type: VariableResolvedDataType, collection: VariableCollection): Variable | null {
  const existing = currentAudit?.localVariables.find(v => v.variableCollectionId === collection.id && v.name === name)
  if (existing) {
    if (existing.resolvedType !== type) return null
    try {
      existing.setValueForMode(collection.defaultModeId, value)
      return existing
    } catch {
      return null
    }
  }
  try {
    const v = figma.variables.createVariable(name, collection, type)
    v.setValueForMode(collection.defaultModeId, value)
    return v
  } catch {
    return null
  }
}
async function applyColors(candidates: ColorCandidate[]): Promise<number> {
  const collection = getOrCreateCollection(currentAudit?.summary.colorCollectionName ?? COLOR_COLLECTION)
  const byKey = new Map<string, Variable>()
  for (const c of candidates) {
    const v = c.status === 'new'
      ? upsertVariable(c.targetName, { r: c.value.r, g: c.value.g, b: c.value.b, a: c.value.a }, 'COLOR', collection)
      : currentAudit?.localVariables.find(v => v.name === c.targetName && v.resolvedType === 'COLOR') ?? null
    if (v) byKey.set(c.valueKey, v)
  }
  for (const c of candidates) {
    const v = byKey.get(c.valueKey)
    if (!v) continue
    for (const ref of c.refs) {
      if (ref.group !== 'colors') continue
      const node = getNode(ref.nodeId)
      if (!node || !(ref.property in node)) continue
      const paints = (ref.property === 'fills' && 'fills' in node ? node.fills : ref.property === 'strokes' && 'strokes' in node ? node.strokes : []) as readonly Paint[]
      const nextPaints = paints.slice()
      const paint = paints[ref.paintIndex]
      if (!paint || paint.type !== 'SOLID') continue
      nextPaints[ref.paintIndex] = figma.variables.setBoundVariableForPaint(paint, 'color', v)
      try {
        if (ref.property === 'fills' && 'fills' in node) node.fills = nextPaints
        if (ref.property === 'strokes' && 'strokes' in node) node.strokes = nextPaints
      } catch {
        // Binding is best effort; creation remains valid even when a node cannot be mutated.
      }
    }
  }
  return byKey.size
}
async function applyTypography(candidates: TypographyCandidate[]): Promise<number> {
  const collection = getOrCreateCollection(currentAudit?.summary.typographyCollectionName ?? TYPOGRAPHY_COLLECTION)
  const existingStyles = await figma.getLocalTextStylesAsync()
  const byKey = new Map<string, TextStyle>()
  for (const c of candidates) {
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
      if (matched) byKey.set(c.valueKey, matched)
      continue
    }
    upsertVariable(`${c.targetName}/font-size`, c.fontSize, 'FLOAT', collection)
    upsertVariable(`${c.targetName}/font-weight`, c.fontWeight, 'FLOAT', collection)
    upsertVariable(`${c.targetName}/font-family`, c.fontFamily, 'STRING', collection)
    if (c.lineHeightPx === null || c.lineHeightPx === 0) upsertVariable(`${c.targetName}/line-height`, 'auto', 'STRING', collection)
    else upsertVariable(`${c.targetName}/line-height`, c.lineHeightPx, 'FLOAT', collection)
    upsertVariable(`${c.targetName}/letter-spacing`, c.letterSpacingPx, 'FLOAT', collection)

    let style = existingStyles.find(s => s.name === c.targetName)
    try {
      await figma.loadFontAsync({ family: c.fontFamily, style: c.fontStyle })
      if (!style) {
        style = figma.createTextStyle()
        style.name = c.targetName
      }
      style.fontName = { family: c.fontFamily, style: c.fontStyle }
      style.fontSize = c.fontSize
      style.lineHeight = c.lineHeightPx === null || c.lineHeightPx === 0 ? { unit: 'AUTO' } : { unit: 'PIXELS', value: c.lineHeightPx }
      style.letterSpacing = { unit: 'PIXELS', value: c.letterSpacingPx }
      byKey.set(c.valueKey, style)
    } catch {
      // Font unavailable; keep the proposal unresolved.
    }
  }
  for (const c of candidates) {
    const style = byKey.get(c.valueKey)
    if (!style) continue
    for (const ref of c.refs) {
      if (ref.group !== 'typography') continue
      const node = getNode(ref.nodeId)
      if (node?.type !== 'TEXT') continue
      try {
        await node.setTextStyleIdAsync(style.id)
      } catch {
        // Best effort binding.
      }
    }
  }
  return byKey.size
}
async function applyRadius(candidates: RadiusCandidate[]): Promise<number> {
  const collection = getOrCreateCollection(currentAudit?.summary.radiusCollectionName ?? RADIUS_COLLECTION)
  const byKey = new Map<string, Variable>()
  for (const c of candidates) {
    const v = c.status === 'new'
      ? upsertVariable(c.targetName, c.value, 'FLOAT', collection)
      : currentAudit?.localVariables.find(v => v.name === c.targetName && v.resolvedType === 'FLOAT') ?? null
    if (v) byKey.set(c.valueKey, v)
  }
  for (const c of candidates) {
    const v = byKey.get(c.valueKey)
    if (!v) continue
    for (const ref of c.refs) {
      if (ref.group !== 'radius') continue
      const node = getNode(ref.nodeId)
      if (!node || !('cornerRadius' in node)) continue
      try {
        node.setBoundVariable('topLeftRadius', v)
        node.setBoundVariable('topRightRadius', v)
        node.setBoundVariable('bottomLeftRadius', v)
        node.setBoundVariable('bottomRightRadius', v)
      } catch {
        // Best effort binding.
      }
    }
  }
  return byKey.size
}
async function applyGroup(group: TokenGroup): Promise<void> {
  if (!currentProposal) return
  const candidates = currentProposal.groups[group].filter((c): c is Extract<TokenCandidate, { group: typeof group }> => c.status === 'new' || c.status === 'match') as TokenCandidate[]
  if (candidates.length === 0) {
    figma.notify('没有可添加或绑定的 token')
    return
  }
  let applied = 0
  if (group === 'colors') applied = await applyColors(candidates as ColorCandidate[])
  if (group === 'typography') applied = await applyTypography(candidates as TypographyCandidate[])
  if (group === 'radius') applied = await applyRadius(candidates as RadiusCandidate[])
  currentProposal.groups[group] = currentProposal.groups[group].map(c => candidates.some(a => a.id === c.id) ? { ...c, status: 'applied', reason: c.status === 'match' ? '已复用本地匹配项并绑定' : '已添加并绑定' } as TokenCandidate : c)
  currentProposal.summaries = summarizeProposal(currentProposal.groups)
  currentAudit = await auditLibraries()
  figma.notify(`已添加 ${applied} 个 ${group} token 并尝试绑定`)
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
figma.on('selectionchange', () => postState())
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
        if (!figma.currentPage.selection.some(n => n.type === 'FRAME')) {
          figma.notify('请先选中至少一个 Frame', { error: true })
        } else {
          currentProposal = await buildProposal()
        }
      } else if (msg.type === 'rename-token') {
        renameCandidate(msg.group, msg.id, msg.targetName)
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
