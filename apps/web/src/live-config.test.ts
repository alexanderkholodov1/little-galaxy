import { expect, it } from 'vitest';
import { closedConfig, readConfig } from './live-config';
it('fails closed for missing/future config and malformed flags; supports the legacy QR scene', () => {
  expect(readConfig(undefined)).toEqual(closedConfig);
  expect(readConfig({ schemaVersion: 2, seasonOpen: true, launches: true })).toEqual(closedConfig);
  const config = readConfig({ schemaVersion: 1, seasonOpen: true, launches: 'yes', shake: 1, comets: false, shootingStars: true, screenScene: 'qr', idleSeconds: Infinity });
  expect(config.launches).toBe(false); expect(config.shake).toBe(false); expect(config.shootingStars).toBe(true);
  expect(config.screenScene).toBe('bigQr'); expect(config.idleSeconds).toBe(60);
  expect(readConfig({ schemaVersion: 1, screenScene: 'assistant', idleSeconds: -10 }).screenScene).toBe('galaxy');
  expect(readConfig({ schemaVersion: 1, idleSeconds: 0 }).idleSeconds).toBe(10);
});
