'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePwaInstall } from '@/components/PwaInstallProvider';

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
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 text-xs font-semibold transition-colors cursor-pointer"
      >
        <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="hidden xl:inline whitespace-nowrap">Instalar App</span>
      </button>
      {showHelp && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 print:hidden"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setShowHelp(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            aria-describedby="pwa-install-description"
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0c101a] p-5 text-slate-100 shadow-2xl"
          >
            <div className="flex justify-between items-start gap-3">
              <h2 id="pwa-install-title" className="text-lg font-bold text-white">
                Instalar Oficina Gestão
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setShowHelp(false)}
                className="p-1 text-slate-400 hover:text-white rounded-md"
                aria-label="Fechar instruções de instalação"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div id="pwa-install-description" className="mt-3 space-y-3 text-sm text-slate-300">
              <p>O navegador não disponibilizou a instalação automática nesta página.</p>
              <p><strong className="text-white">Windows (Chrome ou Edge):</strong> abra o menu do navegador e escolha <em>Instalar Oficina Gestão</em> ou <em>Aplicativos → Instalar este site como aplicativo</em>.</p>
              <p>Depois de abrir o aplicativo, clique com o botão direito no ícone na barra de tarefas e escolha <strong className="text-white">Fixar na barra de tarefas</strong>.</p>
              <p><strong className="text-white">Android:</strong> menu do Chrome → Instalar aplicativo. <strong className="text-white">iPhone:</strong> Safari → Compartilhar → Adicionar à Tela de Início.</p>
              <p className="text-xs text-slate-400">Requer navegador compatível e HTTPS no domínio publicado. Não disponibiliza estoque ou OS offline.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-5 w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
            >
              Entendi
            </button>
          </section>
        </div>
      )}
    </>
  );
}
