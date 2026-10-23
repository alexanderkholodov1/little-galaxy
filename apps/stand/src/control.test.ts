import { expect, it } from 'vitest';
import { controlPatch } from './control.js';
import { meteorInterval } from './meteors.js';
it('allowlists operator controls without accepting assistant scenes or arbitrary fields', () => {
  for (const scene of ['galaxy','bigQr','spotlight','cinematic','timelapse']) expect(controlPatch(['scene', scene])).toEqual({ screenScene: scene });
  for (const flag of ['comets','shake','shootingStars','launches','edits','meteorShowers','soundOnScreen','spotlight','seasonOpen']) expect(controlPatch(['flag', flag, 'off'])).toEqual({ [flag]: false });
  expect(controlPatch(['flag', 'sound', 'off'])).toEqual({ soundOnScreen: false, sound: false });
  expect(controlPatch(['timing', 'idleSeconds', '10'])).toEqual({ idleSeconds: 10 });
  for (const args of [['scene','assistant'],['scene','galaxy','extra'],['flag','assistantPublic','on'],['flag','launches','true'],['timing','meteorMinSeconds','1'],['timing','idleSeconds','NaN'],['timing','idleSeconds','3601']]) expect(() => controlPatch(args)).toThrow();
});
it('uses random 6–15 minute intervals, bounded configuration and fail-closed switches', () => {
  const config = { schemaVersion: 1, seasonOpen: true, meteorShowers: true };
  expect(meteorInterval(config, () => 0)).toBe(360_000);
  expect(meteorInterval(config, () => 1)).toBe(900_000);
  expect(meteorInterval(config, () => .5)).toBe(630_000);
  for (const override of [{ meteorShowers: false },{ seasonOpen: false },{ meteorMinSeconds: 900, meteorMaxSeconds: 300 },{ meteorMinSeconds: 1 },{ meteorMaxSeconds: Infinity }]) expect(meteorInterval({ ...config, ...override })).toBeNull();
  expect(meteorInterval(undefined)).toBeNull();
});
