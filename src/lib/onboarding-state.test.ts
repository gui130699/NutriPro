import { describe, expect, it, vi } from 'vitest'
import { resolveOnboardingState, type ProfileSnapshotLike } from './onboarding-state'

const snapshot = (exists: boolean, onboardingCompleted?: boolean): ProfileSnapshotLike => ({
  exists: () => exists,
  data: () => exists ? { onboardingCompleted } : undefined,
})

describe('estado do onboarding', () => {
  it('distingue perfil completo, incompleto e documento inexistente', async () => {
    await expect(resolveOnboardingState(async () => snapshot(true, true))).resolves.toBe('complete')
    await expect(resolveOnboardingState(async () => snapshot(true, false))).resolves.toBe('incomplete')
    await expect(resolveOnboardingState(async () => snapshot(false))).resolves.toBe('incomplete')
  })

  it.each(['unavailable', 'deadline-exceeded', 'permission-denied'])(
    'mantém %s como erro operacional',
    async (code) => {
      await expect(resolveOnboardingState(async () => Promise.reject(Object.assign(new Error(code), { code })))).resolves.toBe('error')
    },
  )

  it('permite uma nova tentativa bem-sucedida sem loop automático', async () => {
    const read = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }))
      .mockResolvedValueOnce(snapshot(true, true))
    await expect(resolveOnboardingState(read)).resolves.toBe('error')
    expect(read).toHaveBeenCalledTimes(1)
    await expect(resolveOnboardingState(read)).resolves.toBe('complete')
    expect(read).toHaveBeenCalledTimes(2)
  })
})
