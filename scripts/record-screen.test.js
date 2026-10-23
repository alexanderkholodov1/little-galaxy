import { describe, expect, it, vi } from 'vitest';
import { parseArgs, OBS_INSTRUCTIONS, LOADING_STATUS_REGEX, FAILED_STATUS_REGEX, recordScreen } from './record-screen.mjs';
import { chromium } from '@playwright/test';

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

  it('detects loading and failure copy in both English and Spanish', () => {
    // English & Spanish loading states
    expect(LOADING_STATUS_REGEX.test('Reading the sky…')).toBe(true);
    expect(LOADING_STATUS_REGEX.test('Leyendo el cielo…')).toBe(true);
    expect(LOADING_STATUS_REGEX.test('Loading…')).toBe(true);
    expect(LOADING_STATUS_REGEX.test('Cargando')).toBe(true);

    // English & Spanish failure / unavailable states
    expect(FAILED_STATUS_REGEX.test('Live connection interrupted. The last known sky keeps moving.')).toBe(true);
    expect(FAILED_STATUS_REGEX.test('Conexión en vivo interrumpida. El último cielo conocido sigue en movimiento.')).toBe(true);
    expect(FAILED_STATUS_REGEX.test('The 3D sky could not open.')).toBe(true);
    expect(FAILED_STATUS_REGEX.test('El cielo en 3D no pudo abrirse.')).toBe(true);
    expect(FAILED_STATUS_REGEX.test('Failed to connect')).toBe(true);
    expect(FAILED_STATUS_REGEX.test('Desconectado')).toBe(true);
  });

  it('terminates chromium when warm-up navigation fails', async () => {
    const mockCloseBrowser = vi.fn().mockResolvedValue(undefined);
    const mockCloseWarm = vi.fn().mockResolvedValue(undefined);
    const mockLaunch = vi.spyOn(chromium, 'launch').mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn().mockRejectedValue(new Error('Navigation timeout during warm-up')),
        }),
        close: mockCloseWarm,
      }),
      close: mockCloseBrowser,
    });

    await expect(recordScreen({ mode: 'demo', duration: 1 })).rejects.toThrow('Navigation timeout during warm-up');
    expect(mockCloseWarm).toHaveBeenCalledTimes(1);
    expect(mockCloseBrowser).toHaveBeenCalledTimes(1);

    mockLaunch.mockRestore();
  });
});
