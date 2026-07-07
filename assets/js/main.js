/************************************************************
 * CONSTANTS
 ************************************************************/

// Viewport width at which the mobile nav drawer kicks in.
// MUST stay in sync with the @media (max-width: 1276px) block in style.css.
const MOBILE_BREAKPOINT_PX = 1276;

// Active locale (from <html lang>), used for screen-reader announcement strings
// so the slider announces in the same language as the page it lives on.
const LOCALE = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();

const I18N = {
  en: {
    slideIndicators: 'Slide indicators',
    goToSlide: (i, n) => `Go to slide ${i} of ${n}`,
    slideOf: (i, n) => `Slide ${i} of ${n}`,
    slideOfLabeled: (i, n, label) => `Slide ${i} of ${n}: ${label}`,
  },
  es: {
    slideIndicators: 'Indicadores de diapositiva',
    goToSlide: (i, n) => `Ir a la diapositiva ${i} de ${n}`,
    slideOf: (i, n) => `Diapositiva ${i} de ${n}`,
    slideOfLabeled: (i, n, label) => `Diapositiva ${i} de ${n}: ${label}`,
  },
};
const STR = I18N[LOCALE] || I18N.en;

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

/************************************************************
 * MOBILE MENU
 ************************************************************/

function initMobileMenu() {
  // Button-driven mobile menu (accessible, consistent across locales).
  const toggleButton = document.querySelector('#nav-toggle');
  const nav = document.querySelector('[data-nav]');
  let overlay = document.querySelector('[data-nav-overlay]');

  if (!toggleButton || !(toggleButton instanceof HTMLButtonElement) || !nav) {
    return;
  }

  // Ensure nav has an id for aria-controls.
  if (!nav.id) nav.id = 'site-nav';
  toggleButton.setAttribute('aria-controls', nav.id);

  // Create overlay if missing.
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    overlay.setAttribute('data-nav-overlay', '');
    overlay.hidden = true;

    const headerContent = toggleButton.closest('.header__content') || document.querySelector('.header__content');
    if (headerContent) {
      headerContent.appendChild(overlay);
    } else {
      document.body.appendChild(overlay);
    }
  }

  const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);

  // Initial ARIA state — nav is only hidden from AT on mobile when closed.
  if (!toggleButton.hasAttribute('aria-expanded')) toggleButton.setAttribute('aria-expanded', 'false');
  nav.setAttribute('aria-hidden', mq.matches ? 'true' : 'false');
  // inert keeps the off-screen drawer out of the tab order (and the a11y tree)
  // when it's hidden on mobile. On desktop the nav is always interactive.
  nav.inert = mq.matches;

  let lastFocusedElement = null;

  function isOpen() {
    return document.body.classList.contains('nav-open');
  }

  function lockScroll(lock) {
    // html is the scroll container here (style.css sets overflow-x: hidden on
    // html, which makes the viewport scroll from html, not body), so lock html.
    document.documentElement.style.overflow = lock ? 'hidden' : '';
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  function openMenu() {
    if (isOpen()) return;

    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    document.body.classList.add('nav-open');
    lockScroll(true);

    toggleButton.setAttribute('aria-expanded', 'true');
    nav.setAttribute('aria-hidden', 'false');
    nav.inert = false;
    overlay.hidden = false;

    const firstLink = nav.querySelector('a');
    if (firstLink) firstLink.focus();
  }

  function closeMenu({ restoreFocus = true } = {}) {
    if (!isOpen()) return;

    document.body.classList.remove('nav-open');
    lockScroll(false);

    toggleButton.setAttribute('aria-expanded', 'false');
    nav.setAttribute('aria-hidden', mq.matches ? 'true' : 'false');
    nav.inert = mq.matches;
    overlay.hidden = true;

    if (restoreFocus && lastFocusedElement) lastFocusedElement.focus();
  }

  toggleButton.addEventListener('click', () => {
    if (isOpen()) closeMenu({ restoreFocus: true });
    else openMenu();
  });

  overlay.addEventListener('click', () => closeMenu({ restoreFocus: true }));

  // Close menu when a nav link is activated.
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => closeMenu({ restoreFocus: false }));
  });

  // ESC closes.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      closeMenu({ restoreFocus: true });
    }
  });

  // If viewport grows beyond mobile breakpoint, close and restore nav visibility.
  window.addEventListener('resize', debounce(() => {
    if (!mq.matches) {
      // Desktop: nav is always visible and interactive.
      if (isOpen()) {
        closeMenu({ restoreFocus: false });
      } else {
        nav.setAttribute('aria-hidden', 'false');
        nav.inert = false;
      }
    } else if (!isOpen()) {
      // Shrunk into mobile while closed: take the drawer out of the tab order.
      nav.setAttribute('aria-hidden', 'true');
      nav.inert = true;
    }
  }, 150));
}

