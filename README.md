# miguelpv.dev

**The personal portfolio of Miguel Payá Vañó — a Full-Stack Developer.**
Built by hand with plain **HTML, vanilla CSS and vanilla JavaScript**. No framework, no bundler, no runtime dependencies, no tracking. The only tooling is a minifier and a few small Node build scripts.

`Handcrafted` · `No framework` · `0 runtime deps` · `Lighthouse 100 × 4` · `EN · ES` · `Cloudflare Pages` · `MIT licensed`

> Live at **[miguelpv.dev](https://miguelpv.dev)** · **[/en/](https://miguelpv.dev/en/)** · **[/es/](https://miguelpv.dev/es/)**

---

## Why this repo is interesting

Most portfolios reach for a framework, a component library and a handful of CDN scripts. This one is a deliberate counter-example: a fully static, bilingual site that scores perfect Lighthouse across **Performance, Accessibility, Best Practices and SEO**, ships an **A+ security header profile**, makes **zero third-party network requests**, and still has a custom accessible carousel and a couple of genuinely useful interaction details — all in one JS file and a stack of CSS partials.

The interesting parts, at a glance:

- 🛡️ **Security** — a strict Content-Security-Policy (no `unsafe-inline`, Trusted Types enabled), HSTS preload, locked-down Permissions-Policy, and a Worker that repeats the headers on the root redirect.
- 🔍 **SEO** — per-locale `canonical`/`hreflang`/`x-default`, Open Graph + Twitter cards, JSON-LD `@graph`, and a sitemap generated at deploy time.
- ♿ **Accessibility** — WCAG 2.1 AA target, real keyboard support, focus management, ARIA live regions, and `prefers-reduced-motion` respected everywhere.
- ⚡ **Performance** — responsive `<picture>` images, self-hosted subset fonts, **CSS inlined into every page** (no render-blocking stylesheet request), lazy-initialised JS.
- 🎠 **A custom, dependency-free carousel** — mixed image/video slides, per-slide durations, dot indicators, keyboard nav, and screen-reader announcements in the page's language. *(deep dive below)*
- 🖱️ **Right-click → full-resolution** — an intentional touch that resolves the performance-vs-fidelity trade-off. *(the "why" is explained in detail below — it's the part I'm most fond of)*
- 🔒 **Privacy** — no analytics, no cookies, no trackers, no external requests. Fonts and everything else are self-hosted.

---

## Tech & tooling

| Concern | Choice |
| --- | --- |
| Markup | Hand-written HTML, one file per page per locale |
| Styles | Vanilla CSS, authored as ordered partials, tokens in `:root` |
| Behaviour | Vanilla JS in ordered partials, bundled into one script; no modules, no deps |
| Fonts | JetBrains Mono (400/500/600), self-hosted `woff2`, latin subset |
| Build | `terser` (JS) + `clean-css` (CSS) + `archiver` (deploy zip) — that's the whole dependency list |
| Hosting | Cloudflare Pages (`_headers`) + one Cloudflare Worker for language routing |

There is **no framework dev server, no linter and no test runner** — that's a deliberate constraint, not a gap. A ~60-line preview server and a pre-deploy check script (`npm run check`) cover what those would.

---

## Architecture

### Language routing
The site has no real "root" page. `cloudflare/worker.js` is the only thing that lives at `/`: it reads `Accept-Language`, looks **only at the highest-priority entry**, and `302`-redirects to `/es/` for Spanish and the regional languages of Spain (`es`, `ca`, `eu`, `gl`) or `/en/` otherwise. It redirects **bots and humans identically** (no User-Agent cloaking), marks the endpoint `X-Robots-Tag: noindex, nofollow`, sets `Vary: Accept-Language`, and repeats the core security headers because this is often the first response at the origin. Everything except `/` falls through to the static assets.

### Pages
`en/` and `es/` are **independent, hand-maintained translations** — not generated from a shared template at runtime. Each page carries its own content; the parts every page repeats — including its JSON-LD — are filled in at build time (below). The current page set, per locale:

- the homepage (`index.html`)
- a projects index (`projects.html` / `proyectos.html`)
- one case study per project (`biglo`, `digitalando`, `portfolio`, `abogada-de-la-tierra`, `input-color-feedback`)
- a blog index (`blog.html`) and one page per article (`blog/web-font-strategy.html` / `blog/estrategia-fuentes-web.html`)

Every page pair is listed once in `data/site.js`, which both the HTML build and the sitemap read. Any user-facing copy, metadata or structured-data change is made in **both** locales in lock-step.

### Shared header, footer and `<head>`
The parts every page repeats — the common `<head>` block (charset, viewport, font preloads, favicons, manifest), the SEO block (title, description, canonical, hreflang, Open Graph, Twitter), the skip link + header + nav, and the footer — live once in `templates/`. `scripts/build-html.js` stamps them into each page between build markers:

```html
<!-- build:header -->  …generated, never hand-edited…  <!-- /build:header -->
```

It fills in what varies per page from `site.js`: the asset path depth, the locale's copy, the page's title, description and social card, its canonical and hreflang URLs, the EN/ES toggle pointing at the page's twin, and the "you are here" state (`aria-current="page"` on a section's own page, `"true"` under it). So a title or description is changed in one place — `site.js` — and every tag that repeats it follows. Everything outside the markers — JSON-LD and content — stays hand-written. The markers stay empty in the source pages; only the built copies in `dist/` carry what goes between them. `404.html` is standalone and isn't templated.

