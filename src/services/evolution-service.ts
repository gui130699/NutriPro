import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore'
import { circumferenceFields, sortWeightLogs, validateBodyMeasurementInput, validatePhysicalAssessmentInput, validateWeightLogInput, type BodyMeasurementInput, type PhysicalAssessmentInput, type WeightLogInput } from '../lib/evolution'
import { localIsoDate } from '../lib/dates'
import { db } from '../lib/firebase'
import type { BodyFatMethod, BodyMeasurement, PhysicalAssessment, WeightLog, WeightLogSource } from '../lib/types'

type LinkWeightOptions = {
  /** Records the measurement's weight in the canonical weight history when requested by the user. */
  registerWeight?: boolean
}

export type LinkedCreateResult = {
  id: string
  linkedWeightId: string | null
  linkedWeightCreated: boolean
}

const validWeightSources: readonly WeightLogSource[] = ['onboarding', 'profile', 'evolution', 'assessment', 'measurement']
const validBodyFatMethods: readonly BodyFatMethod[] = [
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

function firestore() {
  if (!db) throw new Error('Configure as variáveis públicas do Firebase antes de usar o NutriPro.')
  return db
}

function timestampToIso(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  return undefined
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asWeightSource(value: unknown): WeightLogSource {
  return typeof value === 'string' && validWeightSources.includes(value as WeightLogSource) ? value as WeightLogSource : 'evolution'
}

function asBodyFatMethod(value: unknown): BodyFatMethod {
  return typeof value === 'string' && validBodyFatMethods.includes(value as BodyFatMethod) ? value as BodyFatMethod : 'manual'
}

function toWeightLog(id: string, data: DocumentData): WeightLog {
  return {
    id,
    userId: String(data.userId ?? ''),
    date: String(data.date ?? ''),
    weightKg: nullableNumber(data.weightKg ?? data.weight) ?? 0,
    source: asWeightSource(data.source),
    time: nullableText(data.time),
    notes: nullableText(data.notes),
    fasted: typeof data.fasted === 'boolean' ? data.fasted : null,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  }
}

function toBodyMeasurement(id: string, data: DocumentData): BodyMeasurement {
  const values = {} as Record<(typeof circumferenceFields)[number], number | null>
  circumferenceFields.forEach((field) => { values[field] = nullableNumber(data[field]) })
  return {
    id,
    userId: String(data.userId ?? ''),
    date: String(data.date ?? ''),
    weightKg: nullableNumber(data.weightKg),
    ...values,
    notes: nullableText(data.notes),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  }
}

function toPhysicalAssessment(id: string, data: DocumentData): PhysicalAssessment {
  return {
    id,
    userId: String(data.userId ?? ''),
    evaluatorName: nullableText(data.evaluatorName),
    evaluatorRegistration: nullableText(data.evaluatorRegistration),
    assessmentDate: String(data.assessmentDate ?? ''),
    weightKg: nullableNumber(data.weightKg) ?? 0,
    heightCm: nullableNumber(data.heightCm) ?? 0,
    bodyFatMethod: asBodyFatMethod(data.bodyFatMethod),
    biologicalSex: data.biologicalSex === 'female' || data.biologicalSex === 'male' ? data.biologicalSex : null,
    ageYears: nullableNumber(data.ageYears),
    reportedBodyFatPercent: nullableNumber(data.reportedBodyFatPercent),
    calculatedBodyFatPercent: nullableNumber(data.calculatedBodyFatPercent),
    fatMassKg: nullableNumber(data.fatMassKg),
    leanMassKg: nullableNumber(data.leanMassKg),
    muscleMassKg: nullableNumber(data.muscleMassKg),
    boneMassKg: nullableNumber(data.boneMassKg),
    bodyWaterPercent: nullableNumber(data.bodyWaterPercent),
    visceralFatLevel: nullableNumber(data.visceralFatLevel),
    metabolicAge: nullableNumber(data.metabolicAge),
    basalMetabolicRateKcal: nullableNumber(data.basalMetabolicRateKcal),
    bmi: nullableNumber(data.bmi),
    waistHipRatio: nullableNumber(data.waistHipRatio),
    waistHeightRatio: nullableNumber(data.waistHeightRatio),
    neckCm: nullableNumber(data.neckCm),
    chestCm: nullableNumber(data.chestCm),
    waistCm: nullableNumber(data.waistCm),
    abdomenCm: nullableNumber(data.abdomenCm),
    hipCm: nullableNumber(data.hipCm),
    tricepsSkinfoldMm: nullableNumber(data.tricepsSkinfoldMm),
    bicepsSkinfoldMm: nullableNumber(data.bicepsSkinfoldMm),
    subscapularSkinfoldMm: nullableNumber(data.subscapularSkinfoldMm),
    suprailiacSkinfoldMm: nullableNumber(data.suprailiacSkinfoldMm),
    abdominalSkinfoldMm: nullableNumber(data.abdominalSkinfoldMm),
    chestSkinfoldMm: nullableNumber(data.chestSkinfoldMm),
    midaxillarySkinfoldMm: nullableNumber(data.midaxillarySkinfoldMm),
    thighSkinfoldMm: nullableNumber(data.thighSkinfoldMm),
    calfSkinfoldMm: nullableNumber(data.calfSkinfoldMm),
    restingHeartRate: nullableNumber(data.restingHeartRate),
    systolicBloodPressure: nullableNumber(data.systolicBloodPressure),
    diastolicBloodPressure: nullableNumber(data.diastolicBloodPressure),
    goals: nullableText(data.goals),
    observations: nullableText(data.observations),
    recommendations: nullableText(data.recommendations),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  }
}

function errorFromValidation(errors: readonly { message: string }[]): Error {
  return new Error(errors.map((error) => error.message).join(' '))
}

function withoutNullishFields<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== null && fieldValue !== undefined),
  ) as Partial<T>
}

