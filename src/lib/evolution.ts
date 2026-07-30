import { compareLocalIsoDates, isLocalIsoDate, localIsoDate } from './dates'
import type {
  BiologicalSex,
  BodyFatMethod,
  BodyMeasurement,
  PhysicalAssessment,
  WeightLog,
  WeightLogSource,
} from './types'

export type ValidationError = {
  field: string
  message: string
}

export type ValidationResult<T> =
  | { ok: true; value: T; errors: [] }
  | { ok: false; value: null; errors: ValidationError[] }

/** Numeric form values can be entered with either a comma or a dot. */
export type NumericInput = number | string | null | undefined

export type NormalizedWeightLogInput = Omit<WeightLog, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
export type WeightLogInput = Omit<NormalizedWeightLogInput, 'weightKg'> & { weightKg: NumericInput }

export type CircumferenceField =
  | 'neckCm'
  | 'shouldersCm'
  | 'chestCm'
  | 'waistCm'
  | 'abdomenCm'
  | 'hipCm'
  | 'leftArmRelaxedCm'
  | 'rightArmRelaxedCm'
  | 'leftArmContractedCm'
  | 'rightArmContractedCm'
  | 'leftForearmCm'
  | 'rightForearmCm'
  | 'leftThighCm'
  | 'rightThighCm'
  | 'leftCalfCm'
  | 'rightCalfCm'

export type BodyMeasurementNumericField = 'weightKg' | CircumferenceField
export type NormalizedBodyMeasurementInput = Omit<BodyMeasurement, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
export type BodyMeasurementInput = Omit<NormalizedBodyMeasurementInput, BodyMeasurementNumericField> & {
  [Field in BodyMeasurementNumericField]?: NumericInput
}

export const circumferenceFields: readonly CircumferenceField[] = [
  'neckCm',
  'shouldersCm',
  'chestCm',
  'waistCm',
  'abdomenCm',
  'hipCm',
  'leftArmRelaxedCm',
  'rightArmRelaxedCm',
  'leftArmContractedCm',
  'rightArmContractedCm',
  'leftForearmCm',
  'rightForearmCm',
  'leftThighCm',
  'rightThighCm',
  'leftCalfCm',
  'rightCalfCm',
]

const weightSources: readonly WeightLogSource[] = ['onboarding', 'profile', 'evolution', 'assessment', 'measurement']
const bodyFatMethods: readonly BodyFatMethod[] = [
  'manual',
  'bioimpedance',
  'navy',
  'jackson-pollock-3',
  'jackson-pollock-7',
  'durnin-womersley',
  'faulkner',
  'guedes',
  'other',
]

type AssessmentOptionalNumberField =
  | 'reportedBodyFatPercent'
  | 'calculatedBodyFatPercent'
  | 'fatMassKg'
  | 'leanMassKg'
  | 'muscleMassKg'
  | 'boneMassKg'
  | 'bodyWaterPercent'
  | 'visceralFatLevel'
  | 'metabolicAge'
  | 'basalMetabolicRateKcal'
  | 'bmi'
  | 'waistHipRatio'
  | 'waistHeightRatio'
  | 'neckCm'
  | 'chestCm'
  | 'waistCm'
  | 'abdomenCm'
  | 'hipCm'
  | 'tricepsSkinfoldMm'
  | 'bicepsSkinfoldMm'
  | 'subscapularSkinfoldMm'
  | 'suprailiacSkinfoldMm'
  | 'abdominalSkinfoldMm'
  | 'chestSkinfoldMm'
  | 'midaxillarySkinfoldMm'
  | 'thighSkinfoldMm'
  | 'calfSkinfoldMm'
  | 'restingHeartRate'
  | 'systolicBloodPressure'
  | 'diastolicBloodPressure'

