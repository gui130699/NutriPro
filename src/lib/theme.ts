import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import type { ThemePreference } from './types'

export type { ThemePreference } from './types'

export type ResolvedTheme = Exclude<ThemePreference, 'system'>

export const THEME_STORAGE_KEY = 'nutripro.theme'
export const USER_PREFERENCES_COLLECTION = 'userPreferences'
export const DEFAULT_THEME: ThemePreference = 'system'

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function parseThemePreference(value: unknown): ThemePreference | null {
  return isThemePreference(value) ? value : null
}

function getBrowserStorage(): ThemeStorage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getStoredThemePreference(storage: ThemeStorage | null = getBrowserStorage()): ThemePreference {
  if (!storage) return DEFAULT_THEME

  try {
    return parseThemePreference(storage.getItem(THEME_STORAGE_KEY)) ?? DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function setStoredThemePreference(
  preference: ThemePreference,
  storage: ThemeStorage | null = getBrowserStorage(),
): void {
  if (!storage) return

  try {
    storage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Storage can be disabled by the browser. The active in-memory theme still works.
  }
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(preference: ThemePreference, prefersDark = systemPrefersDark()): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light'
  return preference
}

/**
 * Sets both the Tailwind-compatible `dark` class and a data attribute for
 * component-level CSS tokens. It returns the actual palette in use.
 */
export function applyTheme(
  preference: ThemePreference,
  root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement,
  prefersDark = systemPrefersDark(),
): ResolvedTheme {
  const resolvedTheme = resolveTheme(preference, prefersDark)

  if (root) {
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.dataset.theme = resolvedTheme
    root.style.colorScheme = resolvedTheme
  }

  return resolvedTheme
}

/**
 * Reads a signed-in user's cloud preference. Calling code can safely fall
 * back to localStorage when Firebase is not configured or the document does
 * not exist yet.
 */
export async function loadThemePreference(userId: string): Promise<ThemePreference | null> {
  if (!db || !userId) return null

  const snapshot = await getDoc(doc(db, USER_PREFERENCES_COLLECTION, userId))
  return parseThemePreference(snapshot.data()?.theme)
}

/**
 * Persists the choice without requiring a theme-specific service module.
 * The preference document is keyed by uid so Firestore rules can enforce
 * ownership directly. Returns `false` when Firebase is not configured.
 */
export async function persistThemePreference(userId: string, theme: ThemePreference): Promise<boolean> {
  if (!db || !userId) return false

  const preferenceRef = doc(db, USER_PREFERENCES_COLLECTION, userId)

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(preferenceRef)
    const payload = {
      userId,
      theme,
      updatedAt: serverTimestamp(),
      ...(!existing.exists() || existing.data().createdAt === undefined
        ? { createdAt: serverTimestamp() }
        : {}),
    }

    transaction.set(preferenceRef, payload, { merge: true })
  })

  return true
}
