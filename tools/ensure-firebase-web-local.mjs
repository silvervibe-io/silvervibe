/**
 * Ensures each Angular app has a gitignored firebase-web.local.ts
 * (copied from the committed example when missing).
 */
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apps = ['silvervibe', 'vibestandup'];

for (const app of apps) {
  const dir = join(root, 'apps', app, 'src', 'environments');
  const local = join(dir, 'firebase-web.local.ts');
  const example = join(dir, 'firebase-web.local.example.ts');
  if (!existsSync(local)) {
    if (!existsSync(example)) {
      console.warn(`Missing ${example}; skip ${app}`);
      continue;
    }
    copyFileSync(example, local);
    console.log(`Created ${local} (gitignored — fill from .env)`);
  }
}
