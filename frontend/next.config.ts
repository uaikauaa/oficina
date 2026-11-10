import type { NextConfig } from "next";
import { getSecurityHeaders } from "./src/lib/securityHeaders.ts";

const nextConfig: NextConfig = {
  output: 'standalone',
  generateBuildId: async () => process.env.OFICINA_BUILD_ID || null,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: getSecurityHeaders(process.env.NODE_ENV === 'production').filter(header => header.key !== 'Content-Security-Policy'),
      },
      {
        source: '/convite',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ];
  },
};

export default nextConfig;
