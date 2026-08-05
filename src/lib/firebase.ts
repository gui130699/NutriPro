import { getApp, getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

const firebaseConfig = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID }

// The browser smoke suite intentionally exercises only local UI behavior.  It
// must not wait for, or write to, the production Firebase project.
const e2eMode = import.meta.env.VITE_E2E === 'true'
const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean)
const useFirebaseEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && !import.meta.env.PROD

export const firebaseConfigured = e2eMode || hasFirebaseConfig
const app = !e2eMode && hasFirebaseConfig ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null
export const auth = app ? getAuth(app) : null

type FirebaseGlobal = typeof globalThis & {
  __nutriproFirebaseEmulatorsConnected?: boolean
  __nutriproFirestore?: Firestore
}
const firebaseGlobal = globalThis as FirebaseGlobal

// IndexedDB persistence keeps already visited routes and queued writes usable
// through brief connection losses. The global guard also makes Vite HMR reuse
// the one Firestore instance that Firebase permits per app.
export const db = app
  ? firebaseGlobal.__nutriproFirestore ?? initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
  : null
if (db) firebaseGlobal.__nutriproFirestore = db

if (useFirebaseEmulators && auth && db && !firebaseGlobal.__nutriproFirebaseEmulatorsConnected) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  firebaseGlobal.__nutriproFirebaseEmulatorsConnected = true
}
