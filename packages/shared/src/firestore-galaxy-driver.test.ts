import { expect, it, vi, afterEach } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import { ServerClock, readPublicDocuments } from './firestore-galaxy-driver.js';
it('anchors arbitrary device clock skew to server time and advances monotonically', () => {
  let mono = 100;
  const clock = new ServerClock(() => mono);
  expect(() => clock.now()).toThrow();
  const started = clock.started();
  mono += 20;
  clock.observe(1000000, started);
  expect(clock.now()).toBe(1000010);
  mono += 10000;
  expect(clock.now()).toBe(1010010);
  // A fresh server read resets any estimate without consulting Date.now.
  clock.observe(2000000, mono);
  expect(clock.now()).toBe(2000000);
});

afterEach(() => vi.unstubAllGlobals());
it('batches unordered public opening documents, explicit misses and a common clock anchor', async () => {
  const root = 'projects/demo-little-galaxy/databases/(default)/documents';
  const clock = new ServerClock(() => 100);
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([
    { readTime: '2026-10-29T00:00:00Z', missing: root + '/galaxies/open/liveSnapshots/latest' },
    { readTime: '2026-10-29T00:00:00Z', found: { name: root + '/galaxies/open', fields: {
      id: { stringValue: 'open' }, updatedTime: { timestampValue: '2026-10-28T00:00:00Z' },
      sequence: { integerValue: '7' }, enabled: { booleanValue: true },
    } } },
  ])));
  vi.stubGlobal('fetch', fetcher);
  const paths = ['galaxies/open', 'galaxies/open/liveSnapshots/latest'];
  const values = await readPublicDocuments({ app: { options: { projectId: 'demo-little-galaxy' } } } as Firestore, paths, { clock, getToken: async () => '' });
  expect(values.get(paths[0])).toEqual({ id: 'open', sequence: 7, enabled: true });
  expect(values.has(paths[1])).toBe(true);
  expect(values.get(paths[1])).toBeNull();
  expect(clock.now()).toBe(Date.parse('2026-10-29T00:00:00Z'));
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetcher.mock.calls[0][1].body).documents).toEqual(paths.map(p => root + '/' + p));
});
it('rejects an incomplete opening rather than mistaking an omitted document for a miss', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{ readTime: '2026-10-29T00:00:00Z' }]))));
  await expect(readPublicDocuments({ app: { options: { projectId: 'demo-little-galaxy' } } } as Firestore, ['galaxies/open'], { clock: new ServerClock(), getToken: async () => '' })).rejects.toThrow('Incomplete public opening');
});
