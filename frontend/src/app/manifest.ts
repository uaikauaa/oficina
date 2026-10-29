import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Oficina Gestão',
    short_name: 'Oficina Gestão',
    description: 'Gestão de clientes, equipamentos, peças, estoque e ordens de serviço.',
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#0b1020',
    lang: 'pt-BR',
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
