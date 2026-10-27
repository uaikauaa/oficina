import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

// Converte a marca PNG existente do sistema em icones reais 192/512.
// Sem biblioteca extra, cache da API ou service worker que possa tocar dados privados.
export async function renderPwaIcon(size: 192 | 512): Promise<ImageResponse> {
  const logo = await readFile(join(process.cwd(), 'public', 'logo-icone.png'));
  const logoData = 'data:image/png;base64,' + logo.toString('base64');
  const iconSize = Math.round(size * 0.72);

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#0b1020',
          borderRadius: Math.round(size * 0.18),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoData}
          width={iconSize}
          height={iconSize}
          alt=""
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        'Cache-Control': 'public, max-age=86400',
      },
    },
  );
}
