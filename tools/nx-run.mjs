import { spawnSync } from 'node:child_process';

const [command, defaultProject, ...rest] = process.argv.slice(2);

if (!command) {
  console.error('Usage: node tools/nx-run.mjs <command> [defaultProject] [project]');
  process.exit(1);
}

const projectArg = rest.find((arg) => !arg.startsWith('-'));
const project = projectArg ?? defaultProject;

if (!project) {
  console.error(`Missing project for nx ${command}.`);
  process.exit(1);
}

const extraArgs = rest.filter((arg) => arg !== projectArg);
const result = spawnSync('npx', ['nx', command, project, ...extraArgs], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
