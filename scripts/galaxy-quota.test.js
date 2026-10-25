import { expect, it } from 'vitest';
import { fairMutationLimit, galaxyQuotaModel, idleGalaxyQuotaModel } from './galaxy-quota.ts';
it('budgets 300 visitors, 400 mutations and eleven imported genesis chunks below half the daily ceilings', () => {
  const m = galaxyQuotaModel();
  expect(m.reads).toBe(23801);
  expect(m.reads).toBeLessThan(m.readLimit);
  expect(m.writes).toBe(3044);
  expect(m.writes).toBeLessThan(m.writeLimit);
});
it('shows that 900 mutations exceed the default envelope even without imported genesis', () => {
  expect(galaxyQuotaModel({ mutations: 900, genesisChunks: 0 }).reads).toBeGreaterThan(25000);
  expect(galaxyQuotaModel({mutations:600}).reads).toBe(29390);
  expect(galaxyQuotaModel({ mutations: 900, genesisChunks: 1 }).reads).toBeGreaterThan(25000);
});
it('counts idle quotas daily and accounts for optional leases', () => {
  expect(idleGalaxyQuotaModel()).toEqual({
    readsPerDay: 50,
    writesPerDay: 0,
    reads: 350,
    writes: 0,
  });
  expect(idleGalaxyQuotaModel(7, true)).toEqual({
    readsPerDay: 1982,
    writesPerDay: 962,
    reads: 13874,
    writes: 6734,
  });
});

it('sizes the migration ceiling to the actual genesis footprint', () => {
  expect(fairMutationLimit(1)).toBe(550);
  expect(fairMutationLimit(11)).toBe(400);
  expect(fairMutationLimit(14)).toBe(300);
  expect(fairMutationLimit(100)).toBeNull();
});

it('charges twelve hours of automatic ten-minute certification while the keeper page is open', () => {
  const row = galaxyQuotaModel().rows.find((r) => /automatic certification/.test(r.name));
  expect(row).toMatchObject({ reads: 72 * 5 + 25, writes: 72 * 2 });
  const two = galaxyQuotaModel({ certifiedGalaxies: 2 });
  expect(two.reads).toBeLessThan(two.readLimit);
});
