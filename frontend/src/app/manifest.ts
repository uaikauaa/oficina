import type { MetadataRoute } from 'next';
import { BRAND_BACKGROUND } from '@/lib/brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Oficina Gestão',
    short_name: 'Oficina Gestão',
    description: 'Gestão de clientes, equipamentos, peças, estoque e ordens de serviço.',
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    background_color: BRAND_BACKGROUND,
    theme_color: BRAND_BACKGROUND,
    lang: 'pt-BR',
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
