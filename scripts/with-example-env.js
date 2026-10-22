import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error('Usage: node scripts/with-example-env.js <command> [arguments...]');

const example = await readFile(new URL('../apps/web/.env.example', import.meta.url), 'utf8');
const env = { ...process.env };
for (const sourceLine of example.split(/\r?\n/u)) {
  const line = sourceLine.trim();
  if (!line || line.startsWith('#')) continue;
  const separator = line.indexOf('=');
  if (separator < 1) throw new Error('Invalid assignment in apps/web/.env.example.');
  const name = line.slice(0, separator).trim();
  let value = line.slice(separator + 1).trim();
  if (!/^[A-Z_][A-Z0-9_]*$/u.test(name)) throw new Error('Invalid variable name in apps/web/.env.example.');
  if ((value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  env[name] = value;
}

const useCurrentPnpm = command === 'pnpm' && process.env.npm_execpath;
const executable = useCurrentPnpm ? process.execPath : command;
const childArgs = useCurrentPnpm ? [process.env.npm_execpath, ...args] : args;
const result = spawnSync(executable, childArgs, {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32' && !useCurrentPnpm,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
