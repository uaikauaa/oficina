'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { CurrentUser } from '@/lib/types';
import { apiFetch } from '@/lib/api';

interface AuthContextType {
  user: CurrentUser | null;
  setUser: React.Dispatch<React.SetStateAction<CurrentUser | null>>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadUser() {
      try {
        const res = await apiFetch('/api/auth/me');
        if (!res.ok) {
          if (!ignore) router.replace(`/login?redirect=${encodeURIComponent(pathname)}&sessionChecked=1`);
          return;
        }
        const data = await res.json();
        if (!ignore) {
          setUser(data);
        }
      } catch {
        if (!ignore) router.replace(`/login?redirect=${encodeURIComponent(pathname)}&sessionChecked=1`);
      }
    }
    loadUser();
    return () => {
      ignore = true;
    };
  }, [router, pathname]);

  if (!user) {
    return <div className="min-h-screen bg-canvas" aria-label="Verificando sessão" />;
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <div className="min-h-screen bg-canvas text-ink flex flex-col print:bg-white print:min-h-0">
        <a href="#conteudo-principal" className="ui-btn ui-btn-primary ui-skip-link print:hidden">Ir para o conteúdo</a>
        <Header user={user} />
        <div id="conteudo-principal" tabIndex={-1} className="flex-1 flex flex-col min-w-0">{children}</div>
      </div>
    </AuthContext.Provider>
  );
}
