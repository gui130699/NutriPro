import { describe, expect, it } from 'vitest'
import {
  applyTheme,
  getStoredThemePreference,
  resolveTheme,
  setStoredThemePreference,
  THEME_STORAGE_KEY,
} from './theme'

function createRoot() {
  const classNames = new Set<string>()
  const root = {
    classList: {
      toggle: (name: string, force?: boolean) => {
        if (force) classNames.add(name)
        else classNames.delete(name)
        return Boolean(force)
      },
      contains: (name: string) => classNames.has(name),
    },
    dataset: {} as DOMStringMap,
    style: {} as CSSStyleDeclaration,
  } as unknown as HTMLElement

  return { root, classNames }
}

describe('tema da interface', () => {
  it('resolve os temas claro, escuro e do sistema', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('system', true)).toBe('dark')
  })

  it('aplica a classe dark somente para a paleta escura', () => {
    const { root, classNames } = createRoot()

    expect(applyTheme('dark', root, false)).toBe('dark')
    expect(classNames.has('dark')).toBe(true)
    expect(root.dataset.theme).toBe('dark')

    expect(applyTheme('system', root, false)).toBe('light')
    expect(classNames.has('dark')).toBe(false)
    expect(root.dataset.theme).toBe('light')
  })

  it('usa a preferência salva e ignora valores inválidos', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    }

    setStoredThemePreference('dark', storage)
    expect(store.get(THEME_STORAGE_KEY)).toBe('dark')
    expect(getStoredThemePreference(storage)).toBe('dark')

    store.set(THEME_STORAGE_KEY, 'sepia')
    expect(getStoredThemePreference(storage)).toBe('system')
  })
})
