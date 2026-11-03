import type { NextConfig } from "next";
import { getSecurityHeaders } from "./src/lib/securityHeaders.ts";

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: getSecurityHeaders(process.env.NODE_ENV === 'production').filter(header => header.key !== 'Content-Security-Policy'),
      },
    ];
  },
};

export default nextConfig;
