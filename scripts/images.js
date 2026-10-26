/* images.js — responsive-image `sizes` from the layout table in data/images.js
   (see the comment there for what each layout restates from the CSS), and the
   dimension reader the build, the checks and the audit share. */
import fs from 'fs';
import path from 'path';
import { IMAGE_LAYOUTS } from '../data/images.js';

export { IMAGE_LAYOUTS };

/** Round up to two decimals, so a generated length is never smaller than the box. */
const up = n => String(Math.ceil(n * 100 - 1e-9) / 100);

/**
 * The `sizes` value for an image of the given aspect (width ÷ height) in a
 * layout: per range, the width its content is drawn at. `contain` draws it at
 * the box's width or less (a narrower image is bounded by the box's height);
 * `cover` at the box's width or more (a wider one is scaled to the box's height).
 */
export function sizesFor(layoutName, aspect) {
  const layout = IMAGE_LAYOUTS[layoutName];
  if (!layout) throw new Error(`unknown image layout "${layoutName}" (data/images.js has ${Object.keys(IMAGE_LAYOUTS).join(', ')})`);
  return layout.ranges.map(({ max, vw, px, ratio }) => {
    const scale = ratio === null ? 1
      : layout.fit === 'contain' ? Math.min(1, ratio * aspect) : Math.max(1, ratio * aspect);
    const offset = Number(up(px * scale));
    const length = vw === 0 ? `${offset}px`
      : offset === 0 ? `${up(vw * scale)}vw`
      : `calc(${up(vw * scale)}vw ${offset < 0 ? '-' : '+'} ${Math.abs(offset)}px)`;
    return max === undefined ? length : `(max-width: ${max}px) ${length}`;
  }).join(', ');
}

/** Pixel dimensions of a PNG, JPEG, WebP or AVIF file, read from its header. */
export function imageSize(file) {
  const b = fs.readFileSync(file);
  switch (path.extname(file).toLowerCase()) {
    case '.png':
      return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    case '.jpg':
    case '.jpeg':
      for (let i = 2; i < b.length;) {
        const marker = b[i + 1];
        // SOF0–SOF3: baseline/progressive frame headers carry the size.
        if (marker >= 0xc0 && marker <= 0xc3) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
        i += 2 + b.readUInt16BE(i + 2);
      }
      break;
    case '.webp': {
      const chunk = b.toString('ascii', 12, 16);
      if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
      if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
      if (chunk === 'VP8L') {
        const bits = b.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      break;
    }
    case '.avif': {
      // Image spatial extents ('ispe') properties: version/flags, then width,
      // height. A tiled image has one per tile as well as the whole; take the largest.
      // Only the boxes before the image data ('mdat') are metadata.
      const mdat = b.indexOf('mdat');
      const header = mdat > 0 ? b.subarray(0, mdat) : b;
      let size;
      for (let at = header.indexOf('ispe'); at > 0; at = header.indexOf('ispe', at + 4)) {
        const width = header.readUInt32BE(at + 8), height = header.readUInt32BE(at + 12);
        if (!size || width * height > size.width * size.height) size = { width, height };
      }
      if (size) return size;
      break;
    }
  }
  throw new Error(`can't read the dimensions of ${file}`);
}
