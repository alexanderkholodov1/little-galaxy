import { describe, expect, it } from 'vitest';
import { parseArgs, OBS_INSTRUCTIONS } from './record-screen.mjs';

describe('record-screen options', () => {
  it('parses default options as demo mode', () => {
    const opts = parseArgs([]);
    expect(opts.url).toContain('/galaxy/screen');
    expect(opts.duration).toBe(15);
    expect(opts.output).toBe('records');
    expect(opts.width).toBe(1920);
    expect(opts.height).toBe(1080);
    expect(opts.mode).toBe('demo');
    expect(opts.obs).toBe(false);
  });

  it('parses custom flags including rehearsal mode', () => {
    const opts = parseArgs([
      '--mode', 'rehearsal',
      '--url', 'https://example.com/galaxy/screen',
      '--duration', '30',
      '--output', 'custom-records',
      '--width', '1280',
      '--height', '720',
      '--obs',
    ]);
    expect(opts.mode).toBe('rehearsal');
    expect(opts.url).toBe('https://example.com/galaxy/screen');
    expect(opts.duration).toBe(30);
    expect(opts.output).toBe('custom-records');
    expect(opts.width).toBe(1280);
    expect(opts.height).toBe(720);
    expect(opts.obs).toBe(true);
  });

  it('rejects positional arguments that were previously silently ignored', () => {
    expect(() => parseArgs(['http://127.0.0.1:5173/galaxy/screen', 'out.webm', '10000']))
      .toThrow(/Unexpected positional argument/);
  });

  it('provides complete OBS Studio manual instructions', () => {
    expect(OBS_INSTRUCTIONS).toContain('OBS Studio');
    expect(OBS_INSTRUCTIONS).toContain('1920x1080');
    expect(OBS_INSTRUCTIONS).toContain('Window Capture');
    expect(OBS_INSTRUCTIONS).toContain('usable kiosk');
  });
});
