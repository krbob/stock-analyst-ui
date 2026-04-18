#!/usr/bin/env node
// Generates PWA icon PNGs using only Node.js built-ins (no dependencies).
// Mirrors the candlestick chart design from public/favicon.svg.

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');

const BG = { r: 0x1a, g: 0x1a, b: 0x2e };
const RED = { r: 0xef, g: 0x44, b: 0x44 };
const GREEN = { r: 0x22, g: 0xc5, b: 0x5e };

function setPixel(buf, size, x, y, c) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const i = (y * size + x) * 4;
  buf[i] = c.r; buf[i + 1] = c.g; buf[i + 2] = c.b; buf[i + 3] = 255;
}

function fillRect(buf, size, x1, y1, x2, y2, c) {
  for (let y = Math.round(y1); y < Math.round(y2); y++)
    for (let x = Math.round(x1); x < Math.round(x2); x++)
      setPixel(buf, size, x, y, c);
}

function fillRoundedBg(buf, size, radius, c) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = true;
      const corners = [
        [radius, radius, x < radius && y < radius],
        [size - radius, radius, x >= size - radius && y < radius],
        [radius, size - radius, x < radius && y >= size - radius],
        [size - radius, size - radius, x >= size - radius && y >= size - radius],
      ];
      for (const [cx, cy, active] of corners) {
        if (active) {
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy > radius * radius) { inside = false; break; }
        }
      }
      if (inside) setPixel(buf, size, x, y, c);
    }
  }
}

function createIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  // Transparent fill by default; rounded bg applied below.
  const s = (v) => v * size / 32;

  fillRoundedBg(buf, size, Math.round(s(6)), BG);

  // Red candle at x=8 (viewBox 32): wick 6-26, body 10-20 (x 5-11)
  fillRect(buf, size, s(7.25), s(6), s(8.75), s(26), RED);
  fillRect(buf, size, s(5), s(10), s(11), s(20), RED);

  // Green candle at x=17: wick 4-22, body 8-16 (x 14-20)
  fillRect(buf, size, s(16.25), s(4), s(17.75), s(22), GREEN);
  fillRect(buf, size, s(14), s(8), s(20), s(16), GREEN);

  // Green candle at x=26: wick 8-28, body 12-22 (x 23-29)
  fillRect(buf, size, s(25.25), s(8), s(26.75), s(28), GREEN);
  fillRect(buf, size, s(23), s(12), s(29), s(22), GREEN);

  return encodePNG(buf, size);
}

function encodePNG(pixels, size) {
  const rawLen = size * (size * 4 + 1);
  const raw = Buffer.alloc(rawLen);
  for (let y = 0; y < size; y++) {
    const rowOffset = y * (size * 4 + 1);
    raw[rowOffset] = 0;
    pixels.copy(raw, rowOffset + 1, y * size * 4, (y + 1) * size * 4);
  }
  const deflated = zlib.deflateSync(raw, { level: 9 });
  const chunks = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])];
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  chunks.push(makeChunk('IHDR', ihdr));
  chunks.push(makeChunk('IDAT', deflated));
  chunks.push(makeChunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeB, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData) >>> 0, 0);
  return Buffer.concat([len, typeB, data, crc]);
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [size, name] of [[180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
  fs.writeFileSync(path.join(OUT_DIR, name), createIcon(size));
  console.log(`${name} (${size}x${size})`);
}
console.log('Done!');
