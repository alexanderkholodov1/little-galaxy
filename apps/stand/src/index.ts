import { readFileSync } from 'node:fs';
import { startStand } from './stand.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
try {
  console.log(startStand(version));
} catch {
  console.error('Stand could not initialize. Check GOOGLE_APPLICATION_CREDENTIALS points to a valid admin key file.');
  process.exitCode = 1;
}
