import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { expect, it } from 'vitest';
const execute = promisify(execFile);
it('runs the documented startup and every scene, flag and timing through the actual pnpm CLI', async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Demo emulators required');
  const app = initializeApp({ projectId: 'demo-little-galaxy' }, 'control-cli');
  const database = getFirestore(app);
  const env = { ...process.env, FIREBASE_PROJECT_ID: 'demo-little-galaxy' };
  // Only this test's detached process group is signalled in cleanup.
  let stand;
  const control = (...args) => execute('pnpm', ['--filter', '@little-galaxy/stand', 'control', ...args], { env, timeout: 30_000 });
  try {
    await database.recursiveDelete(database.collection('objects'));
    await database.doc('config/live').delete(); await database.doc('snapshots/live').delete();
    stand = spawn('pnpm', ['--filter', '@little-galaxy/stand', 'start'], { env, detached: true, stdio: 'ignore' });
    await expect.poll(async () => (await database.doc('snapshots/live').get()).exists, { timeout: 30_000 }).toBe(true);
    const initial = (await database.doc('config/live').get()).data();
    expect(initial.seasonOpen).toBe(false);
    await expect(control('init')).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('refuses to overwrite') });
    expect((await database.doc('config/live').get()).data()).toEqual(initial);
    await control('flag', 'seasonOpen', 'on');
    for (const scene of ['galaxy', 'bigQr', 'spotlight', 'cinematic', 'timelapse']) {
      await control('scene', scene);
      expect((await database.doc('config/live').get()).data().screenScene).toBe(scene);
    }
    for (const flag of ['launches','edits','shake','comets','shootingStars','meteorShowers','soundOnScreen','sound','spotlight','seasonOpen']) {
      for (const value of ['off', 'on']) {
        await control('flag', flag, value);
        const config = (await database.doc('config/live').get()).data();
        expect(config[flag]).toBe(value === 'on');
        if (flag === 'sound') expect(config.soundOnScreen).toBe(value === 'on');
      }
    }
    for (const [key, value] of [['idleSeconds', '45'], ['meteorMinSeconds', '300'], ['meteorMaxSeconds', '900']]) {
      await control('timing', key, value);
      expect((await database.doc('config/live').get()).data()[key]).toBe(Number(value));
    }
    const beforeInspect = (await database.doc('config/live').get()).updateTime;
    const { stdout } = await execute('pnpm', ['--filter', '@little-galaxy/stand', 'exec', 'tsx', 'src/index.ts', 'github-control'],
      { env: { ...env, SKY_ACTION: 'inspect', SKY_KEY: '', SKY_VALUE: '' }, timeout: 30_000 });
    const report = JSON.parse(stdout.slice(stdout.indexOf('{')));
    expect(report.activeObjects).toBe(0);
    expect(report.shards).toHaveLength(16);
    expect(report).toHaveProperty('marker');
    expect(stdout).not.toContain('prior season setting restored');
    expect((await database.doc('config/live').get()).updateTime).toEqual(beforeInspect);

  } finally {
    if (stand?.pid) {
      const exited = once(stand, 'exit'); process.kill(-stand.pid, 'SIGTERM'); await exited;
    }
    await database.terminate(); await deleteApp(app);
  }
}, 240_000);
