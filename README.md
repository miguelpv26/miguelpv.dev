# miguelpv.dev

**The personal portfolio of Miguel Payá Vañó — a Full-Stack Developer.**
Built by hand with plain **HTML, vanilla CSS and vanilla JavaScript**. No framework, no bundler, no runtime dependencies, no tracking. The only tooling is a minifier and a small Node deploy script.

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
| Behaviour | One vanilla JS file (`assets/js/main.js`), no modules, no deps |
| Fonts | JetBrains Mono (400/500/600), self-hosted `woff2`, latin subset |
| Build | `terser` (JS) + `clean-css` (CSS) + `archiver` (deploy zip) — that's the whole dependency list |
| Hosting | Cloudflare Pages (`_headers`) + one Cloudflare Worker for language routing |

There is **no dev server, no linter and no test runner** — that's a deliberate constraint, not a gap.

---

## Architecture

### Language routing
The site has no real "root" page. `cloudflare/worker.js` is the only thing that lives at `/`: it reads `Accept-Language`, looks **only at the highest-priority entry**, and `302`-redirects to `/es/` for Spanish and the regional languages of Spain (`es`, `ca`, `eu`, `gl`) or `/en/` otherwise. It redirects **bots and humans identically** (no User-Agent cloaking), marks the endpoint `X-Robots-Tag: noindex, nofollow`, sets `Vary: Accept-Language`, and repeats the core security headers because this is often the first response at the origin. Everything except `/` falls through to the static assets.

### Pages
`en/` and `es/` are **independent, hand-maintained translations** — not generated from a shared template at runtime. Each page carries its own `<head>` (title/description/canonical/hreflang/OG/Twitter) and its own JSON-LD `@graph`. The current page set, per locale:

- the homepage (`index.html`)
- a projects index (`projects.html` / `proyectos.html`)
- one case study per project (`biglo`, `digitalando`, `portfolio`, `abogada-de-la-tierra`, `input-color-feedback`)

Any user-facing copy, metadata or structured-data change is made in **both** locales in lock-step.

### Client JS (`assets/js/main.js`)
A single file. `initApp()` runs each feature inside a `safeInit(name, fn)` wrapper, so one broken feature can't abort the rest — errors are reported via the standard `reportError` API with the feature name attached as `Error.cause`. Every feature **degrades silently** if its root elements are absent. The features:

- **Mobile menu** — a button-driven drawer below `1276px` that manages `aria-expanded`/`aria-hidden`/`inert`, locks scroll on the real scroll container (`html`), traps and restores focus, and closes on ESC / overlay click / link activation.
- **Matrix background** — a canvas effect that **early-returns under `prefers-reduced-motion`**, clamps DPR to 2, and resets its timing on `visibilitychange`.
- **The carousel** — see the deep dive below.
- **Right-click → full-resolution** — see the deep dive below.
- **Project-card links** — makes each project card fully clickable while keeping the media's right-click behaviour intact (this is the clever bit that makes the two features coexist).

### Styles
Authored as ordered partials in `assets/css/partials/` (`01-tokens.css` … `14-responsive.css`) — **filename order is the cascade order**. Design tokens (spacing, colours, typography, radii, shadows, z-index scale) live in `:root` in `01-tokens.css`. BEM-ish class names. The mobile breakpoint (`1276px`) is duplicated in CSS and in `MOBILE_BREAKPOINT_PX` in the JS, and the two must change together.

---

## 🎠 The custom carousel (deep dive)

Every project/gallery uses one generic slider: any `[data-slider]` block with `[data-slide]` children and `[data-slide-prev]` / `[data-slide-next]` controls. It is **written from scratch, in ~300 lines, with no library**.

**What it does**
- **Lazy initialisation** via `IntersectionObserver` (`rootMargin: 50px`) — a slider costs nothing until it's about to enter the viewport.
- **Mixed media** — image *and* `<video>` slides in the same track. Video slides auto-advance the moment they fire `ended`, so a clip plays fully before the next slide, rather than being cut off by a fixed timer.
- **Per-slide timing** — `data-duration` (seconds, validated and clamped to 1–60; default 5s).
- **Auto-built dot indicators** with `aria-current`, roving `tabindex`, and `aria-controls` pointing at each slide's id.
- **Full keyboard support** — `←` / `→` / `Home` / `End`.
- **Screen-reader announcements** — a `role="status"` `aria-live="polite"` region announces *"Slide 2 of 5: <alt text>"*, **localised** from `<html lang>` (English on `/en/`, Spanish on `/es/`).
- **Pauses when it should** — on hover, on focus-within, and when the tab is hidden (`visibilitychange`), resuming only if the slider itself caused the pause.
- **Respects motion preferences** — under `prefers-reduced-motion` it never auto-advances; it becomes a purely manual, keyboard/click-driven gallery.

