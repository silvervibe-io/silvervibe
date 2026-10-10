/**
 * @deprecated Prefer `sync-angular-env-from-env.mjs` (Firebase + GrowthBook).
 * Kept as a thin alias for existing npm / Nx targets.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(
  process.execPath,
  [join(root, 'tools', 'sync-angular-env-from-env.mjs')],
  { cwd: root, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
