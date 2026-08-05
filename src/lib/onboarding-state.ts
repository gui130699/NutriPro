export type OnboardingState = 'loading' | 'complete' | 'incomplete' | 'error'

export type ProfileSnapshotLike = {
  exists: () => boolean
  data: () => { onboardingCompleted?: unknown } | undefined
}

/**
 * A missing/incomplete profile is a domain state. Any rejected read is an
 * operational error and must never be interpreted as permission to recreate
 * user data.
 */
export async function resolveOnboardingState(
  readProfile: () => Promise<ProfileSnapshotLike>,
): Promise<Exclude<OnboardingState, 'loading'>> {
  try {
    const snapshot = await readProfile()
    if (!snapshot.exists()) return 'incomplete'
    return snapshot.data()?.onboardingCompleted === true ? 'complete' : 'incomplete'
  } catch {
    return 'error'
  }
}
