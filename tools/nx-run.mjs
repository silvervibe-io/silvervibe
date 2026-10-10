import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [command, defaultProject, ...rest] = process.argv.slice(2);

if (!command) {
  console.error(
    'Usage: node tools/nx-run.mjs <command> [defaultProject] [project]',
  );
  process.exit(1);
}

const projectArg = rest.find((arg) => !arg.startsWith('-'));
const project = projectArg ?? defaultProject;

if (!project) {
  console.error(`Missing project for nx ${command}.`);
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (
  (command === 'serve' || command === 'build') &&
  (project === 'silvervibe' || project === 'vibestandup')
) {
  const sync = spawnSync(
    process.execPath,
    [join(root, 'tools', 'sync-firebase-web-from-env.mjs')],
    { cwd: root, stdio: 'inherit' },
  );
  if (sync.status !== 0) {
    process.exit(sync.status ?? 1);
  }
}

const extraArgs = rest.filter((arg) => arg !== projectArg);
const result = spawnSync('npx', ['nx', command, project, ...extraArgs], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
