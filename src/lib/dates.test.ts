import { describe, expect, it } from 'vitest'
import { compareLocalIsoDates, isLocalIsoDate, localIsoDate } from './dates'

describe('datas locais', () => {
  it('gera a data de calendário usando o fuso local, sem deslocar para UTC', () => {
    const date = new Date('2026-07-30T01:00:00.000Z')
    Object.defineProperty(date, 'getTimezoneOffset', { value: () => 180 })

    expect(localIsoDate(date)).toBe('2026-07-29')
  })

  it('aceita somente datas reais no formato AAAA-MM-DD', () => {
    expect(isLocalIsoDate('2026-02-28')).toBe(true)
    expect(isLocalIsoDate('2026-02-29')).toBe(false)
    expect(isLocalIsoDate('30/07/2026')).toBe(false)
    expect(compareLocalIsoDates('2026-07-29', '2026-07-30')).toBeLessThan(0)
  })
})
