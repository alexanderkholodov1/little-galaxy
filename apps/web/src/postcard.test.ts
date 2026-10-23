import { afterEach, expect, it, vi } from 'vitest';
import jsQR from 'jsqr';
import { objectUrl, postcardQr, POSTCARD_HEIGHT, POSTCARD_WIDTH, sharePostcard } from './postcard';
afterEach(() => vi.unstubAllGlobals());
it('encodes a decodable QR for the absolute current-origin permanent URL with a quiet zone', () => {
  const url = objectUrl('object-123', 'https://galaxy.example');
  expect(url).toBe('https://galaxy.example/galaxy/o/object-123');
  const qr = postcardQr(url), count = qr.getModuleCount(), scale = 6, side = (count + 8) * scale;
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const row = Math.floor(y / scale) - 4, col = Math.floor(x / scale) - 4;
    if (row >= 0 && col >= 0 && row < count && col < count && qr.isDark(row, col)) {
      const index = (y * side + x) * 4; pixels[index] = 0; pixels[index + 1] = 0; pixels[index + 2] = 0;
    }
  }
  expect(jsQR(pixels, side, side)?.data).toBe(url);
  expect([POSTCARD_WIDTH, POSTCARD_HEIGHT]).toEqual([1080, 1920]);
});
it('shares a prepared file directly inside the tap and treats cancellation as recoverable', async () => {
  const file = new File(['png'], 'galaxy.png', { type: 'image/png' });
  const share = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { canShare: vi.fn().mockReturnValue(true), share });
  const promise = sharePostcard(file);
  expect(share).toHaveBeenCalledWith({ files: [file] });
  expect(await promise).toBe('shared');
  share.mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'));
  expect(await sharePostcard(file)).toBe('cancelled');
});
it('downloads when file sharing is unavailable and revokes its object URL', async () => {
  vi.useFakeTimers();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const create = vi.fn().mockReturnValue('blob:postcard'), revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
  vi.stubGlobal('navigator', { canShare: () => false });
  expect(await sharePostcard(new File(['png'], 'galaxy.png'))).toBe('downloaded');
  expect(click).toHaveBeenCalledOnce();
  vi.runAllTimers(); expect(revoke).toHaveBeenCalledWith('blob:postcard');
  click.mockRestore(); vi.useRealTimers();
});
