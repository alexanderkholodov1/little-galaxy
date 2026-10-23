import { readFileSync } from 'node:fs';
import { getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { startStand } from './stand.js';
import { startSnapshotWriter } from './snapshots.js';
import { startMeteorScheduler } from './meteors.js';
import { applyControl, controlPatch } from './control.js';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
try {
  const control = process.argv[2] === 'control';
  if (process.argv.length > 2 && !control) throw new Error('Unknown command');
  if (control) controlPatch(process.argv.slice(3));
  console.log(startStand(version));
  if (getApps().length) {
    if (control) {
      await applyControl(getFirestore(), process.argv.slice(3));
      await getFirestore().terminate();
      console.log('Live controls updated.');
    } else {
      const stopMeteors = startMeteorScheduler(getFirestore(), () => console.error('Meteor scheduler unavailable. Check connection and live timing.'));
      const stop = startSnapshotWriter(getFirestore(), () => console.error('Snapshot unavailable. Check connection or snapshot capacity.'));
      const shutdown = () => { void Promise.all([stop(), stopMeteors()]).then(() => process.exit(0)); };
      process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
    }
  } else if (control) throw new Error('No admin connection');
} catch {
  console.error('Stand command failed. Check its arguments, admin connection and existing config/live.');
  console.error('Controls: scene <galaxy|bigQr|spotlight|cinematic|timelapse>; flag <launches|comets|shake|shootingStars|meteorShowers|seasonOpen> <on|off>; timing <idleSeconds|meteorMinSeconds|meteorMaxSeconds> <seconds>.');
  if (getApps().length) await getFirestore().terminate();
  process.exitCode = 1;
}
