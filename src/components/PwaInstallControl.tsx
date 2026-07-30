import { Download, PlusSquare, Share, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { usePwaInstall } from '../hooks/usePwaInstall'

export function PwaInstallControl() {
  const {
    isInstallable,
    isInstalled,
    isIos,
    isIosSafari,
    requestInstall,
  } = usePwaInstall()
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const headingId = useId()

  useEffect(() => {
    if (!isGuideOpen) return undefined

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsGuideOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isGuideOpen])

  if (isInstalled || (!isInstallable && !isIos)) return null

  async function handleInstall() {
    if (isIos) {
      setIsGuideOpen(true)
      return
    }

    await requestInstall()
  }

  return (
    <div className="pwa-install-control">
      <button
        type="button"
        className="pwa-install-trigger"
        onClick={handleInstall}
        aria-haspopup={isIos ? 'dialog' : undefined}
      >
        <Download size={17} aria-hidden="true" />
        <span>Instalar app</span>
      </button>

      {isGuideOpen && (
        <div className="pwa-install-backdrop" role="presentation">
          <section
            className="pwa-install-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
          >
            <button
              type="button"
              className="pwa-install-close"
              onClick={() => setIsGuideOpen(false)}
              aria-label="Fechar instruções de instalação"
            >
              <X size={18} aria-hidden="true" />
            </button>
            <span className="pwa-install-dialog-icon"><Download size={20} /></span>
            <p className="pwa-install-eyebrow">NutriPro no seu celular</p>
            <h2 id={headingId}>Instale para acessar mais rápido</h2>
            {isIosSafari ? (
              <>
                <p>No Safari, a instalação é feita pelo menu Compartilhar.</p>
                <ol className="pwa-install-steps">
                  <li><span><Share size={17} /></span><div><strong>Toque em Compartilhar</strong><small>Use o ícone de compartilhar na barra do Safari.</small></div></li>
                  <li><span><PlusSquare size={17} /></span><div><strong>Escolha “Adicionar à Tela de Início”</strong><small>Confirme em Adicionar para criar o ícone do NutriPro.</small></div></li>
                </ol>
              </>
            ) : (
              <>
                <p>Para instalar no iPhone ou iPad, abra esta página no Safari.</p>
                <ol className="pwa-install-steps">
                  <li><span><Share size={17} /></span><div><strong>Abra no Safari</strong><small>Outros navegadores no iOS não exibem o instalador diretamente.</small></div></li>
                  <li><span><PlusSquare size={17} /></span><div><strong>Use “Adicionar à Tela de Início”</strong><small>O item está dentro do menu Compartilhar.</small></div></li>
                </ol>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
