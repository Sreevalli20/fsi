import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const nextArgs = ['dev'];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--host') {
    nextArgs.push('--hostname');
    if (args[i + 1] && !args[i + 1].startsWith('-')) {
      nextArgs.push(args[++i]);
    } else {
      nextArgs.push('0.0.0.0');
    }
  } else {
    nextArgs.push(args[i]);
  }
}

// Ensure port 3000 and hostname 0.0.0.0 are set if not provided
if (!nextArgs.includes('-p') && !nextArgs.includes('--port')) {
  nextArgs.push('-p', '3000');
}
if (!nextArgs.includes('-H') && !nextArgs.includes('--hostname')) {
  nextArgs.push('-H', '0.0.0.0');
}

const child = spawn('./node_modules/.bin/next', nextArgs, {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
