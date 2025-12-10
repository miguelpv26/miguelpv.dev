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
 * Safe DOM query selector with error handling
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Parent element (default: document)
 * @returns {HTMLElement|null} Found element or null
 */
function safeQuery(selector, parent = document) {
  try {
    return parent.querySelector(selector);
  } catch (err) {
    console.warn(`Invalid selector: ${selector}`, err);
    return null;
  }
}

/**
 * Safe initialization wrapper
 * @param {string} name - Feature name for logging
 * @param {Function} fn - Initialization function
 */
function safeInit(name, fn) {
  try {
    fn();
  } catch (error) {
    console.error(`Failed to initialize ${name}:`, error);
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
  const checkbox = safeQuery('#nav-toggle');
  const navLinks = document.querySelectorAll('.nav a');
  
  if (!checkbox) {
    console.warn('Mobile menu toggle not found');
    return;
  }

  // Prevent body scroll when menu is open
  checkbox.addEventListener('change', function () {
    document.body.style.overflow = this.checked ? 'hidden' : '';
    
    // Announce menu state to screen readers
    const menuState = this.checked ? 'opened' : 'closed';
    this.setAttribute('aria-label', `Navigation menu ${menuState}`);
  });

  // Close menu when clicking any nav link
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      checkbox.checked = false;
      document.body.style.overflow = '';
    });
  });

  // Close menu on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && checkbox.checked) {
      checkbox.checked = false;
      document.body.style.overflow = '';
      checkbox.focus(); // Return focus to toggle
    }
  });

  // Trap focus within menu when open
  const nav = safeQuery('.nav');
  if (nav) {
    document.addEventListener('keydown', (e) => {
      if (!checkbox.checked || e.key !== 'Tab') return;
      
      const focusableElements = nav.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])');
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      if (e.shiftKey && document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    });
  }
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

  const canvas = safeQuery('#matrix-canvas');
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
  let animationId = null;
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
    const elapsed = now - lastTime;
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

    animationId = requestAnimationFrame(draw);
  }

  // Debounced resize handler
  const debouncedResize = debounce(resize, 150);
  window.addEventListener('resize', debouncedResize);

  // Initialize and start animation
  resize();
  animationId = requestAnimationFrame(draw);

  // Cleanup function
  return () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    window.removeEventListener('resize', debouncedResize);
  };
}

/************************************************************
 * UNIVERSAL SLIDER SYSTEM
 ************************************************************/

/**
 * Creates an accessible, feature-rich slider
 * @param {HTMLElement} rootEl - Container element with [data-slider]
 * @returns {Object} Slider control object with destroy method
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
    isPaused: false,
    isDestroyed: false
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
    container.setAttribute('role', 'tablist');
    container.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 8px;
      z-index: 20;
    `;

    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'slider-dot';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', `Go to slide ${i + 1} of ${slides.length}`);
      dot.setAttribute('aria-controls', `slide-${i}`);
      dot.style.cssText = `
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.5);
        background: transparent;
        cursor: pointer;
        transition: all 0.2s ease-out;
        padding: 0;
      `;

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
      dot.style.background = isActive ? '#16c60c' : 'transparent';
      dot.style.borderColor = isActive ? '#16c60c' : 'rgba(255, 255, 255, 0.5)';
      dot.setAttribute('aria-selected', isActive);
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
        if (!state.isDestroyed && !state.isPaused) {
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
    if (state.isDestroyed) return;

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

    // Announce to screen readers
    liveRegion.textContent = `Slide ${index + 1} of ${slides.length}`;
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
    if (state.isDestroyed || state.isPaused) return;

    clearTimeout(state.autoTimeout);

    // Don't auto-advance if user prefers reduced motion
    if (prefersReducedMotion()) return;

    const currentSlide = slides[state.currentIndex];
    const duration = getSlideDuration(currentSlide);

    state.autoTimeout = setTimeout(() => {
      if (!state.isDestroyed && !state.isPaused) {
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
    rootEl.addEventListener('focusout', resume);
  }

  // Pause when page is hidden
  const handleVisibilityChange = () => {
    if (document.hidden) {
      pause();
    } else if (!state.isPaused) {
      resume();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Initialize
  slides.forEach((slide, i) => {
    slide.setAttribute('id', `slide-${i}`);
    slide.setAttribute('role', 'tabpanel');
  });

  show(state.currentIndex);
  startAutoTimer();

  // Return control object with public methods
  return {
    next,
    prev,
    goTo: show,
    pause,
    resume,
    destroy: () => {
      state.isDestroyed = true;
      stopAutoTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Pause all videos
      slides.forEach(slide => {
        if (isVideo(slide)) {
          slide.pause();
        }
      });
      
      // Remove added elements
      if (liveRegion && liveRegion.parentNode) {
        liveRegion.parentNode.removeChild(liveRegion);
      }
      if (indicators && indicators.parentNode) {
        indicators.parentNode.removeChild(indicators);
      }
    }
  };
}

/************************************************************
 * SLIDER INITIALIZATION
 ************************************************************/

function initSliders() {
  const sliders = [];
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
          const slider = createSlider(entry.target);
          if (slider) {
            sliders.push(slider);
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

  // Cleanup function
  return () => {
    observer.disconnect();
    sliders.forEach(slider => slider.destroy());
  };
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
      window.open(videoSrc, '_blank');
    }
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

/************************************************************
 * EXPORT FOR POTENTIAL MODULE USAGE
 ************************************************************/

// If you want to use this as a module in the future
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initMobileMenu,
    initMatrixEffect,
    createSlider,
    initSliders,
    initContextMenuHandlers,
    initApp
  };
}
