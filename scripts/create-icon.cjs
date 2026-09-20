const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const size = 256,
  raw = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y++) {
  const row = y * (size * 4 + 1);
  for (let x = 0; x < size; x++) {
    const dx = x - 128,
      dy = y - 128,
      r = Math.sqrt(dx * dx + dy * dy);
    let color = [24, 28, 42, 255];
    if (r > 120) color = [0, 0, 0, 0];
    else {
      const ring = Math.abs(r - 86) < 3;
      const ring2 =
        Math.abs(
          Math.sqrt((((dx + dy) * 0.707) / 1.25) ** 2 + (((dy - dx) * 0.707) / 0.68) ** 2) - 75,
        ) < 3;
      const letter =
        (x > 93 && x < 103 && y > 94 && y < 161) ||
        (x > 153 && x < 163 && y > 94 && y < 161) ||
        (Math.abs(x - (98 + (y - 95) * 0.9)) < 5 && y > 95 && y < 160);
      if (ring || ring2 || letter) color = [177, 169, 241, 255];
      if ((x - 187) ** 2 + (y - 64) ** 2 < 65) color = [219, 217, 255, 255];
    }
    const off = row + 1 + x * 4;
    for (let c = 0; c < 4; c++) raw[off + c] = color[c];
  }
}
function crc(b) {
  let c = 0xffffffff;
  for (const byte of b) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type),
    len = Buffer.alloc(4),
    sum = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  sum.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, sum]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.mkdirSync(path.resolve(__dirname, '../public/assets'), { recursive: true });
fs.writeFileSync(path.resolve(__dirname, '../public/assets/icon.png'), png);
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 0;
header[7] = 0;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
fs.writeFileSync(
  path.resolve(__dirname, '../public/assets/icon.ico'),
  Buffer.concat([header, png]),
);
console.log('Nexus application icons created');
