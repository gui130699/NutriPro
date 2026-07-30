import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getPwaInstallEnvironment,
  isStandaloneMode,
  type PwaInstallEnvironment,
} from '../lib/pwa-install'

type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type IosNavigator = Navigator & { standalone?: boolean }

const defaultEnvironment: PwaInstallEnvironment = {
  isIos: false,
  isIosSafari: false,
}

export function usePwaInstall() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [environment, setEnvironment] = useState(defaultEnvironment)

  useEffect(() => {
    const browserNavigator = window.navigator as IosNavigator
    const isStandalone = isStandaloneMode(
      window.matchMedia('(display-mode: standalone)').matches,
      browserNavigator.standalone,
    )

    setEnvironment(
      getPwaInstallEnvironment(
        browserNavigator.userAgent,
        browserNavigator.platform,
        browserNavigator.maxTouchPoints,
      ),
    )
    setIsInstalled(isStandalone)

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      deferredPrompt.current = event as BeforeInstallPromptEvent
      setIsInstallable(true)
    }

    const onAppInstalled = () => {
      deferredPrompt.current = null
      setIsInstalled(true)
      setIsInstallable(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const requestInstall = useCallback(async (): Promise<InstallOutcome> => {
    const prompt = deferredPrompt.current
    if (!prompt) return 'unavailable'

    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') setIsInstalled(true)
      return outcome
    } catch {
      return 'unavailable'
    } finally {
      deferredPrompt.current = null
      setIsInstallable(false)
    }
  }, [])

  return {
    ...environment,
    isInstallable,
    isInstalled,
    requestInstall,
  }
}
