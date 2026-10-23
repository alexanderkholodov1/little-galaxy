import type { Firestore } from 'firebase-admin/firestore';
import { screenScenes } from '@little-galaxy/shared';
export function controlPatch(args: string[]): Record<string, string | boolean | number> {
  const [command, key, value, ...extra] = args;
  if (!extra.length && command === 'scene' && screenScenes.includes(key as typeof screenScenes[number]) && value === undefined)
    return { screenScene: key };
  if (!extra.length && command === 'flag' && ['launches','edits','comets','shake','shootingStars','meteorShowers','soundOnScreen','sound','spotlight','seasonOpen'].includes(key)
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
  throw new Error('Use control scene <galaxy|bigQr|spotlight|cinematic|timelapse>, flag <launches|edits|shake|comets|shootingStars|meteorShowers|soundOnScreen|spotlight|seasonOpen> <on|off>, or timing <idleSeconds|meteorMinSeconds|meteorMaxSeconds> <seconds>.');
}
export async function applyControl(database: Firestore, args: string[]) {
  const patch = controlPatch(args);
  await database.runTransaction(async (tx) => {
    const ref = database.doc('config/live'), snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new Error('Provision config/live first. Controls never open a new season.');
    const config = { ...snapshot.data(), ...patch };
    if ((config.meteorMinSeconds ?? 360) > (config.meteorMaxSeconds ?? 900)) throw new Error('Meteor minimum must not exceed maximum.');
    tx.update(ref, patch);
  });
}