### Project facts
A project's role, years, category, status and tags used to be typed out on the projects hub, the homepage and its case study, in both locales — and drifted. They live in `data/projects.js` now (with per-locale labels for tags, categories and statuses), and the build renders them into `<!-- build:project-… SLUG -->` regions: a hub card's opening tag with the filter data the hub's JS reads, its meta line, the tag chips (filter buttons on the hub, plain labels elsewhere) and a case study's role · years · status line. Descriptions, media and the case studies' detailed stack lists stay hand-written.

### Client JS (`assets/js/partials/`)
One classic script cut into ordered partials — utilities, one file per feature, and `08-init.js` last — that the build concatenates and minifies into a single bundle, like the CSS. `initApp()` runs each feature inside a `safeInit(name, fn)` wrapper, so one broken feature can't abort the rest — errors are reported via the standard `reportError` API with the feature name attached as `Error.cause`. Every feature **degrades silently** if its root elements are absent. The features:

- **Mobile menu** — a button-driven drawer below `1276px` that manages `aria-expanded`/`aria-hidden`/`inert`, locks scroll on the real scroll container (`html`), keeps focus inside the header while open (everything else on the page goes `inert`), restores focus on close, and closes on ESC / overlay click / link activation.
- **Matrix background** — a canvas effect that **early-returns under `prefers-reduced-motion`**, clamps DPR to 2, and resets its timing on `visibilitychange`.
- **The carousel** — see the deep dive below.
- **Right-click → full-resolution** — see the deep dive below.
- **Project-card links** — makes each project card fully clickable while keeping the media's right-click behaviour intact (this is the clever bit that makes the two features coexist).
- **Project filters** — search, tag chips and a last-activity sort on the projects hub. The toolbar ships `hidden` and only JS reveals it, so a no-JS visitor gets the full list rather than dead controls; the active tag and query are mirrored into `?tag=` / `?q=` so a filtered view can be shared, and `/` focuses the search.

### Styles
Authored as ordered partials in `assets/css/partials/` (`01-tokens.css` … `15-responsive.css`) — **filename order is the cascade order**. Design tokens (spacing, colours, typography, radii, shadows, z-index scale) live in `:root` in `01-tokens.css`. BEM-ish class names. The mobile breakpoint (`1276px`) is duplicated in CSS and in `MOBILE_BREAKPOINT_PX` in the JS, and the two must change together.

---

## 🎠 The custom carousel (deep dive)

Every project/gallery uses one generic slider: any `[data-slider]` block with `[data-slide]` children and `[data-slide-prev]` / `[data-slide-next]` controls. It is **written from scratch, in ~300 lines, with no library**.

