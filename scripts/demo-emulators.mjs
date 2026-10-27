import net from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

function startProcess(command, args, env = {}) {
    // pnpm run supplies its JS entry: use Node to preserve arguments and paths on Windows.
    const pnpmEntry = command === 'pnpm' && process.env.npm_execpath;
    const child = spawn(pnpmEntry ? process.execPath : command, pnpmEntry ? [pnpmEntry, ...args] : args, {
      stdio: 'inherit', shell: process.platform === 'win32' && !pnpmEntry, env: { ...process.env, ...env },
    });
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
  return { child, done };
}
export function run(command, args, env = {}) {
  return startProcess(command, args, env).done;
}

export async function stopProcess(child, { platform = process.platform, spawnKill = spawn } = {}) {
  if (!child?.pid || child.exitCode !== null || child.signalCode) return;
  if (platform !== 'win32') { child.kill('SIGTERM'); return; }
  // Kill the still-running owner, not a CLI that has already exited and orphaned Java.
  await new Promise((resolve, reject) => {
    const killer = spawnKill('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    killer.once('error', reject);
    killer.once('exit', code => code === 0 || child.exitCode !== null
      ? resolve() : reject(new Error(`Could not stop emulator process tree ${child.pid}: taskkill exited ${code}`)));
  });
}

async function waitForDemoReady(signal) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:4400/emulators', { signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]) });
      const emulators = await response.json();
      if (response.ok && emulators.firestore?.port === 8080 && emulators.auth?.port === 9099) return;
    } catch { /* The owned hub is still starting. */ }
    await delay(100, undefined, { signal });
  }
  throw new Error('Demo emulators did not become ready within 60 seconds.');
}

export async function runWindowsDemo(command, env, {
  start = startProcess, ready = waitForDemoReady, stop = stopProcess, signals = process,
} = {}) {
  // emulators:exec can exit before its Java descendants on Windows. Keep emulators:start
  // alive as the tree owner until the test succeeds, fails, or receives a signal.
  const startup = new AbortController();
  const emulator = start('pnpm', ['exec', 'firebase', 'emulators:start', '--only', 'firestore,auth', '--project', 'demo-little-galaxy'], env);
  const exited = emulator.done.then(() => { throw new Error('Demo emulators exited before the suite finished.'); });
  // Attach a handler even if startup or command spawning throws synchronously.
  exited.catch(() => {});
  let suite, cleaning;
  const cleanup = () => cleaning ??= (async () => {
    try { await stop(suite?.child); } finally { await stop(emulator.child); }
  })();
  let rejectSignal;
  const interrupted = new Promise((_, reject) => { rejectSignal = reject; });
  const interrupt = signal => rejectSignal(new Error(`Demo suite interrupted by ${signal}`));
  const onInt = () => interrupt('SIGINT'), onTerm = () => interrupt('SIGTERM');
  signals.on('SIGINT', onInt); signals.on('SIGTERM', onTerm);
  try {
    await Promise.race([ready(startup.signal), exited, interrupted]);
    suite = start('cmd.exe', ['/d', '/s', '/c', command], {
      ...env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      FIREBASE_EMULATOR_HUB: '127.0.0.1:4400', GCLOUD_PROJECT: 'demo-little-galaxy',
    });
    await Promise.race([suite.done, exited, interrupted]);
  } finally {
    startup.abort();
    try { await cleanup(); } finally {
      signals.removeListener('SIGINT', onInt); signals.removeListener('SIGTERM', onTerm);
    }
  }
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
  const demoEnv = { JAVA_TOOL_OPTIONS: '-Xmx512m', ...env };
  if (process.platform === 'win32') {
    if (!(await portFree(4400))) throw new Error('Demo emulator hub port 4400 is busy. Stop the existing emulators before running this suite.');
    return runWindowsDemo(command, demoEnv);
  }
  await run('pnpm', ['exec', 'firebase', 'emulators:exec', '--only', 'firestore,auth', '--project', 'demo-little-galaxy', command], {
    ...demoEnv,
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
