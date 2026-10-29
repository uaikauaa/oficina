'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X } from 'lucide-react';
import { usePwaInstall } from '@/components/PwaInstallProvider';
import DialogFocus from '@/components/ui/DialogFocus';

export default function InstallAppButton() {
  const { isInstalled, canPrompt, requestInstallation } = usePwaInstall();
  const [showHelp, setShowHelp] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showHelp) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowHelp(false);
    };
    window.addEventListener('keydown', handleEscape);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showHelp]);

  if (isInstalled) return null;

  const handleClick = async () => {
    const result = canPrompt ? await requestInstallation() : 'unavailable';
    // Nunca anunciar que o aplicativo foi instalado antes do evento appinstalled.
    if (result === 'unavailable') setShowHelp(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Instalar aplicativo Oficina Gestão"
        title="Instalar o Oficina Gestão no computador ou celular"
        className="ui-icon-btn flex items-center gap-1.5 px-2.5 py-1.5 border border-line text-muted hover:bg-elevated hover:text-ink text-xs transition-colors cursor-pointer"
      >
        <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="hidden xl:inline whitespace-nowrap">Instalar App</span>
      </button>
      {showHelp && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas/80 p-4 print:hidden"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setShowHelp(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            aria-describedby="pwa-install-description"
            className="ui-dialog w-full max-w-md max-h-[90dvh] overflow-y-auto p-5 text-ink"
          >
            <DialogFocus />
            <div className="flex justify-between items-start gap-3">
              <h2 id="pwa-install-title" className="ui-section-title">
                Instalar Oficina Gestão
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setShowHelp(false)}
                className="ui-icon-btn text-muted hover:text-ink hover:bg-elevated"
                aria-label="Fechar instruções de instalação"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div id="pwa-install-description" className="mt-3 space-y-3 text-sm text-muted">
              <p>O navegador não disponibilizou a instalação automática nesta página.</p>
              <p><strong className="text-ink">Windows (Chrome ou Edge):</strong> abra o menu do navegador e escolha <em>Instalar Oficina Gestão</em> ou <em>Aplicativos / Instalar este site como aplicativo</em>.</p>
              <p>Depois de abrir o aplicativo, clique com o botão direito no ícone na barra de tarefas e escolha <strong className="text-ink">Fixar na barra de tarefas</strong>.</p>
              <p><strong className="text-ink">Android:</strong> menu do Chrome, Instalar aplicativo. <strong className="text-ink">iPhone:</strong> Safari, Compartilhar, Adicionar à Tela de Início.</p>
              <p className="text-xs text-muted">Requer navegador compatível e HTTPS no domínio publicado. Não disponibiliza estoque ou OS offline.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="ui-btn ui-btn-primary mt-5 w-full"
            >
              Entendi
            </button>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