const assessmentOptionalNumberFields: readonly AssessmentOptionalNumberField[] = [
  'reportedBodyFatPercent',
  'calculatedBodyFatPercent',
  'fatMassKg',
  'leanMassKg',
  'muscleMassKg',
  'boneMassKg',
  'bodyWaterPercent',
  'visceralFatLevel',
  'metabolicAge',
  'basalMetabolicRateKcal',
  'bmi',
  'waistHipRatio',
  'waistHeightRatio',
  'neckCm',
  'chestCm',
  'waistCm',
  'abdomenCm',
  'hipCm',
  'tricepsSkinfoldMm',
  'bicepsSkinfoldMm',
  'subscapularSkinfoldMm',
  'suprailiacSkinfoldMm',
  'abdominalSkinfoldMm',
  'chestSkinfoldMm',
  'midaxillarySkinfoldMm',
  'thighSkinfoldMm',
  'calfSkinfoldMm',
  'restingHeartRate',
  'systolicBloodPressure',
  'diastolicBloodPressure',
]

type PhysicalAssessmentNumericField = 'weightKg' | 'heightCm' | 'ageYears' | AssessmentOptionalNumberField
export type NormalizedPhysicalAssessmentInput = Omit<PhysicalAssessment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
export type PhysicalAssessmentInput = Omit<NormalizedPhysicalAssessmentInput, PhysicalAssessmentNumericField> & {
  [Field in PhysicalAssessmentNumericField]?: NumericInput
}

const textFields = ['evaluatorName', 'evaluatorRegistration', 'goals', 'observations', 'recommendations'] as const

function success<T>(value: T): ValidationResult<T> {
  return { ok: true, value, errors: [] }
}

