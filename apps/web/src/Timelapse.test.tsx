import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Timelapse from './Timelapse';
import { loadSeason } from './season-data';

vi.mock('./season-data', () => ({
  loadSeason: vi.fn(),
}));

vi.mock('./GalaxyScene', () => ({
  default: () => <canvas aria-label="Historical sky" />,
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('stops playing and clears interval when reaching the end of the season, and Home does not auto-play', async () => {
  const manifest = {
    format: 1 as const,
    season: 'bad-2026' as const,
    title: 'BAD 2026' as const,
    start: 1000,
    end: 2000,
    log: [],
    objects: [],
    eventCount: 2,
  };
  vi.mocked(loadSeason).mockResolvedValue({
    frozen: true,
    manifest,
    chunks: [],
    files: {},
  });

  await act(async () => {
    root.render(<Timelapse language="en" />);
  });

  await act(async () => {
    await Promise.resolve();
  });

  const button = container.querySelector<HTMLButtonElement>('.replay-controls button')!;
  const range = container.querySelector<HTMLInputElement>('.replay-scrubber input')!;

  expect(button.textContent).toBe('Play');
  expect(button.getAttribute('aria-pressed')).toBe('false');
  expect(range.value).toBe('1000');

  // Click play
  await act(async () => {
    button.click();
  });

  expect(button.textContent).toBe('Pause');
  expect(button.getAttribute('aria-pressed')).toBe('true');

  // Advance time past the end
  await act(async () => {
    vi.advanceTimersByTime(100);
  });

  // Playback must stop, clamped at end (2000), button must show Play
  expect(range.value).toBe('2000');
  expect(button.textContent).toBe('Play');
  expect(button.getAttribute('aria-pressed')).toBe('false');

  // Regression check: Home after the end must NOT auto-play
  await act(async () => {
    range.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  });

  expect(range.value).toBe('1000');
  expect(button.textContent).toBe('Play');

  // Advance time: should NOT advance because playing was stopped and timer cleared
  await act(async () => {
    vi.advanceTimersByTime(500);
  });

  expect(range.value).toBe('1000');
  expect(button.textContent).toBe('Play');
});
