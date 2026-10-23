import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Firestore } from 'firebase-admin/firestore';
import { compareIds } from '@little-galaxy/shared';
import { readSeason } from './memory.js';
/** Export only. Never changes config/live or closes the season. Use a fresh output directory. */
export async function freezeSeason(database: Firestore, directory: string) {
  const season = await readSeason(database);
  await mkdir(directory, { recursive: false });
  for (const [name, data] of Object.entries(season.files).sort(([a], [b]) => compareIds(a, b)))
    await writeFile(join(directory, `${name}.json`), `${JSON.stringify(data)}\n`, { flag: 'wx' });
  await writeFile(join(directory, 'manifest.json'), `${JSON.stringify(season.manifest)}\n`, { flag: 'wx' });
  return season;
}

export function validateFreeze(args: string[], env: NodeJS.ProcessEnv) {
  if (args.length !== 1 || !args[0] || !/^(127\.0\.0\.1|localhost):[0-9]+$/.test(env.FIRESTORE_EMULATOR_HOST ?? '') || !env.FIREBASE_PROJECT_ID?.startsWith('demo-'))
    throw new Error('Freeze rehearsal requires a loopback demo emulator and output directory');
}