function failure<T>(errors: ValidationError[]): ValidationResult<T> {
  return { ok: false, value: null, errors }
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

/** Parses a finite decimal entered with either a comma or a dot. */
export function parseLocalizedNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  const normalized = value.trim().replace(/\s+/g, '').replace(',', '.')
  if (!/^[+-]?(?:\d+|\d*\.\d+)$/.test(normalized)) return null

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function validateWeightKg(value: unknown): ValidationResult<number> {
  const weightKg = parseLocalizedNumber(value)
  if (weightKg === null) return failure([{ field: 'weightKg', message: 'Informe um peso válido em quilogramas.' }])
  if (weightKg <= 0) return failure([{ field: 'weightKg', message: 'O peso deve ser maior que zero.' }])
  if (weightKg < 25 || weightKg > 500) {
    return failure([{ field: 'weightKg', message: 'O peso deve estar entre 25 kg e 500 kg.' }])
  }

  return success(weightKg)
}

function validateHeightCm(value: unknown): ValidationResult<number> {
  const heightCm = parseLocalizedNumber(value)
  if (heightCm === null) return failure([{ field: 'heightCm', message: 'Informe uma altura válida em centímetros.' }])
  if (heightCm < 80 || heightCm > 260) {
    return failure([{ field: 'heightCm', message: 'A altura deve estar entre 80 cm e 260 cm.' }])
  }

  return success(heightCm)
}

function optionalNonNegative(value: unknown, field: string, label: string): { value: number | null; error?: ValidationError } {
  if (isBlank(value)) return { value: null }
  const parsed = parseLocalizedNumber(value)
  if (parsed === null) return { value: null, error: { field, message: `${label} deve ser um número válido.` } }
  if (parsed < 0) return { value: null, error: { field, message: `${label} não pode ser negativo.` } }
  return { value: parsed }
}

function optionalPercentage(value: unknown, field: string, label: string): { value: number | null; error?: ValidationError } {
  const result = optionalNonNegative(value, field, label)
  if (result.error || result.value === null) return result
  if (result.value > 100) return { value: null, error: { field, message: `${label} deve estar entre 0% e 100%.` } }
  return result
}

function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function isWeightSource(value: unknown): value is WeightLogSource {
  return typeof value === 'string' && weightSources.includes(value as WeightLogSource)
}

function isBodyFatMethod(value: unknown): value is BodyFatMethod {
  return typeof value === 'string' && bodyFatMethods.includes(value as BodyFatMethod)
}

function isBiologicalSex(value: unknown): value is BiologicalSex {
  return value === 'female' || value === 'male'
}

export function validateWeightLogInput(input: Partial<WeightLogInput>): ValidationResult<NormalizedWeightLogInput> {
  const errors: ValidationError[] = []
  const date = typeof input.date === 'string' ? input.date : ''
  if (!isLocalIsoDate(date)) errors.push({ field: 'date', message: 'Informe uma data válida no formato AAAA-MM-DD.' })

  const validatedWeight = validateWeightKg(input.weightKg)
  if (!validatedWeight.ok) errors.push(...validatedWeight.errors)

  if (!isWeightSource(input.source)) errors.push({ field: 'source', message: 'Selecione uma origem válida para o peso.' })

  const time = isBlank(input.time) ? null : typeof input.time === 'string' ? input.time : null
  if (time !== null && !validTime(time)) errors.push({ field: 'time', message: 'Informe o horário no formato HH:MM.' })

  if (errors.length || !validatedWeight.ok || !isWeightSource(input.source)) return failure(errors)

  return success({
    date,
    weightKg: validatedWeight.value,
    source: input.source,
    time,
    notes: trimOrNull(input.notes),
    fasted: typeof input.fasted === 'boolean' ? input.fasted : null,
  })
}

export function validateBodyMeasurementInput(input: Partial<BodyMeasurementInput>): ValidationResult<NormalizedBodyMeasurementInput> {
  const errors: ValidationError[] = []
  const date = typeof input.date === 'string' ? input.date : ''
  if (!isLocalIsoDate(date)) errors.push({ field: 'date', message: 'Informe uma data válida no formato AAAA-MM-DD.' })

  let weightKg: number | null = null
  if (!isBlank(input.weightKg)) {
    const validatedWeight = validateWeightKg(input.weightKg)
    if (validatedWeight.ok) weightKg = validatedWeight.value
    else errors.push(...validatedWeight.errors)
  }

  const normalized = {} as Record<CircumferenceField, number | null>
  circumferenceFields.forEach((field) => {
    const value = optionalNonNegative(input[field], field, 'A medida')
    normalized[field] = value.value
    if (value.error) errors.push(value.error)
  })

  if (weightKg === null && circumferenceFields.every((field) => normalized[field] === null)) {
    errors.push({ field: 'measurements', message: 'Informe pelo menos uma medida corporal.' })
  }

  if (errors.length) return failure(errors)

  return success({
    date,
    weightKg,
    ...normalized,
    notes: trimOrNull(input.notes),
  })
}

export type MeasurementComparison = {
  field: 'weightKg' | CircumferenceField
  previous: number
  current: number
  difference: number
  percentageDifference: number | null
}

/** Returns only fields present in both entries, never filling missing values. */
export function compareBodyMeasurements(current: BodyMeasurement, previous: BodyMeasurement): MeasurementComparison[] {
  const fields: readonly ('weightKg' | CircumferenceField)[] = ['weightKg', ...circumferenceFields]
  return fields.flatMap((field) => {
    const currentValue = current[field]
    const previousValue = previous[field]
    if (typeof currentValue !== 'number' || !Number.isFinite(currentValue) || typeof previousValue !== 'number' || !Number.isFinite(previousValue)) return []
    const difference = currentValue - previousValue
    return [{
      field,
      previous: previousValue,
      current: currentValue,
      difference,
      percentageDifference: previousValue === 0 ? null : (difference / previousValue) * 100,
    }]
  })
}

export type BodyFatCalculation = {
  percent: number | null
  source: 'reported' | 'calculated' | null
  bodyDensity: number | null
  errors: ValidationError[]
}

export type PhysicalAssessmentMetrics = {
  bmi: number | null
  waistHipRatio: number | null
  waistHeightRatio: number | null
  bodyFatPercent: number | null
  bodyFatSource: 'reported' | 'calculated' | null
  bodyDensity: number | null
  fatMassKg: number | null
  leanMassKg: number | null
  errors: ValidationError[]
}

function rounded(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function percentageFromDensity(bodyDensity: number): BodyFatCalculation {
  if (!Number.isFinite(bodyDensity) || bodyDensity <= 0) {
    return { percent: null, source: null, bodyDensity: null, errors: [{ field: 'bodyFatMethod', message: 'Não foi possível calcular a densidade corporal.' }] }
  }

  const percent = 495 / bodyDensity - 450
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return { percent: null, source: null, bodyDensity, errors: [{ field: 'bodyFatMethod', message: 'Os dados informados geraram um percentual de gordura fora do intervalo válido.' }] }
  }

  return { percent: rounded(percent), source: 'calculated', bodyDensity: rounded(bodyDensity, 5), errors: [] }
}

function requiredNumber(input: Partial<PhysicalAssessmentInput>, field: keyof PhysicalAssessmentInput, label: string, errors: ValidationError[]): number | null {
  const value = parseLocalizedNumber(input[field])
  if (value === null || value < 0) {
    errors.push({ field: String(field), message: `Informe ${label} para o protocolo selecionado.` })
    return null
  }
  return value
}

function requiredSex(input: Partial<PhysicalAssessmentInput>, errors: ValidationError[]): BiologicalSex | null {
  if (!isBiologicalSex(input.biologicalSex)) {
    errors.push({ field: 'biologicalSex', message: 'Informe o sexo biológico exigido pelo protocolo selecionado.' })
    return null
  }
  return input.biologicalSex
}

function requiredAge(input: Partial<PhysicalAssessmentInput>, errors: ValidationError[]): number | null {
  const age = parseLocalizedNumber(input.ageYears)
  if (age === null || !Number.isInteger(age) || age < 1 || age > 120) {
    errors.push({ field: 'ageYears', message: 'Informe uma idade inteira válida para o protocolo selecionado.' })
    return null
  }
  return age
}

/**
 * Calculates only the selected protocol. A protocol with incomplete data yields
 * a field error instead of a guessed percentage.
 */
export function calculateBodyFat(input: Partial<PhysicalAssessmentInput>): BodyFatCalculation {
  if (!isBodyFatMethod(input.bodyFatMethod)) {
    return { percent: null, source: null, bodyDensity: null, errors: [{ field: 'bodyFatMethod', message: 'Selecione um método válido de percentual de gordura.' }] }
  }

  if (input.bodyFatMethod === 'manual' || input.bodyFatMethod === 'bioimpedance' || input.bodyFatMethod === 'other') {
    const reported = optionalPercentage(input.reportedBodyFatPercent, 'reportedBodyFatPercent', 'O percentual de gordura informado')
    if (reported.error || reported.value === null) {
      return { percent: null, source: null, bodyDensity: null, errors: [reported.error ?? { field: 'reportedBodyFatPercent', message: 'Informe o percentual de gordura medido.' }] }
    }
    return { percent: reported.value, source: 'reported', bodyDensity: null, errors: [] }
  }

  const errors: ValidationError[] = []
  const sex = input.bodyFatMethod === 'faulkner' ? null : requiredSex(input, errors)

  if (input.bodyFatMethod === 'navy') {
    const height = requiredNumber(input, 'heightCm', 'a altura', errors)
    const neck = requiredNumber(input, 'neckCm', 'a circunferência do pescoço', errors)
    const waist = requiredNumber(input, 'waistCm', 'a circunferência da cintura', errors)
    const hip = sex === 'female' ? requiredNumber(input, 'hipCm', 'a circunferência do quadril', errors) : null
    if (errors.length || height === null || neck === null || waist === null || (sex === 'female' && hip === null)) {
      return { percent: null, source: null, bodyDensity: null, errors }
    }

    const circumference = sex === 'female' ? waist + (hip ?? 0) - neck : waist - neck
    if (circumference <= 0) {
      return { percent: null, source: null, bodyDensity: null, errors: [{ field: 'waistCm', message: 'A combinação de circunferências deve ser maior que zero para o protocolo Navy.' }] }
    }

    const bodyDensity = sex === 'female'
      ? 1.29579 - 0.35004 * Math.log10(circumference) + 0.221 * Math.log10(height)
      : 1.0324 - 0.19077 * Math.log10(circumference) + 0.15456 * Math.log10(height)
    return percentageFromDensity(bodyDensity)
  }

  if (input.bodyFatMethod === 'faulkner') {
    const triceps = requiredNumber(input, 'tricepsSkinfoldMm', 'a dobra tricipital', errors)
    const subscapular = requiredNumber(input, 'subscapularSkinfoldMm', 'a dobra subescapular', errors)
    const suprailiac = requiredNumber(input, 'suprailiacSkinfoldMm', 'a dobra supra-ilíaca', errors)
    const abdominal = requiredNumber(input, 'abdominalSkinfoldMm', 'a dobra abdominal', errors)
    if (errors.length || triceps === null || subscapular === null || suprailiac === null || abdominal === null) {
      return { percent: null, source: null, bodyDensity: null, errors }
    }
    const percent = 5.783 + 0.153 * (triceps + subscapular + suprailiac + abdominal)
    if (percent < 0 || percent > 100) {
      return { percent: null, source: null, bodyDensity: null, errors: [{ field: 'bodyFatMethod', message: 'Os dados informados geraram um percentual de gordura fora do intervalo válido.' }] }
    }
    return { percent: rounded(percent), source: 'calculated', bodyDensity: null, errors: [] }
  }

  if (sex === null) return { percent: null, source: null, bodyDensity: null, errors }

  if (input.bodyFatMethod === 'jackson-pollock-3') {
    const age = requiredAge(input, errors)
    const fields = sex === 'male'
      ? [['chestSkinfoldMm', 'a dobra peitoral'], ['abdominalSkinfoldMm', 'a dobra abdominal'], ['thighSkinfoldMm', 'a dobra da coxa']]
      : [['tricepsSkinfoldMm', 'a dobra tricipital'], ['suprailiacSkinfoldMm', 'a dobra supra-ilíaca'], ['thighSkinfoldMm', 'a dobra da coxa']]
    const folds = fields.map(([field, label]) => requiredNumber(input, field as keyof PhysicalAssessmentInput, label, errors))
    if (errors.length || age === null || folds.some((fold) => fold === null)) return { percent: null, source: null, bodyDensity: null, errors }
    const sum = (folds as number[]).reduce((total, fold) => total + fold, 0)
    const bodyDensity = sex === 'male'
      ? 1.10938 - 0.0008267 * sum + 0.0000016 * sum ** 2 - 0.0002574 * age
      : 1.0994921 - 0.0009929 * sum + 0.0000023 * sum ** 2 - 0.0001392 * age
    return percentageFromDensity(bodyDensity)
  }

  if (input.bodyFatMethod === 'jackson-pollock-7') {
    const age = requiredAge(input, errors)
    const fields: readonly [keyof PhysicalAssessmentInput, string][] = [
      ['chestSkinfoldMm', 'a dobra peitoral'],
      ['midaxillarySkinfoldMm', 'a dobra axilar média'],
      ['tricepsSkinfoldMm', 'a dobra tricipital'],
      ['subscapularSkinfoldMm', 'a dobra subescapular'],
      ['abdominalSkinfoldMm', 'a dobra abdominal'],
      ['suprailiacSkinfoldMm', 'a dobra supra-ilíaca'],
      ['thighSkinfoldMm', 'a dobra da coxa'],
    ]
    const folds = fields.map(([field, label]) => requiredNumber(input, field, label, errors))
    if (errors.length || age === null || folds.some((fold) => fold === null)) return { percent: null, source: null, bodyDensity: null, errors }
    const sum = (folds as number[]).reduce((total, fold) => total + fold, 0)
    const bodyDensity = sex === 'male'
      ? 1.112 - 0.00043499 * sum + 0.00000055 * sum ** 2 - 0.00028826 * age
      : 1.097 - 0.00046971 * sum + 0.00000056 * sum ** 2 - 0.00012828 * age
    return percentageFromDensity(bodyDensity)
  }

  if (input.bodyFatMethod === 'durnin-womersley') {
    const age = requiredAge(input, errors)
    const fields: readonly [keyof PhysicalAssessmentInput, string][] = [
      ['bicepsSkinfoldMm', 'a dobra bicipital'],
      ['tricepsSkinfoldMm', 'a dobra tricipital'],
      ['subscapularSkinfoldMm', 'a dobra subescapular'],
      ['suprailiacSkinfoldMm', 'a dobra supra-ilíaca'],
    ]
    const folds = fields.map(([field, label]) => requiredNumber(input, field, label, errors))
    if (errors.length || age === null || folds.some((fold) => fold === null)) return { percent: null, source: null, bodyDensity: null, errors }
    const sum = (folds as number[]).reduce((total, fold) => total + fold, 0)
    if (sum <= 0) return { percent: null, source: null, bodyDensity: null, errors: [{ field: 'skinfolds', message: 'A soma das dobras deve ser maior que zero.' }] }
    const coefficients = durninWomersleyCoefficients(sex, age)
    const bodyDensity = coefficients.intercept - coefficients.slope * Math.log10(sum)
    return percentageFromDensity(bodyDensity)
  }

  // Guedes uses its sex-specific, three-site density equations and the Siri conversion.
  const fields = sex === 'male'
    ? [['tricepsSkinfoldMm', 'a dobra tricipital'], ['suprailiacSkinfoldMm', 'a dobra supra-ilíaca'], ['abdominalSkinfoldMm', 'a dobra abdominal']]
    : [['subscapularSkinfoldMm', 'a dobra subescapular'], ['suprailiacSkinfoldMm', 'a dobra supra-ilíaca'], ['thighSkinfoldMm', 'a dobra da coxa']]
  const folds = fields.map(([field, label]) => requiredNumber(input, field as keyof PhysicalAssessmentInput, label, errors))
  if (errors.length || folds.some((fold) => fold === null)) return { percent: null, source: null, bodyDensity: null, errors }
  const sum = (folds as number[]).reduce((total, fold) => total + fold, 0)
  if (sum <= 0) return { percent: null, source: null, bodyDensity: null, errors: [{ field: 'skinfolds', message: 'A soma das dobras deve ser maior que zero.' }] }
  const bodyDensity = sex === 'male'
    ? 1.17136 - 0.06706 * Math.log10(sum)
    : 1.1665 - 0.07063 * Math.log10(sum)
  return percentageFromDensity(bodyDensity)
}

function durninWomersleyCoefficients(sex: BiologicalSex, age: number): { intercept: number; slope: number } {
  if (age < 17) return sex === 'male' ? { intercept: 1.1533, slope: 0.0643 } : { intercept: 1.1369, slope: 0.0598 }
  if (age <= 19) return sex === 'male' ? { intercept: 1.162, slope: 0.063 } : { intercept: 1.1549, slope: 0.0678 }
  if (age <= 29) return sex === 'male' ? { intercept: 1.1631, slope: 0.0632 } : { intercept: 1.1599, slope: 0.0717 }
  if (age <= 39) return sex === 'male' ? { intercept: 1.1422, slope: 0.0544 } : { intercept: 1.1423, slope: 0.0632 }
  if (age <= 49) return sex === 'male' ? { intercept: 1.162, slope: 0.07 } : { intercept: 1.1333, slope: 0.0612 }
  return sex === 'male' ? { intercept: 1.1715, slope: 0.0779 } : { intercept: 1.1339, slope: 0.0645 }
}

export function calculatePhysicalAssessmentMetrics(input: Partial<PhysicalAssessmentInput>): PhysicalAssessmentMetrics {
  const weight = validateWeightKg(input.weightKg)
  const height = validateHeightCm(input.heightCm)
  const bodyFat = calculateBodyFat(input)
  const errors = [...(!weight.ok ? weight.errors : []), ...(!height.ok ? height.errors : []), ...bodyFat.errors]

  const bmi = weight.ok && height.ok ? rounded(weight.value / (height.value / 100) ** 2) : null
  const waist = parseLocalizedNumber(input.waistCm)
  const hip = parseLocalizedNumber(input.hipCm)
  const waistHipRatio = waist !== null && hip !== null && waist >= 0 && hip > 0 ? rounded(waist / hip, 3) : null
  const waistHeightRatio = waist !== null && waist >= 0 && height.ok ? rounded(waist / height.value, 3) : null
  const fatMassKg = weight.ok && bodyFat.percent !== null ? rounded(weight.value * (bodyFat.percent / 100)) : null
  const leanMassKg = weight.ok && fatMassKg !== null ? rounded(weight.value - fatMassKg) : null

  return {
    bmi,
    waistHipRatio,
    waistHeightRatio,
    bodyFatPercent: bodyFat.percent,
    bodyFatSource: bodyFat.source,
    bodyDensity: bodyFat.bodyDensity,
    fatMassKg,
    leanMassKg,
    errors,
  }
}

export function validatePhysicalAssessmentInput(input: Partial<PhysicalAssessmentInput>): ValidationResult<NormalizedPhysicalAssessmentInput> {
  const errors: ValidationError[] = []
  const assessmentDate = typeof input.assessmentDate === 'string' ? input.assessmentDate : ''
  if (!isLocalIsoDate(assessmentDate)) errors.push({ field: 'assessmentDate', message: 'Informe uma data de avaliação válida no formato AAAA-MM-DD.' })

  const weight = validateWeightKg(input.weightKg)
  const height = validateHeightCm(input.heightCm)
  if (!weight.ok) errors.push(...weight.errors)
  if (!height.ok) errors.push(...height.errors)
  if (!isBodyFatMethod(input.bodyFatMethod)) errors.push({ field: 'bodyFatMethod', message: 'Selecione um método válido de percentual de gordura.' })

  let ageYears: number | null = null
  if (!isBlank(input.ageYears)) {
    const age = parseLocalizedNumber(input.ageYears)
    if (age === null || !Number.isInteger(age) || age < 0 || age > 120) errors.push({ field: 'ageYears', message: 'Informe uma idade inteira entre 0 e 120 anos.' })
    else ageYears = age
  }

  const numericValues = {} as Record<AssessmentOptionalNumberField, number | null>
  assessmentOptionalNumberFields.forEach((field) => {
    const result = field === 'reportedBodyFatPercent' || field === 'calculatedBodyFatPercent' || field === 'bodyWaterPercent'
      ? optionalPercentage(input[field], field, 'O valor informado')
      : optionalNonNegative(input[field], field, 'O valor informado')
    numericValues[field] = result.value
    if (result.error) errors.push(result.error)
  })

  const protocol = calculateBodyFat({ ...input, weightKg: weight.ok ? weight.value : input.weightKg, heightCm: height.ok ? height.value : input.heightCm, ageYears, ...numericValues })
  errors.push(...protocol.errors)

  if (errors.length || !weight.ok || !height.ok || !isBodyFatMethod(input.bodyFatMethod)) return failure(errors)

  const text = {} as Record<(typeof textFields)[number], string | null>
  textFields.forEach((field) => { text[field] = trimOrNull(input[field]) })

  const metrics = calculatePhysicalAssessmentMetrics({ ...input, weightKg: weight.value, heightCm: height.value, ageYears, ...numericValues })
  return success({
    assessmentDate,
    weightKg: weight.value,
    heightCm: height.value,
    bodyFatMethod: input.bodyFatMethod,
    biologicalSex: isBiologicalSex(input.biologicalSex) ? input.biologicalSex : null,
    ageYears,
    ...numericValues,
    ...text,
    bmi: metrics.bmi,
    waistHipRatio: metrics.waistHipRatio,
    waistHeightRatio: metrics.waistHeightRatio,
    calculatedBodyFatPercent: metrics.bodyFatSource === 'calculated' ? metrics.bodyFatPercent : null,
    fatMassKg: metrics.fatMassKg,
    leanMassKg: metrics.leanMassKg,
  })
}

export type WeightTrend = 'up' | 'down' | 'stable' | 'unknown'

export type WeightSummary = {
  first: WeightLog | null
  latest: WeightLog | null
  totalChangeKg: number | null
  percentageChange: number | null
  averageLast7Days: number | null
  averageLast30Days: number | null
  lowestWeightKg: number | null
  highestWeightKg: number | null
  recordCount: number
  trend: WeightTrend
  weightGoalKg: number | null
  goalDeltaKg: number | null
}

function dateToDayNumber(value: string): number | null {
  if (!isLocalIsoDate(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 86_400_000
}

function compareWeightLogsAscending(left: WeightLog, right: WeightLog): number {
  const dateComparison = compareLocalIsoDates(left.date, right.date)
  if (dateComparison !== 0) return dateComparison
  return (left.time ?? '').localeCompare(right.time ?? '') || (left.createdAt ?? '').localeCompare(right.createdAt ?? '') || left.id.localeCompare(right.id)
}

export function sortWeightLogs(logs: readonly WeightLog[]): WeightLog[] {
  return logs
    .filter((log) => isLocalIsoDate(log.date) && Number.isFinite(log.weightKg) && log.weightKg >= 25 && log.weightKg <= 500)
    .slice()
    .sort(compareWeightLogsAscending)
}

export function calculateWeightSummary(logs: readonly WeightLog[], weightGoalKg?: number | null, referenceDate = localIsoDate()): WeightSummary {
  const sorted = sortWeightLogs(logs)
  const first = sorted[0] ?? null
  const latest = sorted.at(-1) ?? null
  const values = sorted.map((log) => log.weightKg)
  const totalChangeKg = first && latest ? rounded(latest.weightKg - first.weightKg) : null
  const percentageChange = first && totalChangeKg !== null && first.weightKg !== 0 ? rounded((totalChangeKg / first.weightKg) * 100) : null
  const referenceDay = dateToDayNumber(referenceDate)

  const averageForDays = (days: number): number | null => {
    if (referenceDay === null) return null
    const weights = sorted
      .filter((log) => {
        const day = dateToDayNumber(log.date)
        return day !== null && day >= referenceDay - (days - 1) && day <= referenceDay
      })
      .map((log) => log.weightKg)
    return weights.length ? rounded(weights.reduce((total, weight) => total + weight, 0) / weights.length) : null
  }

  const validGoal = weightGoalKg === null || weightGoalKg === undefined ? null : validateWeightKg(weightGoalKg).ok ? weightGoalKg : null
  return {
    first,
    latest,
    totalChangeKg,
    percentageChange,
    averageLast7Days: averageForDays(7),
    averageLast30Days: averageForDays(30),
    lowestWeightKg: values.length ? Math.min(...values) : null,
    highestWeightKg: values.length ? Math.max(...values) : null,
    recordCount: sorted.length,
    trend: totalChangeKg === null ? 'unknown' : totalChangeKg > 0 ? 'up' : totalChangeKg < 0 ? 'down' : 'stable',
    weightGoalKg: validGoal,
    goalDeltaKg: latest && validGoal !== null ? rounded(validGoal - latest.weightKg) : null,
  }
}
