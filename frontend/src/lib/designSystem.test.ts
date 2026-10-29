import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const color = (name: string) => css.match(new RegExp(`--${name}: (#[0-9a-f]{6});`, 'i'))![1];
function luminance(hex: string) {
  return hex.slice(1).match(/../g)!.map(part => parseInt(part, 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('design system: texto normal AA e controles em todas as superfícies sólidas', () => {
  for (const bg of ['background', 'surface', 'elevated', 'hover']) {
    for (const fg of ['foreground', 'muted', 'subtle', 'accent', 'danger']) {
      assert.ok(contrast(color(fg), color(bg)) >= 4.5, `${fg} em ${bg} deve atingir 4.5:1`);
    }
    assert.ok(contrast(color('control'), color(bg)) >= 3, `borda em ${bg} deve atingir 3:1`);
  }
  assert.ok(contrast(color('background'), color('accent')) >= 4.5);
  assert.ok(contrast(color('background'), color('danger')) >= 4.5);
});

test('design system: UI estática sem emojis, cores decorativas externas ou hex espalhados', () => {
  for (const root of ['src/app', 'src/components', 'src/lib']) {
    for (const entry of readdirSync(root, { recursive: true }) as string[]) {
      if (!/\.(tsx|ts)$/.test(entry) || /\.test\.ts$/.test(entry)) continue;
      const file = join(root, entry);
      // Documento em papel usa cores claras/preto; é uma mídia separada.
      if (entry === 'OrdemServicoImpressao.tsx') continue;
      const text = readFileSync(file, 'utf8');
      assert.doesNotMatch(text, /\p{Extended_Pictographic}/u, file);
      assert.doesNotMatch(text, /(?:bg|text|border|ring|from|via|to|shadow)-(?:blue|sky|indigo|cyan|purple|green|emerald|rose|orange|amber|red)-\d/, file);
      assert.doesNotMatch(text, /\[#[\da-fA-F]{3,8}\]/, file);
    }
  }
});
