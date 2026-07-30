import { describe, expect, it } from 'vitest'
import {
  calculateBodyFat,
  calculatePhysicalAssessmentMetrics,
  calculateWeightSummary,
  compareBodyMeasurements,
  parseLocalizedNumber,
  validateBodyMeasurementInput,
  validatePhysicalAssessmentInput,
  validateWeightKg,
  validateWeightLogInput,
} from './evolution'
import type { BodyMeasurement, WeightLog } from './types'

describe('domínio de evolução', () => {
  it('aceita ponto ou vírgula em números e rejeita valores não numéricos', () => {
    expect(parseLocalizedNumber('72,5')).toBe(72.5)
    expect(parseLocalizedNumber('72.5')).toBe(72.5)
    expect(parseLocalizedNumber('72,5.0')).toBeNull()
    expect(validateWeightKg('0').ok).toBe(false)
    expect(validateWeightKg('-1').ok).toBe(false)
    expect(validateWeightKg('72,5')).toEqual({ ok: true, value: 72.5, errors: [] })
  })

  it('valida o registro de peso antes de persistir', () => {
    expect(validateWeightLogInput({ date: '2026-07-30', weightKg: '71,2', source: 'profile' })).toEqual({
      ok: true,
      value: { date: '2026-07-30', weightKg: 71.2, source: 'profile', time: null, notes: null, fasted: null },
      errors: [],
    })
    expect(validateWeightLogInput({ date: '2026-02-30', weightKg: 71, source: 'profile' }).ok).toBe(false)
  })

  it('exige ao menos uma medida e nunca converte uma circunferência negativa', () => {
    expect(validateBodyMeasurementInput({ date: '2026-07-30', waistCm: '80,5' })).toMatchObject({
      ok: true,
      value: { date: '2026-07-30', waistCm: 80.5, weightKg: null },
    })
    expect(validateBodyMeasurementInput({ date: '2026-07-30' }).ok).toBe(false)
    expect(validateBodyMeasurementInput({ date: '2026-07-30', waistCm: '-1' }).ok).toBe(false)
  })

  it('compara somente medidas existentes nas duas medições', () => {
    const previous: BodyMeasurement = { id: 'before', userId: 'u', date: '2026-07-01', waistCm: 82, hipCm: 100 }
    const current: BodyMeasurement = { id: 'after', userId: 'u', date: '2026-07-30', waistCm: 80, chestCm: 101 }

    expect(compareBodyMeasurements(current, previous)).toEqual([
      { field: 'waistCm', previous: 82, current: 80, difference: -2, percentageDifference: expect.closeTo(-2.439, 3) },
    ])
  })

  it('calcula métricas básicas e usa o percentual manual informado', () => {
    const metrics = calculatePhysicalAssessmentMetrics({
      weightKg: 80,
      heightCm: 180,
      waistCm: 90,
      hipCm: 100,
      bodyFatMethod: 'manual',
      reportedBodyFatPercent: 20,
    })

    expect(metrics).toMatchObject({
      bmi: 24.69,
      waistHipRatio: 0.9,
      waistHeightRatio: 0.5,
      bodyFatPercent: 20,
      bodyFatSource: 'reported',
      fatMassKg: 16,
      leanMassKg: 64,
    })
  })

  it('não inventa percentual quando o protocolo selecionado não tem os dados necessários', () => {
    const result = calculateBodyFat({
      bodyFatMethod: 'jackson-pollock-3',
      biologicalSex: 'male',
      ageYears: 30,
      chestSkinfoldMm: 10,
      abdominalSkinfoldMm: 20,
    })

    expect(result.percent).toBeNull()
    expect(result.errors.some((error) => error.field === 'thighSkinfoldMm')).toBe(true)
  })

  it('calcula Navy apenas após receber todas as circunferências exigidas', () => {
    const missingHip = calculateBodyFat({ bodyFatMethod: 'navy', biologicalSex: 'female', heightCm: 165, neckCm: 34, waistCm: 75 })
    expect(missingHip.percent).toBeNull()
    expect(missingHip.errors.some((error) => error.field === 'hipCm')).toBe(true)

    const calculated = calculateBodyFat({ bodyFatMethod: 'navy', biologicalSex: 'female', heightCm: 165, neckCm: 34, waistCm: 75, hipCm: 100 })
    expect(calculated.source).toBe('calculated')
    expect(calculated.percent).toBeGreaterThan(0)
  })

  it('mantém os protocolos de dobras separados e exige apenas seus campos próprios', () => {
    const common = { biologicalSex: 'male' as const, ageYears: 30, tricepsSkinfoldMm: 12, suprailiacSkinfoldMm: 14, abdominalSkinfoldMm: 20, chestSkinfoldMm: 10, thighSkinfoldMm: 16, midaxillarySkinfoldMm: 13, subscapularSkinfoldMm: 15, bicepsSkinfoldMm: 8 }
    const methods = ['jackson-pollock-3', 'jackson-pollock-7', 'durnin-womersley', 'faulkner', 'guedes'] as const

    methods.forEach((bodyFatMethod) => {
      const result = calculateBodyFat({ ...common, bodyFatMethod })
      expect(result.errors).toEqual([])
      expect(result.percent).toBeGreaterThan(0)
      expect(result.percent).toBeLessThan(100)
    })
  })

  it('normaliza uma avaliação completa e rejeita percentual acima de 100%', () => {
    const valid = validatePhysicalAssessmentInput({
      assessmentDate: '2026-07-30',
      weightKg: '80',
      heightCm: '180',
      bodyFatMethod: 'bioimpedance',
      reportedBodyFatPercent: '21,5',
    })
    expect(valid).toMatchObject({ ok: true, value: { weightKg: 80, heightCm: 180, reportedBodyFatPercent: 21.5 } })

    expect(validatePhysicalAssessmentInput({
      assessmentDate: '2026-07-30',
      weightKg: 80,
      heightCm: 180,
      bodyFatMethod: 'manual',
      reportedBodyFatPercent: 101,
    }).ok).toBe(false)
  })

  it('resume o histórico real sem assumir direção da meta', () => {
    const logs: WeightLog[] = [
      { id: '1', userId: 'u', date: '2026-07-20', weightKg: 80, source: 'onboarding' },
      { id: '2', userId: 'u', date: '2026-07-24', weightKg: 79, source: 'profile' },
      { id: '3', userId: 'u', date: '2026-07-28', weightKg: 78, source: 'evolution' },
      { id: '4', userId: 'u', date: '2026-07-30', weightKg: 77, source: 'evolution' },
    ]
    const summary = calculateWeightSummary(logs, 70, '2026-07-30')

    expect(summary).toMatchObject({
      first: { id: '1' },
      latest: { id: '4' },
      totalChangeKg: -3,
      percentageChange: -3.75,
      averageLast7Days: 78,
      averageLast30Days: 78.5,
      lowestWeightKg: 77,
      highestWeightKg: 80,
      recordCount: 4,
      trend: 'down',
      goalDeltaKg: -7,
    })
  })
})