**Why not a slider library?** A third-party carousel would drag in its own CSS and JavaScript (often tens of KB), rarely gets ARIA and reduced-motion right out of the box, and almost never handles *"advance when this particular video finishes."* Rolling it by hand keeps the bundle tiny, keeps the accessibility behaviour under my control, and keeps the zero-dependency promise intact.

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
- `Permissions-Policy` denies accelerometer, camera, geolocation, gyroscope, magnetometer, microphone, payment, usb — and `interest-cohort=()` to opt out of FLoC
- Fonts are served `Cache-Control: public, max-age=31536000, immutable`

The Worker re-emits HSTS / `nosniff` / `Referrer-Policy` on the root redirect so the very first response at the origin is already hardened.

---

## 🔍 SEO

- Per-locale unique `<title>` and `<meta name="description">`.
- `canonical` + `hreflang` alternates for `en`, `es` and `x-default`, mutually consistent and matching the sitemap. The language-negotiation root is `noindex` and never a canonical target.
- **Open Graph** and **Twitter Card** tags, including dedicated **1200×630 social cards** per locale (`assets/img/og-image.png`, `assets/img/og-image.es.png`).
- **JSON-LD `@graph`** per page — `WebSite`, `WebPage`, `ImageObject`, `Person`, and `SoftwareApplication` / `SoftwareSourceCode` entities for the projects — kept consistent with the visible copy.
- `sitemap.xml` is **generated at deploy time** by `scripts/deploy.js` (one `<url>` per locale per page, with reciprocal `hreflang` alternates), and `robots.txt` allows crawling and points to it.

---

## ♿ Accessibility

Target: **WCAG 2.1 AA, zero axe issues.**

- Semantic landmarks, exactly one `<h1>` per page, no skipped heading levels.
- `:focus-visible` outlines on every interactive control; full keyboard operability (menu, carousel, dot indicators).
- Correct ARIA: `aria-expanded`/`aria-controls` on toggles, `aria-hidden` + `inert` on off-screen UI, `aria-current` on active nav/dots, `role="status"` + `aria-live="polite"` for carousel announcements, `aria-label` on icon-only controls, `aria-hidden` on decorative SVGs.
- **`prefers-reduced-motion`** neutralises the matrix canvas and the carousel's auto-advance.
- The mobile drawer implements scroll-lock, focus-trap and focus-restore.
- A `.sr-only` helper carries screen-reader-only text; text contrast meets AA.

---

## ⚡ Performance

- **Responsive images** via `<picture>`: AVIF → WebP → raster with `srcset` + `sizes` and multiple rendered widths. Every image/video has explicit dimensions → **CLS stays 0**. The LCP image is eager + `fetchpriority="high"`; everything below the fold is lazy.
- **Self-hosted fonts**, subset to latin, versioned filenames, cached `immutable` — no font CDN.
- **CSS is inlined into every page**, so there is **no render-blocking stylesheet request** at all (and the matching preload is dropped by the build). The external `style.min.css` ships only as an unreferenced fallback artifact.
- **`main.js` is deferred**; sliders and other expensive work are lazy-initialised via `IntersectionObserver`.

---

## 🔒 Privacy

This site does not watch you.

- **No analytics, no cookies, no trackers, no consent banners** — because there is nothing to consent to.
- **Zero third-party network requests.** The strict CSP (`default-src 'self'`) forbids them, and the site is built so it never needs one — fonts, images, styles and scripts are all first-party.
- Self-hosting the fonts means **no request to a font CDN**, so no visitor IP addresses leak to a third party just for typography.
- `Referrer-Policy: strict-origin-when-cross-origin` and `interest-cohort=()` (FLoC opt-out) round out the posture.

---

## 🎨 Design

