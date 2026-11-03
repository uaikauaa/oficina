import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/check-doc-links.mjs FILE.md ...');
  process.exit(2);
}
let broken = 0;
for (const file of files) {
  const markdown = readFileSync(file, 'utf8');
  // A path may contain a balanced directory such as app/(authenticated)/page.tsx.
  for (const match of markdown.matchAll(/\]\(((?:[^()]|\([^()]*\))*)\)/g)) {
    const raw = match[1].split('#')[0].trim();
    // file:// links in historical reports point to the author's old workstation.
    if (!raw || /^(?:https?:|mailto:|data:|file:)/i.test(raw)) continue;
    const path = resolve(dirname(file), decodeURIComponent(raw.replace(/^<|>$/g, '')));
    if (!existsSync(path)) {
      console.error(`${file}: missing ${raw}`);
      broken++;
    }
  }
}
console.log(`${files.length} Markdown files checked; ${broken} missing local links`);
process.exitCode = broken ? 1 : 0;
