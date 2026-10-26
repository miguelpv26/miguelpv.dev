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
   ever comes out smaller than the image it describes. The arithmetic lives in
   scripts/images.js; this file is only the table. */

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
