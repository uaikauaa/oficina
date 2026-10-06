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
    return <div className="min-h-screen bg-slate-950" aria-label="Verificando sessão" />;
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Header user={user} />
        <div className="flex-1 flex flex-col">{children}</div>
      </div>
    </AuthContext.Provider>
  );
}
