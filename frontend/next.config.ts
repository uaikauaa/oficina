import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // AUDIT-001: Mesma origem no Next.js (Vercel).
    // Encaminha requisições /api/* para o container backend Spring Boot.
    const backendUrl =
      process.env.INTERNAL_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:8080';

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