function nullableFieldsAsDeletes<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [key, fieldValue === null || fieldValue === undefined ? deleteField() : fieldValue]),
  )
}

async function ownedDocument(collectionName: string, id: string, userId: string) {
  const reference = doc(firestore(), collectionName, id)
  const snapshot = await getDoc(reference)
  if (!snapshot.exists() || snapshot.data().userId !== userId) throw new Error('Você não pode alterar este registro.')
  return { reference, snapshot }
}

async function ensureLinkedWeight(userId: string, date: string, weightKg: number, source: Extract<WeightLogSource, 'assessment' | 'measurement'>): Promise<{ id: string; created: boolean }> {
  const database = firestore()
  const logs = collection(database, 'weightLogs')
  const matchingByDate = query(logs, where('userId', '==', userId), where('date', '==', date))
  const existing = await getDocs(matchingByDate)
  const duplicate = existing.docs.find((item) => Number(item.data().weightKg ?? item.data().weight) === weightKg)
  if (duplicate) return { id: duplicate.id, created: false }

  // A deterministic linked id makes retries and concurrent clicks idempotent.
  const reference = doc(logs, `linked_${encodeURIComponent(userId)}_${date}_${String(weightKg).replace('.', '_')}`)
  let created = false

  await runTransaction(database, async (transaction) => {
    const current = await transaction.get(reference)
    if (current.exists()) return

    transaction.set(reference, {
      userId,
      date,
      weightKg,
      source,
      time: null,
      notes: null,
      fasted: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    created = true
  })

  return { id: reference.id, created }
}

export const evolutionService = {
  async listWeights(userId: string): Promise<WeightLog[]> {
    const snapshot = await getDocs(query(collection(firestore(), 'weightLogs'), where('userId', '==', userId), orderBy('date', 'desc')))
    return sortWeightLogs(snapshot.docs.map((item) => toWeightLog(item.id, item.data()))).reverse()
  },

  async latestWeight(userId: string): Promise<WeightLog | null> {
    // The short query keeps the profile fast while still resolving multiple logs
    // from the latest calendar day by their optional time/client timestamp.
    const snapshot = await getDocs(query(collection(firestore(), 'weightLogs'), where('userId', '==', userId), orderBy('date', 'desc'), limit(50)))
    return sortWeightLogs(snapshot.docs.map((item) => toWeightLog(item.id, item.data()))).at(-1) ?? null
  },

  async createWeight(userId: string, input: Partial<WeightLogInput>): Promise<string> {
    const validated = validateWeightLogInput({ ...input, date: input.date || localIsoDate() })
    if (!validated.ok) throw errorFromValidation(validated.errors)
    const reference = await addDoc(collection(firestore(), 'weightLogs'), {
      userId,
      ...validated.value,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return reference.id
  },

  async updateWeight(userId: string, id: string, changes: Partial<WeightLogInput>): Promise<void> {
    const { reference, snapshot } = await ownedDocument('weightLogs', id, userId)
    const current = toWeightLog(id, snapshot.data())
    const validated = validateWeightLogInput({ ...current, ...changes, date: changes.date ?? current.date })
    if (!validated.ok) throw errorFromValidation(validated.errors)
    await updateDoc(reference, { ...validated.value, updatedAt: serverTimestamp() })
  },

  async deleteWeight(userId: string, id: string): Promise<void> {
    const { reference } = await ownedDocument('weightLogs', id, userId)
    await deleteDoc(reference)
  },

  async listBodyMeasurements(userId: string): Promise<BodyMeasurement[]> {
    const snapshot = await getDocs(query(collection(firestore(), 'bodyMeasurements'), where('userId', '==', userId), orderBy('date', 'desc')))
    return snapshot.docs
      .map((item) => toBodyMeasurement(item.id, item.data()))
      .sort((left, right) => right.date.localeCompare(left.date) || (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
  },

  async createBodyMeasurement(userId: string, input: Partial<BodyMeasurementInput>, options: LinkWeightOptions = {}): Promise<LinkedCreateResult> {
    const validated = validateBodyMeasurementInput({ ...input, date: input.date || localIsoDate() })
    if (!validated.ok) throw errorFromValidation(validated.errors)
    const reference = await addDoc(collection(firestore(), 'bodyMeasurements'), {
      userId,
      ...validated.value,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    const weightKg = validated.value.weightKg
    const linked = options.registerWeight && typeof weightKg === 'number'
      ? await ensureLinkedWeight(userId, validated.value.date, weightKg, 'measurement')
      : null
    return { id: reference.id, linkedWeightId: linked?.id ?? null, linkedWeightCreated: linked?.created ?? false }
  },

  async updateBodyMeasurement(userId: string, id: string, changes: Partial<BodyMeasurementInput>, options: LinkWeightOptions = {}): Promise<{ linkedWeightId: string | null; linkedWeightCreated: boolean }> {
    const { reference, snapshot } = await ownedDocument('bodyMeasurements', id, userId)
    const current = toBodyMeasurement(id, snapshot.data())
    const validated = validateBodyMeasurementInput({ ...current, ...changes, date: changes.date ?? current.date })
    if (!validated.ok) throw errorFromValidation(validated.errors)
    await updateDoc(reference, { ...validated.value, updatedAt: serverTimestamp() })
    const weightKg = validated.value.weightKg
    const linked = options.registerWeight && typeof weightKg === 'number'
      ? await ensureLinkedWeight(userId, validated.value.date, weightKg, 'measurement')
      : null
    return { linkedWeightId: linked?.id ?? null, linkedWeightCreated: linked?.created ?? false }
  },

  async deleteBodyMeasurement(userId: string, id: string): Promise<void> {
    const { reference } = await ownedDocument('bodyMeasurements', id, userId)
    await deleteDoc(reference)
  },

  async listPhysicalAssessments(userId: string): Promise<PhysicalAssessment[]> {
    const snapshot = await getDocs(query(collection(firestore(), 'physicalAssessments'), where('userId', '==', userId), orderBy('assessmentDate', 'desc')))
    return snapshot.docs
      .map((item) => toPhysicalAssessment(item.id, item.data()))
      .sort((left, right) => right.assessmentDate.localeCompare(left.assessmentDate) || (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
  },

  async createPhysicalAssessment(userId: string, input: Partial<PhysicalAssessmentInput>, options: LinkWeightOptions = {}): Promise<LinkedCreateResult> {
    const validated = validatePhysicalAssessmentInput({ ...input, assessmentDate: input.assessmentDate || localIsoDate() })
    if (!validated.ok) throw errorFromValidation(validated.errors)
    const reference = await addDoc(collection(firestore(), 'physicalAssessments'), {
      userId,
      ...withoutNullishFields(validated.value),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    const linked = options.registerWeight
      ? await ensureLinkedWeight(userId, validated.value.assessmentDate, validated.value.weightKg, 'assessment')
      : null
    return { id: reference.id, linkedWeightId: linked?.id ?? null, linkedWeightCreated: linked?.created ?? false }
  },

  async updatePhysicalAssessment(userId: string, id: string, changes: Partial<PhysicalAssessmentInput>, options: LinkWeightOptions = {}): Promise<{ linkedWeightId: string | null; linkedWeightCreated: boolean }> {
    const { reference, snapshot } = await ownedDocument('physicalAssessments', id, userId)
    const current = toPhysicalAssessment(id, snapshot.data())
    const validated = validatePhysicalAssessmentInput({ ...current, ...changes, assessmentDate: changes.assessmentDate ?? current.assessmentDate })
    if (!validated.ok) throw errorFromValidation(validated.errors)
    await updateDoc(reference, { ...nullableFieldsAsDeletes(validated.value), updatedAt: serverTimestamp() })
    const linked = options.registerWeight
      ? await ensureLinkedWeight(userId, validated.value.assessmentDate, validated.value.weightKg, 'assessment')
      : null
    return { linkedWeightId: linked?.id ?? null, linkedWeightCreated: linked?.created ?? false }
  },

  async deletePhysicalAssessment(userId: string, id: string): Promise<void> {
    const { reference } = await ownedDocument('physicalAssessments', id, userId)
    await deleteDoc(reference)
  },
}
