import { expect, it } from 'vitest';
import { ServerClock } from './firestore-galaxy-driver.js';
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
