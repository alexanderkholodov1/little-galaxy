import { readFileSync } from 'node:fs';
import type { Firestore } from 'firebase-admin/firestore';
import { SEASON, screenScenes } from '@little-galaxy/shared';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
export const controlFlags = ['launches', 'edits', 'comets', 'shake', 'shootingStars', 'meteorShowers', 'soundOnScreen', 'sound', 'spotlight', 'seasonOpen'];

export function initialConfig() {
  return {
    schemaVersion: 1 as const, season: SEASON, appVersion: version,
    seasonOpen: false, launches: true, edits: true, comets: true, shake: true,
    shootingStars: true, meteorShowers: true, soundOnScreen: true, sound: true,
    spotlight: true, assistantPublic: false, idleSeconds: 60,
    meteorMinSeconds: 360, meteorMaxSeconds: 900, screenScene: 'galaxy' as const,
  };
}
export function controlPatch(args: string[]): Record<string, string | boolean | number> {
  if (args.length === 1 && args[0] === 'init') return initialConfig();
  const [command, key, value, ...extra] = args;
  if (!extra.length && command === 'scene' && screenScenes.includes(key as typeof screenScenes[number]) && value === undefined)
    return { screenScene: key };
  if (!extra.length && command === 'flag' && controlFlags.includes(key)
    && ['on','off'].includes(value)) {
    const flagVal = value === 'on';
    if (key === 'sound') return { soundOnScreen: flagVal, sound: flagVal };
    return { [key]: flagVal };
  }
  if (!extra.length && command === 'timing' && ['idleSeconds','meteorMinSeconds','meteorMaxSeconds'].includes(key)
    && /^\d+$/.test(value)) {
    const seconds = Number(value), min = key === 'idleSeconds' ? 10 : 60;
    if (seconds >= min && seconds <= 3600) return { [key]: seconds };
  }
  throw new Error('Use control init (create a closed bad-2026 season once), scene <galaxy|bigQr|spotlight|cinematic|timelapse>, flag <launches|edits|shake|comets|shootingStars|meteorShowers|soundOnScreen|spotlight|seasonOpen> <on|off>, or timing <idleSeconds|meteorMinSeconds|meteorMaxSeconds> <seconds>.');
}
export async function applyControl(database: Firestore, args: string[]) {
  const patch = controlPatch(args);
  await database.runTransaction(async (tx) => {
    const ref = database.doc('config/live'), snapshot = await tx.get(ref);
    if (args[0] === 'init') {
      if (snapshot.exists) throw new Error('config/live already exists; init refuses to overwrite it.');
      tx.create(ref, patch);
      return;
    }
    if (!snapshot.exists) throw new Error('Run control init first. Then explicitly open with control flag seasonOpen on.');
    const config = { ...snapshot.data(), ...patch };
    if ((config.meteorMinSeconds ?? 360) > (config.meteorMaxSeconds ?? 900)) throw new Error('Meteor minimum must not exceed maximum.');
    tx.update(ref, patch);
  });
  return patch;
}
