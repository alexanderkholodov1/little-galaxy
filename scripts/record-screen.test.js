import { describe, expect, it } from 'vitest';
import { parseArgs, OBS_INSTRUCTIONS } from './record-screen.mjs';

describe('record-screen options', () => {
  it('parses default options', () => {
    const opts = parseArgs([]);
    expect(opts.url).toContain('/galaxy/screen');
    expect(opts.duration).toBe(15);
    expect(opts.output).toBe('records');
    expect(opts.width).toBe(1920);
    expect(opts.height).toBe(1080);
    expect(opts.obs).toBe(false);
  });

  it('parses custom flags', () => {
    const opts = parseArgs([
      '--url', 'https://example.com/screen',
      '--duration', '30',
      '--output', 'custom-records',
      '--width', '1280',
      '--height', '720',
      '--obs',
    ]);
    expect(opts.url).toBe('https://example.com/screen');
    expect(opts.duration).toBe(30);
    expect(opts.output).toBe('custom-records');
    expect(opts.width).toBe(1280);
    expect(opts.height).toBe(720);
    expect(opts.obs).toBe(true);
  });

  it('provides complete OBS Studio manual instructions', () => {
    expect(OBS_INSTRUCTIONS).toContain('OBS Studio');
    expect(OBS_INSTRUCTIONS).toContain('1920x1080');
    expect(OBS_INSTRUCTIONS).toContain('Window Capture');
  });
});
