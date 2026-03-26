import { spawnSync } from 'node:child_process';

const run = (command) => {
  const result = spawnSync(command, {
    stdio: 'inherit',
    shell: true,
  });
  return result.status ?? 1;
};

const typecheckStatus = run('tsc -b');
if (typecheckStatus !== 0) {
  process.exit(typecheckStatus);
}

process.exit(run('vite build'));
