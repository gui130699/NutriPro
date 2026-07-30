import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID }

// The browser smoke suite intentionally exercises only local UI behavior.  It
// must not wait for, or write to, the production Firebase project.
const e2eMode = import.meta.env.VITE_E2E === 'true'
const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean)

export const firebaseConfigured = e2eMode || hasFirebaseConfig
const app = !e2eMode && hasFirebaseConfig ? initializeApp(firebaseConfig) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