/************************************************************
 * MATRIX BACKGROUND EFFECT
 ************************************************************/

function initMatrixEffect() {
  // Respect user's motion preferences
  if (prefersReducedMotion()) {
    console.info('Matrix effect disabled: user prefers reduced motion');
    return;
  }

  const canvas = document.querySelector('#matrix-canvas');
  if (!canvas) {
    console.warn('Matrix canvas not found');
    return;
  }

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    console.error('Failed to get canvas context');
    return;
  }

  // Configuration
  const CONFIG = {
    chars: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*()[]{}<>?/\\|~^+=-',
    charSize: 18,
    speed: 1,
    fadeSpeed: 0.25,
    textColor: '#1bff0f2e',
    bgColor: '#0d0d0d',
    maxDPR: 2,
  };

  const arr = Array.from(CONFIG.chars);
  let columns = [];
  let isInitialized = false;
  
  // Store viewport dimensions separately
  let viewportWidth = 0;
  let viewportHeight = 0;

  /**
   * Resize and reinitialize canvas
   */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDPR);
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;

    // Set canvas buffer size (with DPR for sharp rendering)
    canvas.width = Math.floor(viewportWidth * dpr);
    canvas.height = Math.floor(viewportHeight * dpr);
    
    // Set canvas display size (CSS pixels)
    canvas.style.width = viewportWidth + 'px';
    canvas.style.height = viewportHeight + 'px';
    
    // Reset transform and scale context
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // Calculate columns based on viewport width
    const cols = Math.floor(viewportWidth / CONFIG.charSize) + 1; // +1 to cover edge case
    columns = new Array(cols)
      .fill(0)
      .map(() => Math.floor(Math.random() * viewportHeight / CONFIG.charSize));

    isInitialized = false;
  }

  let lastTime = performance.now();

  /**
   * Animation loop
   */
  function draw(now) {
    const elapsed = Math.min(now - lastTime, 100);
    lastTime = now;

    // Use stored viewport dimensions (not canvas buffer dimensions)
    const width = viewportWidth;
    const height = viewportHeight;

    // Draw solid base on first frame
    if (!isInitialized) {
      ctx.fillStyle = CONFIG.bgColor;
      ctx.fillRect(0, 0, width, height);
      isInitialized = true;
    }

    // Create trailing fade effect
    ctx.fillStyle = `rgba(13, 13, 13, ${CONFIG.fadeSpeed})`;
    ctx.fillRect(0, 0, width, height);

    // Configure text rendering
    ctx.font = `${CONFIG.charSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = CONFIG.textColor;

    // Draw characters
    for (let i = 0; i < columns.length; i++) {
      const x = i * CONFIG.charSize + CONFIG.charSize / 2;
      const y = columns[i] * CONFIG.charSize + CONFIG.charSize / 2;

      const char = arr[Math.floor(Math.random() * arr.length)];
      ctx.fillText(char, x, y);

      // Move column down
      columns[i] += CONFIG.speed * (elapsed / 50);
      
      // Reset column when it goes off screen
      if (columns[i] * CONFIG.charSize > height + CONFIG.charSize) {
        columns[i] = 0;
      }
    }

    requestAnimationFrame(draw);
  }

  // Reset lastTime on tab return to prevent huge elapsed jump
  const handleMatrixVisibility = () => {
    if (!document.hidden) lastTime = performance.now();
  };
  document.addEventListener('visibilitychange', handleMatrixVisibility);

  // Debounced resize handler
  const debouncedResize = debounce(resize, 150);
  window.addEventListener('resize', debouncedResize);

  // Initialize and start animation
  requestAnimationFrame(() => { resize(); requestAnimationFrame(draw); });
}

/************************************************************
 * UNIVERSAL SLIDER SYSTEM
 ************************************************************/

/**
 * Creates an accessible, feature-rich slider
 * @param {HTMLElement} rootEl - Container element with [data-slider]
 * @returns {boolean|null} true once initialized, null if required elements are missing
 */
function createSlider(rootEl) {
  if (!rootEl) return null;

  const slides = rootEl.querySelectorAll('[data-slide]');
  const prevBtn = rootEl.querySelector('[data-slide-prev]');
  const nextBtn = rootEl.querySelector('[data-slide-next]');

  if (!slides.length || !prevBtn || !nextBtn) {
    console.warn('Slider missing required elements', rootEl);
    return null;
  }

  // Configuration
  const CONFIG = {
    defaultDuration: 5000,
    minDuration: 1000,
    maxDuration: 60000,
    pauseOnHover: true,
    pauseOnFocus: true,
    keyboardNav: true
  };

  // State
  let state = {
    currentIndex: 0,
    autoTimeout: null,
    isPaused: false
  };

  // Create ARIA live region for screen reader announcements
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.classList.add('sr-only');
  liveRegion.style.position = 'absolute';
  liveRegion.style.left = '-10000px';
  liveRegion.style.width = '1px';
  liveRegion.style.height = '1px';
  liveRegion.style.overflow = 'hidden';
  rootEl.appendChild(liveRegion);

  // Create slide indicators (dots)
  const indicators = createIndicators();
  if (indicators) {
    rootEl.appendChild(indicators);
  }

  /**
   * Create dot indicators for slides
   */
  function createIndicators() {
    if (slides.length <= 1) return null;

    const container = document.createElement('div');
    container.className = 'slider-indicators';
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', STR.slideIndicators);

    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'slider-dot';
      dot.setAttribute('aria-label', STR.goToSlide(i + 1, slides.length));
      dot.setAttribute('aria-controls', `slide-${i}`);

      dot.addEventListener('click', () => {
        show(i);
        resetTimer();
      });

      container.appendChild(dot);
    });

    return container;
  }

  /**
   * Update indicator dots
   */
  function updateIndicators() {
    if (!indicators) return;

    const dots = indicators.querySelectorAll('.slider-dot');
    dots.forEach((dot, i) => {
      const isActive = i === state.currentIndex;
      dot.classList.toggle('active', isActive);
      if (isActive) {
        dot.setAttribute('aria-current', 'true');
      } else {
        dot.removeAttribute('aria-current');
      }
      dot.setAttribute('tabindex', isActive ? '0' : '-1');
    });
  }

  /**
   * Check if element is a video
   */
  function isVideo(element) {
    return element && element.tagName === 'VIDEO';
  }

  /**
   * Get validated duration for a slide
   */
  function getSlideDuration(slide) {
    const customDuration = slide.getAttribute('data-duration');
    
    if (customDuration) {
      const duration = parseFloat(customDuration) * 1000;
      
      if (isNaN(duration) || duration < CONFIG.minDuration || duration > CONFIG.maxDuration) {
        console.warn(`Invalid duration "${customDuration}" for slide, using default`);
        return CONFIG.defaultDuration;
      }
      
      return duration;
    }

    return CONFIG.defaultDuration;
  }

  /**
   * Handle video playback
   */
  function handleVideo(slide, shouldPlay) {
    if (!isVideo(slide)) return;

    if (shouldPlay) {
      slide.currentTime = 0;
      
      // Handle video end event
      const onEnded = () => {
        if (!state.isPaused) {
          next();
          startAutoTimer();
        }
      };
      
      slide.addEventListener('ended', onEnded, { once: true });
      
      // Attempt to play
      const playPromise = slide.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.info('Video autoplay blocked (expected behavior):', err.message);
        });
      }
    } else {
      slide.pause();
    }
  }

  /**
   * Show specific slide
   */
  function show(index) {
    // Validate index
    if (index < 0 || index >= slides.length) {
      console.warn(`Invalid slide index: ${index}`);
      return;
    }

    slides.forEach((slide, i) => {
      const isActive = i === index;
      slide.classList.toggle('active', isActive);
      slide.setAttribute('aria-hidden', !isActive);
      
      // Handle video playback
      handleVideo(slide, isActive);
    });

    state.currentIndex = index;
    updateIndicators();

    // Announce to screen readers, including the slide description if available
    const activeSlide = slides[index];
    const slideLabel = activeSlide.getAttribute('alt') || activeSlide.getAttribute('aria-label') || '';
    liveRegion.textContent = slideLabel
      ? STR.slideOfLabeled(index + 1, slides.length, slideLabel)
      : STR.slideOf(index + 1, slides.length);
  }

  /**
   * Go to next slide
   */
  function next() {
    const nextIndex = (state.currentIndex + 1) % slides.length;
    show(nextIndex);
  }

  /**
   * Go to previous slide
   */
  function prev() {
    const prevIndex = (state.currentIndex - 1 + slides.length) % slides.length;
    show(prevIndex);
  }

  /**
   * Start auto-advance timer
   */
  function startAutoTimer() {
    if (state.isPaused) return;

    clearTimeout(state.autoTimeout);

    // Don't auto-advance if user prefers reduced motion
    if (prefersReducedMotion()) return;

    const currentSlide = slides[state.currentIndex];
    const duration = getSlideDuration(currentSlide);

    state.autoTimeout = setTimeout(() => {
      if (!state.isPaused) {
        next();
        startAutoTimer();
      }
    }, duration);
  }

  /**
   * Stop auto-advance timer
   */
  function stopAutoTimer() {
    clearTimeout(state.autoTimeout);
    state.autoTimeout = null;
  }

  /**
   * Reset timer (after manual interaction)
   */
  function resetTimer() {
    stopAutoTimer();
    startAutoTimer();
  }

  /**
   * Pause slider
   */
  function pause() {
    state.isPaused = true;
    stopAutoTimer();
  }

  /**
   * Resume slider
   */
  function resume() {
    state.isPaused = false;
    startAutoTimer();
  }

  // Button event listeners
  nextBtn.addEventListener('click', () => {
    next();
    resetTimer();
  });

  prevBtn.addEventListener('click', () => {
    prev();
    resetTimer();
  });

  // Keyboard navigation
  if (CONFIG.keyboardNav) {
    rootEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
        resetTimer();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
        resetTimer();
      } else if (e.key === 'Home') {
        e.preventDefault();
        show(0);
        resetTimer();
      } else if (e.key === 'End') {
        e.preventDefault();
        show(slides.length - 1);
        resetTimer();
      }
    });
  }

  // Pause on hover
  if (CONFIG.pauseOnHover) {
    rootEl.addEventListener('mouseenter', pause);
    rootEl.addEventListener('mouseleave', resume);
  }

  // Pause when focused (for accessibility)
  if (CONFIG.pauseOnFocus) {
    rootEl.addEventListener('focusin', pause);
    rootEl.addEventListener('focusout', (e) => {
      if (!rootEl.contains(e.relatedTarget)) resume();
    });
  }

  // Pause when page is hidden; only resume if we caused the pause.
  let hiddenPaused = false;
  const handleVisibilityChange = () => {
    if (document.hidden) {
      if (!state.isPaused) {
        hiddenPaused = true;
        pause();
      }
    } else if (hiddenPaused) {
      hiddenPaused = false;
      resume();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Initialize
  slides.forEach((slide, i) => {
    slide.setAttribute('id', `slide-${i}`);
  });

  show(state.currentIndex);
  startAutoTimer();

  return true; // signal successful initialization to initSliders()
}

/************************************************************
 * SLIDER INITIALIZATION
 ************************************************************/

function initSliders() {
  const sliderElements = document.querySelectorAll('[data-slider]');

  if (!sliderElements.length) {
    console.info('No sliders found on page');
    return;
  }

  // Use Intersection Observer for lazy initialization
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.dataset.sliderInitialized) {
          if (createSlider(entry.target)) {
            entry.target.dataset.sliderInitialized = 'true';
          }
        }
      });
    },
    {
      rootMargin: '50px' // Start loading slightly before entering viewport
    }
  );

  sliderElements.forEach(element => {
    observer.observe(element);
  });
}

/************************************************************
 * FULL RESOLUTION IMAGE CONTEXT MENU
 ************************************************************/

function initContextMenuHandlers() {
  const pictures = document.querySelectorAll('picture[data-fullres]');

  if (!pictures.length) return;

  pictures.forEach(pic => {
    pic.addEventListener('contextmenu', (e) => {
      const url = pic.dataset.fullres;
      
      if (!url) return;

      try {
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        
        if (opened) {
          e.preventDefault();
        } else {
          console.warn('Popup blocked by browser');
        }
      } catch (err) {
        console.error('Failed to open image:', err);
      }
    });
  });

    // --- FULL RESOLUTION VIDEO CONTEXT MENU ---
  document.addEventListener('contextmenu', (e) => {
    const video = e.target.closest('video[data-slide]');
    if (!video) return;

    e.preventDefault();
    e.stopPropagation();

    const videoSrc = video.getAttribute('src');

    if (videoSrc) {
      window.open(videoSrc, '_blank', 'noopener,noreferrer');
    }
  });
}

/************************************************************
 * PROJECT CARD LINKS (dedicated projects page)
 ************************************************************/

/**
 * Lets a project card's media thumbnail share the card's link target.
 * The card body already navigates natively through a stretched <a> overlay
 * (.project-card__link), but the media sits ABOVE that overlay so its
 * right-click "open full-resolution" handler keeps working — which means the
 * thumbnail's left-click has to be wired up here. Cards without a link
 * (e.g. discontinued projects) are skipped, degrading to a plain card.
 */
function initProjectCardLinks() {
  const cards = document.querySelectorAll('.project-card');

  if (!cards.length) return;

  cards.forEach(card => {
    const link = card.querySelector('.project-card__link');
    const thumb = card.querySelector('.project-thumb');
    if (!link || !thumb) return;

    const href = link.getAttribute('href');
    if (!href) return;

    thumb.addEventListener('click', (e) => {
      // Leave the slider controls (arrows/dots are <button>s) and any real
      // link inside the thumbnail alone.
      if (e.target.closest('a, button')) return;

      // Mirror native anchor behaviour: a modifier-click opens a new tab,
      // a plain click follows the link in the same tab.
      if (e.ctrlKey || e.metaKey) {
        window.open(href, '_blank', 'noopener');
      } else {
        window.location.href = href;
      }
    });
  });
}

/************************************************************
 * APPLICATION INITIALIZATION
 ************************************************************/

/**
 * Initialize all application features
 */
function initApp() {
  console.info('Initializing portfolio application...');

  safeInit('Mobile Menu', initMobileMenu);
  safeInit('Matrix Effect', initMatrixEffect);
  safeInit('Sliders', initSliders);
  safeInit('Context Menu Handlers', initContextMenuHandlers);
  safeInit('Project Card Links', initProjectCardLinks);

  console.info('Portfolio application initialized successfully');
}

/**
 * Wait for DOM to be ready before initializing
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // DOM is already ready
  initApp();
}

