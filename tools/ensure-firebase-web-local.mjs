/**
 * Ensures Angular apps have firebase-web.local.ts before build/serve.
 * Prefers syncing from `.env`; falls back to copying the example when needed.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sync = join(root, 'tools', 'sync-firebase-web-from-env.mjs');

const result = spawnSync(process.execPath, [sync], {
  cwd: root,
  stdio: 'inherit',
});

if (result.status === 0) {
  process.exit(0);
}

for (const app of ['silvervibe', 'vibestandup']) {
  const dir = join(root, 'apps', app, 'src', 'environments');
  const local = join(dir, 'firebase-web.local.ts');
  const example = join(dir, 'firebase-web.local.example.ts');
  if (!existsSync(local) && existsSync(example)) {
    copyFileSync(example, local);
    console.log(`Created empty ${local} from example`);
  }
}
