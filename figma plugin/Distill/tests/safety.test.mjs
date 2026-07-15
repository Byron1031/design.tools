import assert from 'node:assert/strict'
import test from 'node:test'
import { isCompleteOutcome, sameOrderedIds, typographyStyleVariant, visibleGradientIndex } from '../safety.ts'

test('selection snapshots require the same ids in the same order', () => {
  assert.equal(sameOrderedIds(['1', '2'], ['1', '2']), true)
  assert.equal(sameOrderedIds(['1', '2'], ['2', '1']), false)
  assert.equal(sameOrderedIds(['1'], ['1', '2']), false)
})

test('a visible gradient owns the whole paint property', () => {
  assert.equal(visibleGradientIndex([{ type: 'SOLID' }, { type: 'GRADIENT_LINEAR' }]), 1)
  assert.equal(visibleGradientIndex([{ type: 'GRADIENT_LINEAR', visible: false }, { type: 'SOLID' }]), -1)
})

test('an apply outcome is complete only after every intended binding succeeds', () => {
  assert.equal(isCompleteOutcome({ resourceReady: true, expectedBindings: 2, boundBindings: 2, errors: [] }), true)
  assert.equal(isCompleteOutcome({ resourceReady: true, expectedBindings: 2, boundBindings: 1, errors: [] }), false)
  assert.equal(isCompleteOutcome({ resourceReady: true, expectedBindings: 0, boundBindings: 0, errors: ['create failed'] }), false)
  assert.equal(isCompleteOutcome({ resourceReady: false, expectedBindings: 0, boundBindings: 0, errors: [] }), false)
})

test('typography style variants distinguish upright, italic, and oblique faces', () => {
  assert.equal(typographyStyleVariant('Medium'), 'normal')
  assert.equal(typographyStyleVariant('500'), 'normal')
  assert.equal(typographyStyleVariant('Medium Italic'), 'italic')
  assert.equal(typographyStyleVariant('Medium Oblique'), 'oblique')
  assert.equal(typographyStyleVariant('Medium Condensed Italic'), 'condenseditalic')
})
