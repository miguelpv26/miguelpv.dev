/* images.js — responsive-image `sizes`, generated from the layouts the CSS draws.

   A `<source srcset="… 320w, … 640w">` only works if its `sizes` tells the
   browser, before any CSS has loaded, how wide the image will be drawn. Too
   small and the browser picks a file too small for the box (blurry); too big
   and it downloads more than it shows. The right value depends on two things:
   the box (which the CSS sizes differently at every breakpoint) and the image's
   own shape, because the slides are object-fit: a portrait screenshot in a
   16:9 `contain` box fills only part of its width, and a 4:3 photo in a square
   `cover` box spills past it. Typed by hand into every <picture>, that's a
   different calc() per image that silently goes stale when the CSS changes.

   So the source pages don't carry `sizes`. Each AVIF <source> names the layout
   it sits in, and build-html.js writes the exact `sizes` from the table below
   and the image's real dimensions:

       <source type="image/avif" srcset="… 320w, … 640w, … 1917w" data-sizes="case-study" />

   Each layout lists the viewport ranges its CSS defines, narrowest first, and
   for each the image box as `vw`·viewport + `px` wide and `ratio` tall: the
   largest height ÷ width the box reaches in that range (a box that narrows
   while its height holds gets taller relative to its width; the largest ratio
   is the safe one for both object-fits). `ratio` is null where the height
   follows the content, so only the width bounds what the image needs. The figures come from the CSS: every section is
   min(90vw, 1400px) wide (--max-content-width / --max-hero-width) less its
   padding, which is why 1555.56px (1400 / 0.9) recurs as the point where a
   layout stops growing. Every generated length is rounded up, never down.

   Changed a padding, a gap, a column split or a breakpoint these layouts depend
   on? Update the table, rebuild, and run `npm run audit-sizes`, which measures
   every image in a real browser across viewport widths and fails if a `sizes`
   ever comes out smaller than the image it describes. */
import fs from 'fs';
import path from 'path';

export const IMAGE_LAYOUTS = {
  // .hero picture — the homepage portrait, `cover`. Stacked (≤791px) it's at
  // most 300×300, narrowed by the hero's 16px padding below a 368.89px
  // viewport while its height holds at 300px (256×300 at 320px); beside the
  // heading 288×320 (≤1039px), then at most 360×400 — between 1040px and
  // ~1208px the grid narrows it to the image's own aspect (≈331×400).
  hero: {
    fit: 'cover',
    ranges: [
      { max: 368.89, vw: 90, px: -32, ratio: 300 / 256 },
      { max: 791, vw: 0, px: 300, ratio: 1 },
      { max: 1039, vw: 0, px: 288, ratio: 320 / 288 },
      { vw: 0, px: 360, ratio: 400 / 331 },
    ],
  },
  // .case-study__media — the case study's slider: the full article column
  // (padding 52px; 32px ≤791px; 16px ≤500px), a 16:9 box, `contain`.
  'case-study': {
    fit: 'contain',
    ranges: [
      { max: 500, vw: 90, px: -32, ratio: 9 / 16 },
      { max: 791, vw: 90, px: -64, ratio: 9 / 16 },
      { max: 1555.56, vw: 90, px: -104, ratio: 9 / 16 },
      { vw: 0, px: 1296, ratio: 9 / 16 },
    ],
  },
  // .projects .project-card .project-thumb — the homepage teasers. A card is a
  // grid track less 2×24px padding (20px ≤791px, 16px ≤500px) and two 1px
  // borders (card + thumb). The grid (auto-fit, minmax(300px, 1fr), 24px gap;
  // minmax(280px) ≤1039px) holds one column ≤791px, two until it can fit three
  // 300px tracks (container ≥ 948px, viewport ≥ 1168.89px), then three — as
  // long as there are three teasers. Box 16:9 ≤791px, 1.833:1 above.
  'home-card': {
    fit: 'contain',
    ranges: [
      { max: 500, vw: 90, px: -68, ratio: 9 / 16 },
      { max: 791, vw: 90, px: -108, ratio: 9 / 16 },
      { max: 1168.89, vw: 45, px: -116, ratio: 1 / 1.833 },
      { max: 1555.56, vw: 30, px: -152 / 3 - 52, ratio: 1 / 1.833 },
      { vw: 0, px: 364, ratio: 1 / 1.833 },
    ],
  },
  // .project-collection .project-card .project-thumb — the hub's rows. Stacked
  // (≤900px) the media is the card's full width less its 1px borders, a 16:10
  // box; side by side it's 46% of the card, and its height follows the row
  // (every row matches the tallest card's copy), so only the width is known.
  'hub-card': {
    fit: 'contain',
    ranges: [
      { max: 500, vw: 90, px: -34, ratio: 10 / 16 },
      { max: 791, vw: 90, px: -66, ratio: 10 / 16 },
      { max: 900, vw: 90, px: -106, ratio: 10 / 16 },
      { max: 1555.56, vw: 0.46 * 90, px: 0.46 * -106, ratio: null },
      { vw: 0, px: 0.46 * 1294, ratio: null },
    ],
  },
  // .about__slider — the homepage photos: the section's full width (padding
  // 52px; 32px ≤791px; 20px ≤500px) capped at 500px while stacked (≤1200px),
  // 460px beside the text. A square box, `cover`.
  about: {
    fit: 'cover',
    ranges: [
      { max: 500, vw: 90, px: -40, ratio: 1 },
      { max: 626.67, vw: 90, px: -64, ratio: 1 },
      { max: 1200, vw: 0, px: 500, ratio: 1 },
      { vw: 0, px: 460, ratio: 1 },
    ],
  },
};

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
  if (!layout) throw new Error(`unknown image layout "${layoutName}" (scripts/images.js has ${Object.keys(IMAGE_LAYOUTS).join(', ')})`);
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
