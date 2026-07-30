import { describe, expect, it } from 'vitest'
import {
  getPwaInstallEnvironment,
  isIosDevice,
  isStandaloneMode,
} from './pwa-install'

describe('instalação PWA', () => {
  it('reconhece iPhone e iPad com user agent de desktop', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 'MacIntel', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 0)).toBe(false)
  })

  it('diferencia Safari de outros navegadores no iOS', () => {
    expect(getPwaInstallEnvironment(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1',
      'iPhone',
      5,
    )).toEqual({ isIos: true, isIosSafari: true })

    expect(getPwaInstallEnvironment(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/130.0 Mobile/15E148 Safari/604.1',
      'iPhone',
      5,
    )).toEqual({ isIos: true, isIosSafari: false })
  })

  it('oculta a instalação quando já está em modo standalone', () => {
    expect(isStandaloneMode(true, false)).toBe(true)
    expect(isStandaloneMode(false, true)).toBe(true)
    expect(isStandaloneMode(false, false)).toBe(false)
  })
})
