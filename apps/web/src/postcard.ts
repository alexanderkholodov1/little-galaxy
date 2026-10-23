import qrcode from 'qrcode-generator';
import { objectName } from '@little-galaxy/shared';
import type { Language, MemoryObject } from '@little-galaxy/shared';
export const POSTCARD_WIDTH = 1080, POSTCARD_HEIGHT = 1920;
export function objectUrl(id: string, origin = location.origin): string {
  return new URL(`/galaxy/o/${encodeURIComponent(id)}`, origin).href;
}
export function postcardQr(url: string) {
  const qr = qrcode(0, 'M'); qr.addData(url, 'Byte'); qr.make(); return qr;
}
export async function createPostcard(object: MemoryObject, language: Language): Promise<Blob> {
  const { renderSpecimen } = await import('./postcard-render');
  await document.fonts.ready;
  const specimen = await renderSpecimen(object);
  const canvas = document.createElement('canvas'); canvas.width = POSTCARD_WIDTH; canvas.height = POSTCARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#050c16'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(specimen, 0, 220, 1080, 1080);
  ctx.fillStyle = '#e1eaf4'; ctx.font = '32px "Archivo Narrow"';
  ctx.fillText('COLLECTIVE GALAXY / OBSERVATION', 72, 100);
  ctx.font = '64px "Spectral"';
  const name = objectName(object.nameKey, language);
  // Fit every generated name without clipping; text remains left-aligned on the accession grid.
  let size = 64;
  while (ctx.measureText(name).width > 936 && size > 32) { size -= 2; ctx.font = `${size}px "Spectral"`; }
  ctx.fillText(name, 72, 1360);
  ctx.font = '36px "Archivo Narrow"';
  const type = language === 'es' ? { planet: 'Planeta', star: 'Estrella', moon: 'Luna' }[object.type] : object.type;
  ctx.fillText(`${type} · ${new Date(object.createdAt).toISOString().slice(0, 10)}`, 72, 1430);
  ctx.strokeStyle = '#60788e'; ctx.beginPath(); ctx.moveTo(72, 1480); ctx.lineTo(1008, 1480); ctx.stroke();
  ctx.font = '52px "Spectral"'; ctx.fillText('Be a Dragon 2026', 72, 1570);
  const url = objectUrl(object.id), qr = postcardQr(url), count = qr.getModuleCount(), module = Math.floor(260 / (count + 8));
  const side = (count + 8) * module, x = 1008 - side, y = 1630;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, side, side); ctx.fillStyle = '#050c16';
  for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) if (qr.isDark(row, col)) ctx.fillRect(x + (col + 4) * module, y + (row + 4) * module, module, module);
  ctx.fillStyle = '#e1eaf4'; ctx.font = '30px "Archivo Narrow"';
  ctx.fillText(language === 'es' ? 'Tu lugar en este cielo.' : 'Your place in this sky.', 72, 1680);
  const short = new URL(url);
  // Two lines keep the full current-origin address legible even on local LAN origins.
  ctx.font = '25px "Archivo Narrow"'; ctx.fillText(short.host, 72, 1770, x - 110); ctx.fillText(short.pathname, 72, 1810, x - 110);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image unavailable')), 'image/png'));
}
export function downloadPostcard(file: File) {
  const url = URL.createObjectURL(file), anchor = document.createElement('a');
  anchor.href = url; anchor.download = file.name; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function sharePostcard(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return 'shared'; }
    catch (error) { if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'cancelled'; throw error; }
  }
  downloadPostcard(file); return 'downloaded';
}
