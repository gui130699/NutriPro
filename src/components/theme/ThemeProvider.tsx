import { createContext, useContext, type ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useTheme, type UseThemeResult } from '../../hooks/useTheme'

const ThemeContext = createContext<UseThemeResult | null>(null)

/**
 * The only place that synchronizes the appearance preference with Firestore.
 * Pages consume this context so opening Profile never starts a second sync.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const theme = useTheme(user?.uid)

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

// oxlint-disable-next-line react/only-export-components -- this hook is the provider's public consumer API.
export function useThemeContext(): UseThemeResult {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useThemeContext deve ser usado dentro de ThemeProvider.')
  return context
}
