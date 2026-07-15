export type ApplyCandidateOutcome = {
  resourceReady: boolean
  expectedBindings: number
  boundBindings: number
  errors: string[]
}

type PaintDescriptor = {
  type: string
  visible?: boolean
}

const GRADIENT_TYPES = new Set([
  'GRADIENT_LINEAR',
  'GRADIENT_RADIAL',
  'GRADIENT_ANGULAR',
  'GRADIENT_DIAMOND',
])

const FONT_WEIGHT_TOKENS = [
  'ultralight',
  'extralight',
  'demibold',
  'semibold',
  'ultrabold',
  'extrabold',
  'regular',
  'medium',
  'hairline',
  'thin',
  'light',
  'bold',
  'black',
  'heavy',
]

export function sameOrderedIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

export function visibleGradientIndex(paints: readonly PaintDescriptor[]): number {
  return paints.findIndex(paint => paint.visible !== false && GRADIENT_TYPES.has(paint.type))
}

export function typographyStyleVariant(fontStyle: string): string {
  let variant = fontStyle.toLowerCase().replace(/[\s_-]+/g, '').replace(/\d+/g, '')
  for (const token of FONT_WEIGHT_TOKENS) variant = variant.split(token).join('')
  return variant || 'normal'
}

export function isCompleteOutcome(outcome: ApplyCandidateOutcome): boolean {
  return outcome.resourceReady && outcome.boundBindings === outcome.expectedBindings && outcome.errors.length === 0
}
