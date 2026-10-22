import { expect, it } from 'vitest';
import { compactSnapshot } from './snapshots.js';
import { orbitFromSwipe, SEASON } from '@little-galaxy/shared';
it('strips owner IDs and timestamps, ignores incompatible versions and never includes hangar', () => {
  const object = { ownerUid: 'private-id', type: 'planet', nameKey: 'quiet-aurora', season: SEASON,
    params: { size: 0.4, oceans: 0.5, palette: 0 }, orbit: orbitFromSwipe(200, 0, 0.3, 1000), status: 'active' };
  const snapshot = compactSnapshot([{ id: 'one', data: () => object }, { id: 'old', data: () => ({ ...object, status: 'hangar' }) }, { id: 'future', data: () => ({ ...object, schemaVersion: 2 }) }]);
  expect(snapshot.creators).toBe(1);
  expect(snapshot.objects[0].id).toBe('one');
  expect(JSON.stringify(snapshot)).not.toContain('private-id');
  expect(compactSnapshot([]).creators).toBe(0);
});
