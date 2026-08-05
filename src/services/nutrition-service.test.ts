import { describe, expect, it } from 'vitest'
import { foodUsageCountsFromRecords, foodUsageDocumentId, foodUsageKey, sanitizeFoodOverrideChanges } from './nutrition-service'

describe('food usage aggregates', () => {
  it('keeps public and private foods with the same id separate', () => {
    const counts = foodUsageCountsFromRecords([
      { foodId: '42', foodSource: 'public', usageCount: 3 },
      { foodId: '42', foodSource: 'private', usageCount: 2 },
    ])

    expect(counts[foodUsageKey('public', '42')]).toBe(3)
    expect(counts[foodUsageKey('private', '42')]).toBe(2)
    expect(counts['42']).toBe(5)
  })

  it('ignores malformed or non-positive aggregate counts', () => {
    const counts = foodUsageCountsFromRecords([
      { foodId: 'valid', foodSource: 'public', usageCount: 2.9 },
      { foodId: 'zero', foodSource: 'private', usageCount: 0 },
      { foodId: 'negative', foodSource: 'private', usageCount: -1 },
      { foodId: 'nan', foodSource: 'public', usageCount: 'not-a-number' },
      { foodSource: 'public', usageCount: 1 },
    ])

    expect(counts).toEqual({ 'public:valid': 2, valid: 2 })
  })

  it('uses a deterministic document id safe for food ids containing a slash', () => {
    expect(foodUsageDocumentId('user/a', 'public', 'food/a')).toBe('usage_user%2Fa_public_food%2Fa')
  })
})

describe('personalização de alimento público', () => {
  it('mantém somente os campos autorizados pelas regras', () => {
    expect(sanitizeFoodOverrideChanges({
      name: 'Nome pessoal',
      calories: 120,
      isHidden: true,
      baseUnit: 'ml',
      userId: 'outro-usuario',
      createdAt: 'sobrescrito',
    })).toEqual({ name: 'Nome pessoal', calories: 120, isHidden: true })
  })
})
