/************************************************************
 * UTILITIES
 ************************************************************/

/**
 * Debounce function to limit how often a function can fire
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Safe initialization wrapper. Errors are dispatched to the global error
 * handler via the standard `reportError` Web API (window.onerror /
 * window.addEventListener('error')) so one broken feature doesn't abort the
 * rest of initApp(). The feature name is attached as Error.cause context.
 * @param {string} name - Feature name (surfaced in the reported error)
 * @param {Function} fn - Initialization function
 */
function safeInit(name, fn) {
  try {
    fn();
  } catch (error) {
    const wrapped = new Error(`safeInit("${name}") failed`, { cause: error });
    globalThis.reportError?.(wrapped);
  }
}

/**
 * Check if user prefers reduced motion
 * @returns {boolean}
 */
function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
