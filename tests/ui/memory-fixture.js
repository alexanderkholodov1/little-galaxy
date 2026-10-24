export const start = Date.UTC(2026, 9, 23, 10);
export const end = start + 3000;
export const object = {
  id: 'memory-planet', schemaVersion: 2, type: 'planet', nameKey: 'quiet-aurora',
  params: { size: .5, palette: 0, oceans: .65, mountains: .3, clouds: .4, rings: .7, atmosphere: 0 },
  orbit: { hostId: 'central', a: 6, e: 0, inclination: 0, omega: 0, meanAnomaly: 0, epoch: start, direction: 1, isComet: false },
  status: 'hangar', createdAt: start, updatedAt: end, season: 'bad-2026',
};
export async function staticMemory(page) {
  const initial = { ...object, status: 'active', updatedAt: start };
  const edited = { ...initial, params: { ...initial.params, oceans: .1 }, updatedAt: start + 2000 };
  await page.route('**/galaxy/season/bad-2026/*.json', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1);
    const data = name === 'manifest.json' ? {
      format: 1, season: 'bad-2026', title: 'BAD 2026', start, end,
      log: ['log-test'], objects: Array.from({ length: 16 }, (_, i) => `objects-${i.toString(16)}`), eventCount: 4,
    } : name === 'log-test.json' ? {
      format: 1, states: [initial, edited, object], events: JSON.stringify([
        ['a', start, 'create', object.id, 0], ['b', start, 'launch', object.id, 0],
        ['c', start + 2000, 'edit', object.id, 1], ['d', end, 'crumble', object.id, 2],
      ]),
    } : { format: 1, objects: [object] };
    return route.fulfill({ json: data });
  });
}
