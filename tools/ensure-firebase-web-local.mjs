/**
 * Ensures Angular local env modules exist before build/serve.
 * Syncs from `.env` when possible; otherwise copies committed examples.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sync = join(root, 'tools', 'sync-angular-env-from-env.mjs');

const result = spawnSync(process.execPath, [sync], {
  cwd: root,
  stdio: 'inherit',
});

if (result.status === 0) {
  process.exit(0);
}

for (const app of ['silvervibe', 'vibestandup']) {
  const dir = join(root, 'apps', app, 'src', 'environments');
  for (const [localName, exampleName] of [
    ['firebase-web.local.ts', 'firebase-web.local.example.ts'],
    ['growthbook.local.ts', 'growthbook.local.example.ts'],
  ]) {
    const local = join(dir, localName);
    const example = join(dir, exampleName);
    if (!existsSync(local) && existsSync(example)) {
      copyFileSync(example, local);
      console.log(`Created empty ${local} from example`);
    }
  }
}
