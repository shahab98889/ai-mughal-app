import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Minimal dependency-free PNG generator for compliant 192x192, 512x512, and 180x180 PWA icons
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createIconPNG(size: number, maskable: boolean): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawData = Buffer.alloc(size * (size * 4 + 1));
  const center = size / 2;
  const scale = maskable ? 0.72 : 0.85;
  const outerR = (size / 2) * scale;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    rawData[rowStart] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      const dx = (x - center) / outerR;
      const dy = (y - center) / outerR;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background: obsidian #0B0F17
      let r = 11;
      let g = 15;
      let b = 23;
      const a = 255;

      // Subtle emerald ring
      if (dist > 0.72 && dist < 0.82) {
        r = 16;
        g = 185;
        b = 129;
      } else if (dist <= 0.72) {
        r = 19;
        g = 27;
        b = 46;
        // Draw 'M' monogram inside
        const nx = dx / 0.72;
        const ny = dy / 0.72;
        const inLeftLeg = nx >= -0.52 && nx <= -0.32 && ny >= -0.45 && ny <= 0.45;
        const inRightLeg = nx >= 0.32 && nx <= 0.52 && ny >= -0.45 && ny <= 0.45;
        const inLeftDiag = ny >= -0.45 && ny <= 0.18 && Math.abs(nx - ny * 0.75 + 0.35) < 0.12 && nx <= 0.02;
        const inRightDiag = ny >= -0.45 && ny <= 0.18 && Math.abs(-nx - ny * 0.75 + 0.35) < 0.12 && nx >= -0.02;
        const inTopGem = Math.sqrt(nx * nx + (ny + 0.55) * (ny + 0.55)) < 0.1;

        if (inLeftLeg || inRightLeg || inLeftDiag || inRightDiag) {
          r = 248;
          g = 250;
          b = 252;
        } else if (inTopGem) {
          r = 52;
          g = 211;
          b = 153;
        }
      }

      rawData[idx] = r;
      rawData[idx + 1] = g;
      rawData[idx + 2] = b;
      rawData[idx + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', iend),
  ]);
}

function createScreenshotPNG(width: number, height: number): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth 8
  ihdr[9] = 2; // color type RGB (smaller & fast)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLen = width * 3 + 1;
  const rawData = Buffer.alloc(height * rowLen);

  // Fill one template row and copy for speed, adding subtle UI header/card bands
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowLen;
    rawData[rowStart] = 0;
    const isHeader = y < Math.floor(height * 0.08);
    const isComposer = y > Math.floor(height * 0.86);
    const isAccentLine = y === Math.floor(height * 0.08) || y === Math.floor(height * 0.86);

    const r = isAccentLine ? 16 : isHeader || isComposer ? 17 : 11;
    const g = isAccentLine ? 185 : isHeader || isComposer ? 24 : 15;
    const b = isAccentLine ? 129 : isHeader || isComposer ? 39 : 23;

    for (let x = 0; x < width; x++) {
      const idx = rowStart + 1 + x * 3;
      rawData[idx] = r;
      rawData[idx + 1] = g;
      rawData[idx + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 1 });
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', iend),
  ]);
}

export function ensurePWAIcons(publicDir: string) {
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const targets = [
    { file: 'pwa-192x192.png', size: 192, maskable: false },
    { file: 'pwa-512x512.png', size: 512, maskable: false },
    { file: 'pwa-maskable-512x512.png', size: 512, maskable: true },
    { file: 'apple-touch-icon.png', size: 180, maskable: false },
  ];
  for (const t of targets) {
    const filePath = path.join(publicDir, t.file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, createIconPNG(t.size, t.maskable));
    }
  }

  const screenshots = [
    { file: 'screenshot-mobile.png', width: 1080, height: 1920 },
    { file: 'screenshot-desktop.png', width: 1920, height: 1080 },
  ];
  for (const s of screenshots) {
    const filePath = path.join(publicDir, s.file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, createScreenshotPNG(s.width, s.height));
    }
  }
}
