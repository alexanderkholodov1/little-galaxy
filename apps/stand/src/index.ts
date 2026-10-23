import { readFileSync } from 'node:fs';
import { getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { freezeSeason, validateFreeze } from './freeze-season.js';
import { startMemoryWriter } from './memory.js';
import { startStand } from './stand.js';
import { startSnapshotWriter } from './snapshots.js';
import { startMeteorScheduler } from './meteors.js';
import { applyControl, controlPatch } from './control.js';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
try {
  const control = process.argv[2] === 'control';
  const freeze = process.argv[2] === 'freeze-season';
  if (freeze) validateFreeze(process.argv.slice(3), process.env);
  if (process.argv.length > 2 && !control && !freeze) throw new Error('Unknown command');
  if (control) controlPatch(process.argv.slice(3));
  console.log(startStand(version));
  if (getApps().length) {
    if (freeze) {
      await freezeSeason(getFirestore(), process.argv[3]);
      await getFirestore().terminate();
      console.log('Season exported; live configuration unchanged.');
    } else if (control) {
      const written = await applyControl(getFirestore(), process.argv.slice(3));
      await getFirestore().terminate();
      console.log(`${process.argv[3] === 'init' ? 'Created' : 'Updated'} config/live: ${JSON.stringify(written, null, 2)}`);
    } else {
      const stopMemory = startMemoryWriter(getFirestore(), () => console.error('Memory archive unavailable. Check source schema and capacity.'));
      const stopMeteors = startMeteorScheduler(getFirestore(), () => console.error('Meteor scheduler unavailable. Check connection and live timing.'));
      const stop = startSnapshotWriter(getFirestore(), () => console.error('Snapshot unavailable. Check connection or snapshot capacity.'));
      const shutdown = () => { void Promise.all([stop(), stopMeteors(), stopMemory()]).then(() => process.exit(0)); };
      process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
    }
  } else if (control) throw new Error('No admin connection');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Stand command failed: ${message}`);
  if (process.argv[2] === 'freeze-season') {
    console.error('Usage: freeze-season <output-directory>');
  } else {
    console.error('Controls: init (create config/live once, season closed); scene <galaxy|bigQr|spotlight|cinematic|timelapse>; flag <launches|edits|shake|comets|shootingStars|meteorShowers|soundOnScreen|spotlight|seasonOpen> <on|off>; timing <idleSeconds|meteorMinSeconds|meteorMaxSeconds> <seconds>.');
  }
  if (getApps().length) await getFirestore().terminate();
  process.exitCode = 1;
}
