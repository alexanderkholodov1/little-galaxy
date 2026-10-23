import { describe, expect, it } from 'vitest';
import {
  names,
  objectName,
  orbitFromSwipe,
  orbitFromVelocity,
  planetDefaults,
  readObject,
  replay,
  replayScene,
  SEASON,
  validInteraction,
  validOrbit,
  validParams,
  messageKeys,
  type GalaxyObject,
  type LogChunk,
  type MemoryObject,
} from './index.js';

describe('backward-compatible document reads', () => {
  it('reads v0.2 schemaVersion 1 planet documents (and documents with omitted schemaVersion) and defaults missing parameters', () => {
    const v02PlanetWithoutVersion = {
      type: 'planet' as const,
      nameKey: 'quiet-aurora' as const,
      ownerUid: 'uid-alice',
      params: { size: 0.45, palette: 2, oceans: 0.6 },
      orbit: orbitFromVelocity(0, 2.58, 0, 0),
      status: 'active' as const,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      season: SEASON,
    };

    const read1 = readObject(v02PlanetWithoutVersion);
    expect(read1).not.toBeNull();
    expect(read1?.schemaVersion).toBe(1);
    expect(read1?.type).toBe('planet');
    expect(read1?.nameKey).toBe('quiet-aurora');
    expect(read1?.params).toEqual({
      size: 0.45,
      palette: 2,
      oceans: 0.6,
      mountains: 0.3,
      clouds: 0.3,
      rings: 0,
      atmosphere: 2,
    });

    const v02PlanetWithVersion1: GalaxyObject = {
      schemaVersion: 1,
      type: 'planet',
      nameKey: 'bright-tide',
      ownerUid: 'uid-bob',
      params: { size: 0.5, palette: 1, oceans: 0.1 },
      orbit: orbitFromSwipe(150, -50, 0.4, 1000),
      status: 'hangar',
      createdAt: 1700000001000,
      updatedAt: 1700000002000,
      season: SEASON,
    };

    const read2 = readObject(v02PlanetWithVersion1);
    expect(read2).not.toBeNull();
    expect(read2?.schemaVersion).toBe(1);
    expect(read2?.params).toEqual(planetDefaults(v02PlanetWithVersion1.params as import('./schema.js').PlanetParams));
  });

  it('reads v0.3+ schemaVersion 2 rich planets, stars, and moons', () => {
    const v03Planet: GalaxyObject = {
      schemaVersion: 2,
      type: 'planet',
      nameKey: 'n00-01',
      ownerUid: 'uid-charlie',
      params: { size: 0.6, palette: 3, oceans: 0.8, mountains: 0.5, clouds: 0.7, rings: 0.4, atmosphere: 1 },
      orbit: orbitFromVelocity(0, 3.2, 0, 0),
      status: 'active',
      createdAt: 1700000003000,
      updatedAt: 1700000004000,
      season: SEASON,
    };
    const readPlanet = readObject(v03Planet);
    expect(readPlanet).not.toBeNull();
    expect(readPlanet?.schemaVersion).toBe(2);
    expect(readPlanet?.params).toEqual(v03Planet.params);

    const v03Star: GalaxyObject = {
      schemaVersion: 2,
      type: 'star',
      nameKey: 'n10-15',
      ownerUid: 'uid-dana',
      params: { size: 0.65, temperature: 0.85, corona: 0.9 },
      orbit: { ...orbitFromVelocity(0, 10, 0, 0), hostId: 'central' },
      status: 'active',
      createdAt: 1700000005000,
      updatedAt: 1700000006000,
      season: SEASON,
    };
    const readStar = readObject(v03Star);
    expect(readStar).not.toBeNull();
    expect(readStar?.type).toBe('star');
    expect(readStar?.params).toEqual(v03Star.params);

    const v03Moon: GalaxyObject = {
      schemaVersion: 2,
      type: 'moon',
      nameKey: 'n20-25',
      ownerUid: 'uid-elena',
      params: { size: 0.28, craters: 0.6, colour: 2 },
      orbit: { ...orbitFromVelocity(0, 2.5, 0, 0), hostId: 'planet-parent' },
      hostOrbit: v03Planet.orbit,
      status: 'active',
      createdAt: 1700000007000,
      updatedAt: 1700000008000,
      season: SEASON,
    };
    const readMoon = readObject(v03Moon);
    expect(readMoon).not.toBeNull();
    expect(readMoon?.type).toBe('moon');
    expect(readMoon?.hostOrbit).toEqual(v03Planet.orbit);
  });

  it('safely rejects unknown future versions or corrupted shapes', () => {
    const futureDoc = {
      schemaVersion: 3,
      type: 'planet',
      nameKey: 'quiet-aurora',
      ownerUid: 'future-uid',
      params: { size: 0.5, palette: 0, oceans: 0.5 },
      orbit: orbitFromVelocity(0, 2.58, 0, 0),
      status: 'active',
      season: SEASON,
    };
    expect(readObject(futureDoc)).toBeNull();
    expect(readObject(null)).toBeNull();
    expect(readObject(undefined)).toBeNull();
    expect(readObject('corrupted string')).toBeNull();
    expect(readObject({ schemaVersion: 2, type: 'unknown_type' })).toBeNull();
    expect(readObject({ ...futureDoc, schemaVersion: 2, season: 'other-season' })).toBeNull();
  });

  it('validates every interaction type payload ever supported', () => {
    expect(validInteraction('shake', {})).toBe(true);
    expect(validInteraction('shake', { extra: 1 })).toBe(false);

    expect(validInteraction('comet', { dx: 0.5, dy: -0.3 })).toBe(true);
    expect(validInteraction('comet', { dx: 0, dy: 1 })).toBe(true);
    expect(validInteraction('comet', { dx: 0, dy: 0 })).toBe(false); // below minimum hypot
    expect(validInteraction('comet', { dx: 2, dy: 0 })).toBe(false); // exceeds bound

    for (const key of messageKeys) {
      expect(validInteraction('shootingStar', { messageKey: key })).toBe(true);
    }
    expect(validInteraction('shootingStar', { messageKey: 'non_existent_key' })).toBe(false);
  });

  it('replays a historical season containing every event and object type correctly', () => {
    const parentPlanet: MemoryObject = {
      id: 'planet-1',
      schemaVersion: 2,
      type: 'planet',
      nameKey: 'quiet-aurora',
      params: { size: 0.5, palette: 0, oceans: 0.5, mountains: 0.3, clouds: 0.3, rings: 0, atmosphere: 0 },
      orbit: orbitFromVelocity(0, 5, 0, 0),
      status: 'active',
      season: 'bad-2026',
      createdAt: 1000,
      updatedAt: 1000,
    };

    const moonObject: MemoryObject = {
      id: 'moon-1',
      schemaVersion: 2,
      type: 'moon',
      nameKey: 'bright-tide',
      params: { size: 0.25, craters: 0.5, colour: 1 },
      orbit: { ...orbitFromVelocity(0, 1.5, 0, 0), hostId: 'planet-1' },
      hostOrbit: parentPlanet.orbit,
      status: 'active',
      season: 'bad-2026',
      createdAt: 2000,
      updatedAt: 2000,
    };

    const editedPlanet: MemoryObject = {
      ...parentPlanet,
      params: { ...parentPlanet.params, oceans: 0.8 },
      updatedAt: 3000,
    };

    const hangaredPlanet: MemoryObject = {
      ...parentPlanet,
      status: 'hangar',
      updatedAt: 4000,
    };

    const logChunk: LogChunk = {
      format: 1,
      states: [parentPlanet, moonObject, editedPlanet, hangaredPlanet],
      events: [
        ['e1', 1000, 'create', 'planet-1', 0],
        ['e2', 1000, 'launch', 'planet-1', 0],
        ['e3', 1500, 'shake', '', {}],
        ['e4', 1800, 'comet', '', { dx: 0.5, dy: 0.5 }],
        ['e5', 2000, 'create', 'moon-1', 1],
        ['e6', 2200, 'shootingStar', '', { messageKey: 'together' }],
        ['e7', 2500, 'meteorShower', '', {}],
        ['e8', 3000, 'edit', 'planet-1', 2],
        ['e9', 4000, 'crumble', 'planet-1', 3],
        ['e10', 5000, 'relaunch', 'planet-1', 0],
      ],
    };

    // Replay at t=1000: planet-1 active
    const s1 = replay([logChunk], 1000);
    expect(s1.find((o) => o.id === 'planet-1')?.status).toBe('active');

    // Replay at t=2000: planet-1 and moon-1 both active
    const s2 = replay([logChunk], 2000);
    expect(s2.find((o) => o.id === 'moon-1')?.status).toBe('active');

    // Replay at t=3000: planet-1 has edited oceans=0.8
    const s3 = replay([logChunk], 3000);
    expect(s3.find((o) => o.id === 'planet-1')?.params.oceans).toBe(0.8);

    // Replay at t=4000: planet-1 hangared
    const s4 = replay([logChunk], 4000);
    expect(s4.find((o) => o.id === 'planet-1')?.status).toBe('hangar');

    // Replay at t=5000: planet-1 relaunched
    const s5 = replay([logChunk], 5000);
    expect(s5.find((o) => o.id === 'planet-1')?.status).toBe('active');

    // replayScene produces valid 3D render objects
    const renderObjs = replayScene(s5);
    expect(renderObjs.length).toBeGreaterThanOrEqual(1);
    expect(renderObjs[0].nameKey).toBeDefined();
  });
});