A terminal / "matrix" aesthetic: near-black canvas (`#0d0d0d` / `#000`), a single terminal-green accent (`#16c60c`), and **JetBrains Mono** throughout. Design tokens in `:root` drive spacing, colour, type, radii, shadows and a z-index scale; components use BEM-ish naming. The falling-glyph canvas background nods to the theme without ever blocking content — and disappears entirely under reduced-motion. The social share cards reuse the same brand (green-on-dark, JetBrains Mono, corner glow).

---

## 📱 PWA

Each locale links its own manifest — `site.webmanifest` (English, `start_url: /en/`) and `site.es.webmanifest` (Spanish, `start_url: /es/`), both `scope: /` with distinct `id`s and localised app `shortcuts` (Projects, Contact). `display: standalone`, `theme_color: #16c60c`, and both `any` + `maskable` SVG icons.

---

## Build & deploy

Only two commands matter.

```bash
# JS: assets/js/main.js → assets/min/main.min.js (terser: drop_console, mangle, source map)
# CSS: concat partials → minify → INLINE into every page → sync the CSP style-src hash
npm run minify

# minify, then generate sitemap.xml and zip the deployable whitelist → miguelpv_dev.zip
npm run deploy
```

Single steps are available too: `npm run minify:js` and `npm run minify:css`.

**How the CSS build works** (`scripts/build-css.js`): it concatenates the partials in filename order, rewrites `@font-face` URLs to root-absolute (pages live at several depths), minifies with clean-css, writes `assets/min/style.min.css` as a fallback artifact, **inlines the result into the `<style id="inline-css">` block of every HTML page**, and then **recomputes the `sha256` in the CSP `style-src` in `_headers`** so the hash always matches the exact bytes the browser sees. It's idempotent and re-runnable.

**What ships** (`scripts/deploy.js` is the single source of truth): `en/`, `es/`, `assets/min/`, `assets/img/`, `assets/fonts/`, `assets/pdf/`, `site.webmanifest`, `site.es.webmanifest`, `robots.txt`, `_headers`, `404.html`, and the generated `sitemap.xml`. The unminified `assets/js/` and `assets/css/` sources are intentionally **not** shipped. If you add a new top-level asset directory or a new locale, add it to `deploy.js` or it won't reach production.

### First-time setup after cloning
`assets/min/*` and `sitemap.xml` are gitignored build artifacts. The inlined CSS is committed inside the HTML, so pages render styled straight from a clone — but you must build the JS once or the pages will 404 on their script:

```bash
npm install
npm run minify        # builds main.min.js and refreshes the inlined CSS
```

> ⚠️ Changes to `assets/js/main.js` or the CSS partials are **not visible until you re-run `npm run minify`** (which rebuilds the JS and re-inlines the CSS into every page). Never hand-edit `assets/min/*` or the inlined `<style id="inline-css">` blocks — they are generated.

### Preview locally
There is no dev server. Open `en/index.html` / `es/index.html` directly, or serve the project root with any static file server.

---

## Project structure

```
miguelpv.dev/
├── en/                              # English pages (hand-maintained)
│   ├── index.html
│   ├── projects.html
│   └── projects/                    # one case study per project
│       ├── biglo.html  digitalando.html  portfolio.html
│       ├── abogada-de-la-tierra.html  input-color-feedback.html
├── es/                              # Spanish pages (independent translations)
│   ├── index.html
│   ├── proyectos.html
│   └── proyectos/                   # same set, localised slugs
├── assets/
│   ├── css/partials/                # 01-tokens.css … 14-responsive.css  (source)
│   ├── js/main.js                   # single vanilla JS file             (source)
│   ├── min/                         # build output — gitignored
│   ├── img/                         # avif/webp/png, favicons, sprite, OG cards
│   ├── fonts/                       # self-hosted JetBrains Mono woff2
│   └── pdf/                         # downloadable CV
├── cloudflare/worker.js             # root Accept-Language negotiation
├── scripts/
│   ├── build-css.js                 # concat → minify → inline CSS → sync CSP hash
│   └── deploy.js                    # generate sitemap + zip the deployable set
├── _headers                         # security + cache headers (Cloudflare Pages)
├── robots.txt
├── site.webmanifest                 # PWA manifest (English)
├── site.es.webmanifest              # PWA manifest (Spanish)
├── 404.html
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
