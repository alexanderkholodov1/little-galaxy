import { expect, it } from 'vitest';
import { planGalaxyImport } from './galaxies.js';
const now = Date.UTC(2026, 9, 25),
  row = {
    id: 'legacy',
    data: {
      schemaVersion: 2,
      ownerUid: 'alice',
      type: 'planet',
      status: 'active',
      orbit: { a: 7, e: 0.99999 },
      params: { palette: 0 },
      createdAt: now,
      updatedAt: now,
    },
  };
it('preserves every legacy orbit/design and builds deterministic private entitlements', async () => {
  const a = await planGalaxyImport([row], [], now),
    b = await planGalaxyImport([row], [], now);
  expect(a).toEqual(b);
  expect(a.bodies[0].data.legacy).toEqual({
    schemaVersion: 2,
    type: row.data.type,
    status: row.data.status,
    orbit: row.data.orbit,
    params: row.data.params,
    createdAt: now,
    updatedAt: now,
  });
  expect(a.head.bodies).toBe(2);
  expect(a.members[0].data.bodyIds).toEqual(['legacy']);
  expect(JSON.stringify(a.chunks)).not.toContain('alice');
});
it('does not discard hangar records or source shards', async () => {
  const p = await planGalaxyImport(
    [row, { id: 'hangar', data: { ...row.data, status: 'hangar' } }],
    [{ id: '0', data: { entries: { alice: { id: 'legacy', data: row.data } } } }],
    now,
  );
  expect(p.legacyObjects).toHaveLength(2);
  expect(p.legacySky).toHaveLength(1);
  expect(p.bodies).toHaveLength(1);
});
it('rejects imports exceeding physical or player budgets', async () => {
  await expect(
    planGalaxyImport(
      Array.from({ length: 4 }, (_, i) => ({ id: 'n' + i, data: row.data })),
      [],
      now,
    ),
  ).rejects.toThrow();
  await expect(
    planGalaxyImport([{ id: 'bad', data: { ...row.data, type: 'unrecognized' } }], [], now),
  ).rejects.toThrow();
});
