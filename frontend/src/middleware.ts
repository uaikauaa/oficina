import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // O refresh cookie tem Path=/api/auth e não é enviado às rotas de página.
  // Somente /api/auth/me (e, se necessário, /api/auth/refresh) confirma a sessão.
  void request;
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/clientes/:path*',
    '/clientes',
    '/ordens-servico/:path*',
    '/ordens-servico',
    '/maquinas/:path*',
    '/maquinas',
    '/produtos/:path*',
    '/produtos',
    '/estoque/:path*',
    '/estoque',
    '/relatorios/:path*',
    '/relatorios',
    '/configuracoes/:path*',
    '/configuracoes',
    '/login',
  ],
};
