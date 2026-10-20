/**
 * Nx prune/generatePackageJson can omit some runtime requires (e.g. resend).
 * Ensure Cloud Run image package.json lists them before docker build.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pkgPath = join('dist', 'apps', 'api', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.dependencies ??= {};

const required = {
  resend: '^6.34.1',
};

let changed = false;
for (const [name, version] of Object.entries(required)) {
  if (!pkg.dependencies[name]) {
    pkg.dependencies[name] = version;
    changed = true;
    console.log(`Added missing runtime dependency: ${name}@${version}`);
  }
}

if (changed) {
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
} else {
  console.log('API docker runtime dependencies already complete.');
}
