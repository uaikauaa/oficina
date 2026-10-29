'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface DeferredInstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

interface PwaInstallContextValue {
  isInstalled: boolean;
  canPrompt: boolean;
  requestInstallation: () => Promise<InstallOutcome>;
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

export function usePwaInstall(): PwaInstallContextValue {
  const context = useContext(PwaInstallContext);
  if (!context) throw new Error('usePwaInstall must be used inside PwaInstallProvider');
  return context;
}

export default function PwaInstallProvider({ children }: { children: ReactNode }) {
  const deferredPrompt = useRef<DeferredInstallPrompt | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const checkInstalled = () => {
      const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsInstalled(standalone.matches || iosStandalone);
    };

    const onBeforeInstallPrompt = (rawEvent: Event) => {
      const event = rawEvent as DeferredInstallPrompt;
      event.preventDefault();
      deferredPrompt.current = event;
      setCanPrompt(true);
    };
    const onAppInstalled = () => {
      deferredPrompt.current = null;
      setCanPrompt(false);
      setIsInstalled(true);
    };

    checkInstalled();
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    standalone.addEventListener('change', checkInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      standalone.removeEventListener('change', checkInstalled);
    };
  }, []);

  const requestInstallation = useCallback(async (): Promise<InstallOutcome> => {
    const promptEvent = deferredPrompt.current;
    if (!promptEvent) return 'unavailable';

    // Um prompt pode ser utilizado apenas uma vez por evento recebido do navegador.
    deferredPrompt.current = null;
    setCanPrompt(false);
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      return outcome;
    } catch {
      return 'unavailable';
    }
  }, []);

  return (
    <PwaInstallContext.Provider value={{ isInstalled, canPrompt, requestInstallation }}>
      {children}
    </PwaInstallContext.Provider>
  );
}
