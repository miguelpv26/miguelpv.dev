// Cloudflare Worker for miguelpv.dev
// Root-language redirect based on Accept-Language (no UA cloaking)

const SPANISH_PREFIXES = ['es', 'ca', 'eu', 'gl']; // Spanish, Catalan/Valencian, Basque, Galician

/**
 * Decide whether Spanish (or a regional language of Spain) should be preferred,
 * based on the user's highest-priority language. The Accept-Language header is
 * ordered by preference (e.g. "es-ES,es;q=0.9,en;q=0.8"), so we only look at
 * the first entry — anything after it is by definition a lower-priority fallback.
 *
 * @param {string} acceptLanguage
 * @returns {boolean}
 */
function prefersSpanishOrRegional(acceptLanguage) {
  const primary = (acceptLanguage || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .split(';')[0];

  return SPANISH_PREFIXES.some(prefix => primary.startsWith(prefix));
}

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleRequest(request) {
  const url = new URL(request.url);

  // Only apply special logic to the root path
  if (url.pathname !== '/') {
    return fetch(request);
  }

  const acceptLang = request.headers.get('Accept-Language') || '';
  const redirectPath = prefersSpanishOrRegional(acceptLang) ? '/es/' : '/en/';

  // Root is just a negotiation endpoint; we don't want it indexed.
  // Redirect everyone (bots + humans) to avoid UA-based content differences.
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${url.origin}${redirectPath}`,

      // Prevent indexing of the language-negotiation endpoint.
      'X-Robots-Tag': 'noindex, nofollow',

      // Make caches behave correctly per Accept-Language value.
      Vary: 'Accept-Language',

      // Revalidate every time at the browser; shared caches may serve for 1 hour.
      'Cache-Control': 'public, max-age=0, s-maxage=3600',

      // Security headers — the static pages get these from `_headers`, but this
      // redirect is generated here and is often the first response at the root.
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}

export default {
  fetch: handleRequest,
};
