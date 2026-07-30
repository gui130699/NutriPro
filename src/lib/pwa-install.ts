export type PwaInstallEnvironment = {
  isIos: boolean
  isIosSafari: boolean
}

const IOS_DEVICE_PATTERN = /iPad|iPhone|iPod/i
const IOS_ALTERNATIVE_BROWSER_PATTERN = /CriOS|FxiOS|EdgiOS|OPiOS/i

export function isIosDevice(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
) {
  return IOS_DEVICE_PATTERN.test(userAgent)
    || (platform === 'MacIntel' && maxTouchPoints > 1)
}

export function getPwaInstallEnvironment(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
): PwaInstallEnvironment {
  const isIos = isIosDevice(userAgent, platform, maxTouchPoints)

  return {
    isIos,
    isIosSafari: isIos && !IOS_ALTERNATIVE_BROWSER_PATTERN.test(userAgent),
  }
}

export function isStandaloneMode(
  displayModeIsStandalone: boolean,
  iosNavigatorStandalone?: boolean,
) {
  return displayModeIsStandalone || iosNavigatorStandalone === true
}
