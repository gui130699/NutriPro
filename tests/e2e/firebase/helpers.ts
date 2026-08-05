import { expect, type Page } from '@playwright/test'
import { deleteApp, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

export const TEST_PROJECT_ID = 'nutripro-test'
export const TEST_PASSWORD = 'SenhaSomenteTeste123!'
export const USER_A_EMAIL = 'usuario-a@nutripro.test'
export const USER_B_EMAIL = 'usuario-b@nutripro.test'

function assertEmulators() {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST ?? ''
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? ''
  if (!/^(127\.0\.0\.1|localhost):8080$/.test(firestoreHost) || !/^(127\.0\.0\.1|localhost):9099$/.test(authHost)) {
    throw new Error('Testes autenticados recusados: Auth e Firestore Emulator não estão ativos nas portas esperadas.')
  }
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== TEST_PROJECT_ID) {
    throw new Error(`Projeto inesperado: ${process.env.GCLOUD_PROJECT}`)
  }
}

function adminApp() {
  assertEmulators()
  return getApps().find((app) => app.name === 'nutripro-e2e')
    ?? initializeApp({ projectId: TEST_PROJECT_ID }, 'nutripro-e2e')
}

export const adminAuth = () => getAuth(adminApp())
export const adminDb = () => getFirestore(adminApp())

export async function clearEmulators() {
  assertEmulators()
  const [firestoreResponse, authResponse] = await Promise.all([
    fetch(`http://127.0.0.1:8080/emulator/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' }),
    fetch(`http://127.0.0.1:9099/emulator/v1/projects/${TEST_PROJECT_ID}/accounts`, { method: 'DELETE' }),
  ])
  if (!firestoreResponse.ok || !authResponse.ok) {
    throw new Error(`Falha ao limpar emuladores: Firestore ${firestoreResponse.status}, Auth ${authResponse.status}`)
  }
}

export async function closeAdminApp() {
  const app = getApps().find((item) => item.name === 'nutripro-e2e')
  if (app) await deleteApp(app)
}

export async function createTestUser(email: string) {
  return adminAuth().createUser({ email, password: TEST_PASSWORD, emailVerified: true })
}

export async function seedCompletedProfile(uid: string, name: string) {
  const timestamp = FieldValue.serverTimestamp()
  await Promise.all([
    adminDb().collection('profiles').doc(uid).set({
      userId: uid,
      name,
      displayName: name,
      email: null,
      birthDate: '1999-06-13',
      heightCm: 175,
      goal: 'Manutenção',
      onboardingCompleted: true,
      onboardingCompletedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    adminDb().collection('goals').doc(uid).set({
      userId: uid,
      calories: 2000,
      protein: 120,
      carbs: 250,
      fat: 65,
      fiber: 30,
      waterMl: 2500,
      weightGoalKg: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  ])
}

export async function login(page: Page, email: string) {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.locator('#auth-password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click()
  // Do not let callers navigate away while the Auth state change and the
  // onboarding gate are still resolving. This removes a race that only shows
  // up sporadically in longer emulator suites.
  await expect(page).toHaveURL(/\/(?:onboarding)?$/)
}

export async function expectDashboard(page: Page) {
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: /vamos cuidar de você/i })).toBeVisible()
}
