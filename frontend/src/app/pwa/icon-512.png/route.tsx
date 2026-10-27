import { renderPwaIcon } from '@/lib/pwaIcon';

export const runtime = 'nodejs';

export async function GET() {
  return renderPwaIcon(512);
}