**What it does**
- **Lazy initialisation** via `IntersectionObserver` (`rootMargin: 50px`) — a slider costs nothing until it's about to enter the viewport. Until then its hidden slides are `display: none`, so their lazy images don't download with the page (stacked under the shown slide, they'd otherwise count as "near the viewport"), and a hidden video slide carries its poster as `data-poster`, which the slider turns into a `poster` when it starts.
- **Mixed media** — image *and* `<video>` slides in the same track. Videos loop, so a video slide's `data-duration` is set to the clip's length and it plays once through before the next slide. They ship `preload="none"` with a `poster`, so a clip downloads only when its slide is actually shown.
- **Per-slide timing** — `data-duration` (seconds, validated and clamped to 1–60; default 5s).
- **Auto-built dot indicators** with `aria-current`, roving `tabindex`, and `aria-controls` pointing at each slide's id (namespaced per slider, so several sliders on one page never share an id).
- **Full keyboard support** — `←` / `→` / `Home` / `End`.
- **Screen-reader announcements** — a `role="status"` `aria-live="polite"` region announces *"Slide 2 of 5: <alt text>"*, **localised** from `<html lang>` (English on `/en/`, Spanish on `/es/`).
- **Pauses when it should** — on hover, on focus-within, and when the tab is hidden (`visibilitychange`), resuming only if the slider itself caused the pause.
- **Respects motion preferences** — under `prefers-reduced-motion` it never auto-advances; it becomes a purely manual, keyboard/click-driven gallery.

**Why not a slider library?** A third-party carousel would drag in its own CSS and JavaScript (often tens of KB), rarely gets ARIA and reduced-motion right out of the box, and almost never handles mixed image and video slides with their own timings. Rolling it by hand keeps the bundle tiny, keeps the accessibility behaviour under my control, and keeps the zero-dependency promise intact.

---

## 🖱️ Right-click → full-resolution (deep dive)

This is a small feature with a deliberate rationale, so it gets its own section.

### The problem it solves
To hit perfect Core Web Vitals, **every screenshot is served through `<picture>` as AVIF → WebP → PNG with a `srcset` / `sizes` ladder**. The browser paints the *smallest variant that fits the slot* — often a 320–640px image, and on the projects grid that slot is small. That is exactly what you want for load speed. But it creates a conflict with how people actually inspect work:

- A recruiter zooming into a UI, a designer checking spacing, a potential client scrutinising a real product screen — they all reach for the same universal gesture: **right-click → "Open image in new tab."**
- Native browser behaviour opens *whichever responsive candidate happened to be downloaded* — frequently the low-res one — and on a `<picture>` with multiple `<source>`s the result is inconsistent across browsers.

So the intuitive gesture betrays the visitor: they ask for "the image" and get a blurry thumbnail.

### What the handler does
`initContextMenuHandlers()` intercepts `contextmenu` on any `picture[data-fullres]` and opens the **pristine full-resolution original** (the `data-fullres` URL) in a new tab instead. Videos get the same treatment: right-clicking a `video[data-slide]` opens its raw `src` directly — the carousel's videos are muted/looping and have no controls, so the native menu is nearly useless on them anyway.

### Why it's a genuinely good idea
1. **It dissolves the performance-vs-fidelity trade-off** instead of picking a side. Pages stay feather-light (tiny responsive variants → perfect CWV), yet the full-quality asset is one gesture away for anyone who wants it.
2. **It turns unpredictable native behaviour into deterministic behaviour.** Rather than "you get whichever `srcset` candidate the browser cached," you always get the exact, intended, highest-quality file.
3. **Zero UI cost, zero dependencies.** No lightbox library, no zoom modal, no *"view full size"* buttons cluttering the design, no extra DOM to shift layout (CLS stays 0). It reuses a gesture people already know.
4. **It degrades gracefully.** `preventDefault()` fires **only after** the new tab actually opens — if a popup blocker stops it, the browser's normal context menu returns untouched. The user never loses a capability.
5. **It's safe.** The tab opens with `noopener,noreferrer`, so the opened asset can't reach back into the page via `window.opener` and no referrer leaks.
6. **The stacking is intentional.** On the projects grid each card is one big link (a stretched `<a>` overlay), but the **media is layered *above* that overlay on purpose** so a right-click lands on the picture/video (full-res handler) rather than on card navigation. Left-click on the media is then re-wired in JS to mirror native anchor behaviour — a plain click follows the link, a ⌘/Ctrl-click opens a new tab. The result: the whole card is clickable **and** every screenshot stays right-click-inspectable.

In one line: it's a progressive-enhancement touch that respects both the machine (speed) and the human (the ability to actually *see* the work).

---

## 🛡️ Security

Security headers are shipped from `_headers` (Cloudflare Pages) and are treated as an acceptance criterion, not an afterthought — the target is A+ on securityheaders.com / Mozilla Observatory.

**Content-Security-Policy** (strict, no `unsafe-inline`):
```
default-src 'self'; script-src 'self'; style-src 'self' 'sha256-…';
img-src 'self' data:; font-src 'self'; media-src 'self'; manifest-src 'self';
base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none';
upgrade-insecure-requests; require-trusted-types-for 'script'; trusted-types default
```
Highlights:
- **No `unsafe-inline` anywhere.** The one inline `<style>` block is allow-listed by a **sha256 hash** that the build recomputes on every run (see below), so inline CSS is permitted without opening the door to arbitrary inline styles.
- **Trusted Types** (`require-trusted-types-for 'script'`) — a strong defence against DOM-based XSS, requiring a policy to create dangerous sink values.
- `base-uri 'none'`, `object-src 'none'`, `frame-ancestors 'none'` — no base-tag hijacking, no plugins, no embedding.

**And the rest of the profile:**
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (2 years, preload-ready)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Cross-Origin-Opener-Policy: same-origin`
- `Permissions-Policy` denies accelerometer, camera, geolocation, gyroscope, magnetometer, microphone, payment and usb
- `/.well-known/security.txt` (RFC 9116) says where to report a vulnerability; `npm run check` warns 30 days before its yearly `Expires` and fails once it has passed
- Fonts and the hashed JS bundle are served `Cache-Control: public, max-age=31536000, immutable`; images (stable names, so not immutable) are fresh for a week and revalidated in the background for up to 30 days more

The Worker re-emits HSTS / `nosniff` / `Referrer-Policy` on the root redirect so the very first response at the origin is already hardened.

---

## 🔍 SEO

- Per-locale unique `<title>` and `<meta name="description">`.
- `canonical` + `hreflang` alternates for `en`, `es` and `x-default`, mutually consistent and matching the sitemap. The language-negotiation root is `noindex` and never a canonical target.
- Meta descriptions kept under ~155 characters, so search results show them whole. Titles, descriptions and social cards live in `data/site.js` and are generated into each page, so the `<title>`, Open Graph and Twitter tags can't disagree.
- **Open Graph** and **Twitter Card** tags with a **1200×630 social card for every page in both locales** — `assets/img/og/home-en.png` / `home-es.png` for the homepages (made by hand), `assets/img/og/<page>-<locale>.png` for the rest, rendered from `templates/og-card.html` by `npm run og-cards` in the site's own fonts. Articles carry the same image in their `BlogPosting` JSON-LD.
- **JSON-LD `@graph`** per page, **generated** by `scripts/jsonld.js` from `site.js` and `projects.js`: the same `WebSite` and `Person` everywhere, the page's own node (`WebPage`, `CollectionPage` + `ItemList`, `Blog` or `BlogPosting`), a `BreadcrumbList` built from the same trail as the visible breadcrumb, and a `SoftwareApplication` / `SoftwareSourceCode` / `WebSite` entity for each project the page shows. Entities that share an `@id` across pages can't disagree, because there's only one source.
- `sitemap.xml` is **generated at deploy time** by `scripts/deploy.js` from `data/site.js` (one `<url>` per locale per page, with reciprocal `hreflang` alternates). It lists only canonical, indexable URLs — not the `noindex` root redirect — and each `<lastmod>` is the date of the last commit that touched that page (today, if it has uncommitted changes), so Google can trust the field. `robots.txt` allows crawling and points to it.
- Renamed URLs keep working through 301s in `_redirects`.

---

## ♿ Accessibility

Target: **WCAG 2.1 AA, zero axe issues.**

- Semantic landmarks — including a labelled main `<nav>`, so screen-reader users can jump straight to it — exactly one `<h1>` per page, no skipped heading levels.
- `:focus-visible` outlines on every interactive control; full keyboard operability (menu, carousel, dot indicators).
- Correct ARIA: `aria-expanded`/`aria-controls` on toggles, `aria-hidden` + `inert` on off-screen UI, `aria-current` on active nav/dots, `role="status"` + `aria-live="polite"` for carousel announcements, `aria-label` on icon-only controls, `aria-hidden` on decorative SVGs.
- **`prefers-reduced-motion`** neutralises the matrix canvas and the carousel's auto-advance.
- The mobile drawer implements scroll-lock, focus containment (the page behind it goes `inert`) and focus-restore.
- Carousel videos carry an `aria-label`, which the slide announcements read out too.
- A `.sr-only` helper carries screen-reader-only text; text contrast meets AA.

---

## ⚡ Performance

- **Responsive images** via `<picture>`: AVIF → WebP → raster with `srcset` + `sizes` and multiple rendered widths. The `sizes` aren't hand-typed: the build derives each one from a table of the CSS layouts and the image's own shape (a portrait screenshot letterboxed in a 16:9 box needs far fewer pixels than the box is wide), rounding up, and `npm run audit-sizes` measures every image in a real browser from 320px to 2560px to prove no `sizes` ever undershoots. Every slider reserves its box with `aspect-ratio` and positions its slides inside it, so nothing shifts as media loads → **CLS stays 0**. The LCP image (the hero portrait) is eager + `fetchpriority="high"` and preloaded with the same `imagesrcset`/`imagesizes` as its `<picture>`, so the preload is always the file the page uses (`npm run check` enforces it); everything below the fold is lazy, and a slider's hidden slides wait until the slider starts, so on a phone the homepage loads ~140 KB of images instead of ~420 KB and nothing competes with the hero.
- **Videos** are H.264 screen recordings encoded for the job (no audio track, `+faststart`): the three clips total ~730 KB. They ship `preload="none"` behind a ~20 KB WebP poster. The exact ffmpeg settings are in `CLAUDE.md`; ffmpeg itself isn't a dependency, since it's only needed when a clip is added.
- **Self-hosted fonts**, subset to latin, versioned filenames, cached `immutable` — no font CDN.
- **CSS is inlined into every page** at build time, so there is **no render-blocking stylesheet request** at all.
- **The JS bundle is deferred**; sliders and other expensive work are lazy-initialised via `IntersectionObserver`.

---

## 🔒 Privacy

This site does not watch you.

- **No analytics, no cookies, no trackers, no consent banners** — because there is nothing to consent to.
- **Zero third-party network requests.** The strict CSP (`default-src 'self'`) forbids them, and the site is built so it never needs one — fonts, images, styles and scripts are all first-party.
- Self-hosting the fonts means **no request to a font CDN**, so no visitor IP addresses leak to a third party just for typography.
- `Referrer-Policy: strict-origin-when-cross-origin` rounds out the posture.

---

## 🎨 Design

A terminal / "matrix" aesthetic: near-black canvas (`#0d0d0d` / `#000`), a single terminal-green accent (`#16c60c`), and **JetBrains Mono** throughout. Design tokens in `:root` drive spacing, colour, type, radii, shadows and a z-index scale; components use BEM-ish naming. The falling-glyph canvas background nods to the theme without ever blocking content — and disappears entirely under reduced-motion. The social share cards reuse the same brand (green-on-dark, JetBrains Mono, corner glow).

---

## 📱 PWA

Each locale links its own manifest — `site.webmanifest` (English, `start_url: /en/`) and `site.es.webmanifest` (Spanish, `start_url: /es/`), both `scope: /` with distinct `id`s and localised app `shortcuts` (Projects, Contact). `display: standalone`, `theme_color: #16c60c`, and `any` + `maskable` icons as 192/512 PNGs (what install prompts rely on) plus SVGs for browsers that take them; the shortcuts carry 96px PNGs too. Every raster icon is rendered from its SVG master, so all of them draw the same mark at the same scale.

---

## Build & deploy

The repository holds **sources only**. The build assembles the deployable site into `dist/` (gitignored, rebuilt from scratch every time), so a CSS or template change never touches a source page and git diffs show only real edits.

```bash
npm run build     # assemble dist/: pages with their build regions filled, hashed JS, inlined CSS, CSP hash, static files
npm run preview   # serve dist/ at http://localhost:8080/en/, the way Cloudflare Pages does
npm run check     # static checks on dist/ (and on the sources); any error exits 1
npm run deploy    # build + check (an error stops here) + sitemap.xml → miguelpv_dev.zip
```

Social cards are rendered separately, only when their copy changes: `npm run og-cards` (needs a local Chrome or Edge). After a CSS change around images, `npm run audit-sizes` (also Chrome/Edge, ~2 minutes) checks every responsive image's `sizes` against the layout the browser actually draws.

**The three build steps:**
1. **HTML** (`scripts/build-html.js`, `npm run build:html`): empties `dist/`, then writes every page listed in `data/site.js` into it with its build regions filled — the shared templates (`head`, `seo`, `header`, `footer`) and the project facts from `data/projects.js` — generates each responsive image's `sizes` from its `data-sizes` layout (`data/images.js`), copies the 404s (`en/404.html`, `es/404.html` and the root fallback), and copies the static files that ship. Its `STATIC` list is the deploy whitelist: `assets/img`, `assets/fonts`, `assets/pdf`, both webmanifests, `robots.txt`, `_headers`, `_redirects`. A new top-level asset directory must be added there. It fails if a page in `en/` or `es/` isn't listed in `site.js` or is missing a marker pair.
2. **JS** (`npm run build:js`): `scripts/build-js.js` concatenates `assets/js/partials/*.js` in filename order and minifies with terser (drop_console, mangle, a source map naming each partial) into `dist/assets/min/`, then `scripts/fingerprint-js.js` renames the bundle `main.<hash>.min.js` and points every built page at it.
3. **CSS** (`scripts/build-css.js`, `npm run build:css`): concatenates the partials in filename order, rewrites `@font-face` URLs to root-absolute (pages live at several depths), minifies with clean-css, writes a plain fallback before every `color-mix()` and `dvh` declaration (computed from the `:root` tokens, so browsers older than Chrome 111 / Firefox 113 / Safari 16.2 get the same colours instead of dropping them), **inlines the result into every built page**, and **writes the CSP `style-src` `sha256` into `dist/_headers`** so the hash always matches the exact bytes the browser sees.

In the sources, the build regions, the `<style id="inline-css">` block and the CSP hash are empty placeholders, and the script tag names the unhashed `main.min.js`.

**The checks** (`scripts/check.js`, run by every `npm run deploy` before anything is packaged): each built page is compared with its `site.js` entry — title, description, canonical, hreflang, Open Graph image and article dates (site.js, JSON-LD and the visible `<time>` must agree) — and scanned for broken local links, duplicate ids, heading jumps, images without alt, videos without poster/`preload="none"`/label, a slider's hidden slides that would download with the page, `_blank` links without `noopener`, invalid JSON-LD, stray microdata, and `srcset` width descriptors that don't match their files. `_redirects` must point at real pages, every page must carry the same inlined CSS and a hashed bundle, the CSP hash must match the CSS, and the source pages must stay free of generated content. Any error stops the deploy.

### First-time setup after cloning
```bash
npm install
npm run build
npm run preview
```

> ⚠️ The source pages don't render styled on their own — their CSS and shared regions only exist in `dist/`. Never edit `dist/`; change the sources and rebuild.

---

## Project structure

```
miguelpv.dev/
├── en/                              # English pages (source; hand-maintained)
│   ├── index.html
│   ├── projects.html
│   ├── projects/                    # one case study per project
│   │   ├── biglo.html  digitalando.html  portfolio.html
│   │   └── abogada-de-la-tierra.html  input-color-feedback.html
│   ├── blog.html
│   ├── blog/                        # one page per article
│   └── 404.html                     # served for unknown URLs under /en/
├── es/                              # Spanish pages (independent translations)
│   ├── index.html
│   ├── proyectos.html
│   ├── proyectos/                   # same set, localised slugs
│   ├── blog.html
│   ├── blog/
│   └── 404.html                     # served for unknown URLs under /es/
├── templates/                       # shared head block, SEO block, header, footer, social card
├── assets/
│   ├── css/partials/                # 01-tokens.css … 15-responsive.css
│   ├── js/partials/                 # 01-utils.js … 08-init.js, bundled into one script
│   ├── img/                         # favicons, manifest icons and the sprite at the root; hero/, about/,
│   │                                #   one folder per project, blog/, and og/ (every page's social card)
│   ├── fonts/                       # self-hosted JetBrains Mono woff2
│   └── pdf/                         # downloadable CVs (English, Castellano); each locale links its own and the other
├── cloudflare/worker.js             # root Accept-Language negotiation
├── data/                            # what you edit besides the pages themselves — no code
│   ├── site.js                      # every EN/ES page pair + its title, description, card, dates; the author
│   ├── projects.js                  # each project's role, years, category, status, tags, schema
│   └── images.js                    # the image layout table the generated `sizes` come from
├── scripts/
│   ├── site.js                      # data/site.js + build settings and helpers (every script imports this)
│   ├── jsonld.js                    # each page's JSON-LD graph, from data/site.js + data/projects.js
│   ├── images.js                    # data/images.js → generated `sizes`; image dimension reader
│   ├── build-html.js                # build step 1: assemble dist/ (pages + static files)
│   ├── build-js.js                  # build step 2: concat the JS partials → terser → dist/assets/min/
│   ├── fingerprint-js.js            # build step 2, cont.: content-hash the JS bundle, point every page at it
│   ├── build-css.js                 # build step 3: concat → minify → fallbacks → inline CSS → CSP hash
│   ├── check.js                     # pre-deploy checks
│   ├── preview.js                   # local server for dist/ (serve-dist.js does the serving)
│   ├── og-cards.js                  # render the 1200×630 social cards (run by hand)
│   ├── audit-sizes.js               # measure every image's sizes in a headless browser (run by hand)
│   ├── browser.js                   # find a local Chrome/Edge for the two scripts above
│   └── deploy.js                    # generate sitemap + zip dist/
├── dist/                            # build output — gitignored, rebuilt from scratch
├── _headers                         # security + cache headers (Cloudflare Pages); CSP hash filled in by the build
├── _redirects                       # 301s for renamed URLs
├── .well-known/security.txt         # where to report vulnerabilities (renew Expires yearly)
├── robots.txt
├── site.webmanifest                 # PWA manifest (English)
├── site.es.webmanifest              # PWA manifest (Spanish)
├── 404.html                         # English fallback for unknown URLs outside /en/ and /es/
└── package.json
```

---
## Author

**Miguel Payá Vañó** — Full-Stack Developer (Alcoy, Spain)

- 🌐 [miguelpv.dev](https://miguelpv.dev)
- 💼 [LinkedIn](https://linkedin.com/in/miguel-payá-vañó)
- 🐙 [GitHub @miguelpv26](https://github.com/miguelpv26)
- 📦 [npm ~miguelpv](https://www.npmjs.com/~miguelpv)
- ✉️ miguelpayav@gmail.com

## License

The **source code** is released under the [MIT License](LICENSE) — use it, learn from it, build on it. If it helps you, a mention is appreciated but never required.

The **personal content** — copy, images, project screenshots, CV and the "Miguel Payá Vañó" branding — is © Miguel Payá Vañó and is **not** covered by the MIT license. In short: take the code, not my face. 🙂
