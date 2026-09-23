import type { NextConfig } from "next";
import { getSecurityHeaders } from "./src/lib/securityHeaders.ts";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: getSecurityHeaders(process.env.NODE_ENV === 'production'),
      },
    ];
  },
  async rewrites() {
    // AUDIT-001 / GAP-04: Mesma origem no Next.js (Vercel).
    // Encaminha requisições /api/* para o container backend Spring Boot.
    // Em produção, a variável de ambiente INTERNAL_BACKEND_URL (ou NEXT_PUBLIC_API_URL) é obrigatória.
    const isProduction = process.env.NODE_ENV === 'production';
    const backendUrl =
      process.env.INTERNAL_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      (isProduction ? '' : 'http://localhost:8080');

    if (isProduction && !backendUrl) {
      throw new Error(
        '[ERRO-PROD] Em ambiente de produção, a variável de ambiente INTERNAL_BACKEND_URL (ou NEXT_PUBLIC_API_URL) é obrigatória para o proxy /api/* e não pode utilizar fallback para localhost.'
      );
    }

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
