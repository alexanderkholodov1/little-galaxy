import net from 'node:net';
import { spawn } from 'node:child_process';

export function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    // pnpm run supplies its JS entry: use Node to preserve arguments and paths on Windows.
    const pnpmEntry = command === 'pnpm' && process.env.npm_execpath;
    const child = spawn(pnpmEntry ? process.execPath : command, pnpmEntry ? [pnpmEntry, ...args] : args, {
      stdio: 'inherit', shell: process.platform === 'win32' && !pnpmEntry, env: { ...process.env, ...env },
    });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}
export function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(String(port)));
    });
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
  if (!(await portFree(8080)) || !(await portFree(9099))) {
    throw new Error('Demo emulator ports 8080/9099 are busy. Stop the existing emulators before running this suite.');
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
