import {inflateSync} from 'node:zlib';
import core from '../../apps/web/js/strings/core.js';
import galaxy from '../../apps/web/js/strings/galaxy.js';
import player from '../../apps/web/js/strings/player-ui.js';
import {en as adminEn, es as adminEs} from '../../apps/web/js/strings/admin.js';

// Names and labels that are the same word in both languages. Copied sentences are not.
const SAME_ON_PURPOSE = new Set([
  'Little Galaxy', 'Aurora', 'Coral', 'Jade', 'Color', 'Gas', 'Corona',
  'Alexander Kholodov · USFQ', 'Español', 'English', 'Auto', '{noun}', '{n} km', '{n} K',
]);

export function identicalProse() {
  const tables = [
    ['core', core.en, core.es],
    ['galaxy', galaxy.en, galaxy.es],
    ['player', player.en, player.es],
    ['admin', adminEn, adminEs],
  ];
  const hits = [];
  for (const [table, en, es] of tables) {
    for (const key of Object.keys(en)) {
      const value = en[key];
      if (value !== es[key] || SAME_ON_PURPOSE.has(value)) continue;
      if (!/\s/u.test(value) || !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{4,}/u.test(value)) continue;
      hits.push(`${table}.${key}`);
    }
  }
  return hits;
}

export function assertCopyParity() {
  const hits = identicalProse();
  if (hits.length) throw new Error(`English prose copies Spanish: ${hits.join(', ')}`);
}

export function pngSize(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (bytes.length < 24 || bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error('Not a PNG');
  return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
}

export function assertShotSize(name, buffer) {
  const size = pngSize(buffer);
  const phone = /-phone-/u.test(name);
  const expected = phone ? {width: 390, height: 844} : {width: 1440, height: 900};
  if (size.width !== expected.width || size.height !== expected.height) {
    throw new Error(`${name} is ${size.width}×${size.height}; a ${phone ? 'phone' : 'laptop'} shot is ${expected.width}×${expected.height}`);
  }
  return size;
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function decodePng(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let pos = 8, width = 0, height = 0, color = 0, idat = [];
  while (pos + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(pos);
    const type = bytes.toString('ascii', pos + 4, pos + 8);
    const chunk = bytes.subarray(pos + 8, pos + 8 + length);
    pos += 12 + length;
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4); color = chunk[9];
    } else if (type === 'IDAT') idat.push(chunk);
    else if (type === 'IEND') break;
  }
  const channels = color === 6 ? 4 : color === 2 ? 3 : 0;
  if (!channels) throw new Error('Unsupported PNG');
  const raw = Buffer.concat(idat.map(chunk => chunk));
  const inflated = inflate(raw);
  const stride = width * channels;
  const data = Buffer.alloc(height * stride);
  let i = 0, prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = inflated[i++];
    const row = inflated.subarray(i, i + stride); i += stride;
    const out = data.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? out[x - channels] : 0;
      const up = prev[x], upLeft = x >= channels ? prev[x - channels] : 0;
      const add = filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : filter === 4 ? paeth(left, up, upLeft) : 0;
      out[x] = (row[x] + add) & 255;
    }
    prev = out;
  }
  return {width, height, channels, data};
}

function inflate(raw) {
  return Buffer.from(inflateSync(raw));
}

// How many inner pixels differ from the button face. A blank disc scores near zero.
export function iconContrast(buffer) {
  const {width, height, channels, data} = decodePng(buffer);
  const face = (Math.floor(height * 0.22) * width + Math.floor(width * 0.5)) * channels;
  const fr = data[face], fg = data[face + 1], fb = data[face + 2];
  let n = 0;
  const x0 = Math.floor(width * 0.3), x1 = Math.floor(width * 0.7);
  const y0 = Math.floor(height * 0.3), y1 = Math.floor(height * 0.7);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const k = (y * width + x) * channels;
    if (Math.abs(data[k] - fr) + Math.abs(data[k + 1] - fg) + Math.abs(data[k + 2] - fb) > 90) n++;
  }
  return n;
}

export async function assertHeaderIcons(page, state) {
  const buttons = page.locator('.top-actions .icon-btn, #panelTheme');
  const count = await buttons.count();
  const bare = [];
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    if (!(await button.isVisible())) continue;
    const score = iconContrast(await button.screenshot());
    if (score < 8) bare.push((await button.getAttribute('aria-label')) || (await button.getAttribute('id')) || `button ${i}`);
  }
  if (bare.length) throw new Error(`${state}: header control with no visible icon (${bare.join(', ')})`);
}
