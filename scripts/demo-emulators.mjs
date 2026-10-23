import net from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

export function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}
function portFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}
export async function waitForDemoPorts() {
  while (!(await portFree(8080)) || !(await portFree(9099))) {
    console.log('Demo emulator ports busy; waiting without disturbing their owner.');
    await delay(15000);
  }
}
export async function runDemo(command, env = {}) {
  await waitForDemoPorts();
  await run('pnpm', ['exec', 'firebase', 'emulators:exec', '--only', 'firestore,auth', '--project', 'demo-little-galaxy', command], {
    JAVA_TOOL_OPTIONS: '-Xmx512m', ...env,
  });
}
export async function seedDemo(extra = {}) {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local demo emulators required');
  const { initializeApp, deleteApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = initializeApp({ projectId: 'demo-little-galaxy' }, `smoke-${Date.now()}`);
  const db = getFirestore(app);
  await db.doc('config/live').set({ schemaVersion: 1, appVersion: 'stale-config', seasonOpen: true, launches: true, edits: true, comets: true, shake: true, shootingStars: true, meteorShowers: true, soundOnScreen: true, sound: true, spotlight: true, idleSeconds: 60, assistantPublic: false, screenScene: 'galaxy', ...extra });
  await db.terminate(); await deleteApp(app);
}
