import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyTheme,
  getStoredThemePreference,
  isThemePreference,
  loadThemePreference,
  persistThemePreference,
  setStoredThemePreference,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from '../lib/theme'

export type ThemeSyncError = Error | null

export type UseThemeResult = {
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  isSyncing: boolean
  syncError: ThemeSyncError
  setTheme: (theme: ThemePreference) => Promise<boolean>
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Não foi possível sincronizar a preferência de tema.')
}

/**
 * Maintains an immediate local theme and, for signed-in users, keeps it in
 * sync with `userPreferences/{uid}`. Pass the uid from the auth context.
 */
export function useTheme(userId?: string | null): UseThemeResult {
  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredThemePreference())
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => applyTheme(getStoredThemePreference()))
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<ThemeSyncError>(null)
  const didChooseThemeRef = useRef(false)
  const syncRequestRef = useRef(0)

  const applyAndStore = useCallback((nextTheme: ThemePreference) => {
    setStoredThemePreference(nextTheme)
    setThemeState(nextTheme)
    setResolvedTheme(applyTheme(nextTheme))
  }, [])

  useEffect(() => {
    setResolvedTheme(applyTheme(theme))
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') setResolvedTheme(applyTheme(theme))
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return
      const nextTheme = isThemePreference(event.newValue) ? event.newValue : getStoredThemePreference()
      setThemeState(nextTheme)
      setResolvedTheme(applyTheme(nextTheme))
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    const requestId = ++syncRequestRef.current
    didChooseThemeRef.current = false

    if (!userId) {
      setIsSyncing(false)
      setSyncError(null)
      return undefined
    }

    let cancelled = false
    setIsSyncing(true)
    setSyncError(null)

    void loadThemePreference(userId)
      .then((cloudTheme) => {
        if (cancelled || didChooseThemeRef.current || !cloudTheme) return
        applyAndStore(cloudTheme)
      })
      .catch((error: unknown) => {
        if (!cancelled && requestId === syncRequestRef.current) setSyncError(toError(error))
      })
      .finally(() => {
        if (!cancelled && requestId === syncRequestRef.current) setIsSyncing(false)
      })

    return () => {
      cancelled = true
    }
  }, [applyAndStore, userId])

  const setTheme = useCallback(
    async (nextTheme: ThemePreference): Promise<boolean> => {
      didChooseThemeRef.current = true
      applyAndStore(nextTheme)
      setSyncError(null)

      if (!userId) return true

      const requestId = ++syncRequestRef.current
      setIsSyncing(true)

      try {
        const persisted = await persistThemePreference(userId, nextTheme)
        return persisted
      } catch (error) {
        if (requestId === syncRequestRef.current) setSyncError(toError(error))
        return false
      } finally {
        if (requestId === syncRequestRef.current) setIsSyncing(false)
      }
    },
    [applyAndStore, userId],
  )

  return { theme, resolvedTheme, isSyncing, syncError, setTheme }
}
