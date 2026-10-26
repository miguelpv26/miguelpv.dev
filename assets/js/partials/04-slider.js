/************************************************************
 * UNIVERSAL SLIDER SYSTEM
 ************************************************************/

// Active locale (from <html lang>), used for screen-reader announcement strings
// so the slider announces in the same language as the page it lives on.
const LOCALE = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();

const I18N = {
  en: {
    slideIndicators: 'Slide indicators',
    goToSlide: (i, n) => `Go to slide ${i} of ${n}`,
    slideOf: (i, n) => `Slide ${i} of ${n}`,
    slideOfLabeled: (i, n, label) => `Slide ${i} of ${n}: ${label}`,
    pauseSlides: 'Pause slideshow',
    playSlides: 'Play slideshow',
  },
  es: {
    slideIndicators: 'Indicadores de diapositiva',
    goToSlide: (i, n) => `Ir a la diapositiva ${i} de ${n}`,
    slideOf: (i, n) => `Diapositiva ${i} de ${n}`,
    slideOfLabeled: (i, n, label) => `Diapositiva ${i} de ${n}: ${label}`,
    pauseSlides: 'Pausar las diapositivas',
    playSlides: 'Reanudar las diapositivas',
  },
};
const STR = I18N[LOCALE] || I18N.en;

// Pages carry several sliders (the projects hub has five), so slide ids are
// namespaced per slider: slider-2-slide-0, not a page-wide duplicate slide-0.
let sliderCount = 0;

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

  const sliderId = `slider-${++sliderCount}`;
  // Keep an id the markup already gave a slide; otherwise mint a unique one.
  const slideIds = Array.from(slides, (slide, i) => slide.id || `${sliderId}-slide-${i}`);

  // State. isPaused is a temporary hold (hover, focus, hidden tab) that lifts
  // by itself; userPaused is the pause/play toggle, and only the toggle lifts
  // it. Reduced motion starts paused: nothing moves until the visitor asks.
  // offscreen is set while the slider is scrolled out of view.
  let state = {
    currentIndex: 0,
    autoTimeout: null,
    isPaused: false,
    userPaused: prefersReducedMotion(),
    offscreen: false
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

  // Pause/play toggle (WCAG 2.2.2) for anything that moves by itself: the
  // auto-advance, or a looping video.
  const TOGGLE_ICON = { pause: 'M4 3h3v10H4zM9 3h3v10H9z', play: 'M5 2.5v11L13.5 8z' };
  const toggleBtn = slides.length > 1 || Array.from(slides).some(isVideo) ? createToggle() : null;

  // Create slide indicators (dots)
  const indicators = createIndicators();

  // The toggle and the dots share one centred row at the bottom, so they can't
  // collide however many dots there are. It goes ahead of the arrows: the
  // toggle comes first in the slider's tab order, as the APG carousel asks.
  if (toggleBtn || indicators) {
    const controls = document.createElement('div');
    controls.className = 'slider-controls';
    if (toggleBtn) controls.appendChild(toggleBtn);
    if (indicators) controls.appendChild(indicators);
    prevBtn.before(controls);
  }

  /**
   * Create the pause/play button (its label and icon are set by updateToggle)
   */
  function createToggle() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slider-toggle';

    // Built node by node: the CSP's Trusted Types rule out an innerHTML string.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'path'));
    btn.appendChild(svg);

    btn.addEventListener('click', () => setUserPaused(!state.userPaused));
    return btn;
  }

  /**
   * Label the toggle with what it will do next, as the APG pattern does
   */
  function updateToggle() {
    if (!toggleBtn) return;
    toggleBtn.setAttribute('aria-label', state.userPaused ? STR.playSlides : STR.pauseSlides);
    toggleBtn.querySelector('path').setAttribute('d', state.userPaused ? TOGGLE_ICON.play : TOGGLE_ICON.pause);
  }

  /**
   * Pause or play the slideshow from the toggle: the timer and the shown video
   */
  function setUserPaused(paused) {
    state.userPaused = paused;
    updateToggle();

    const activeSlide = slides[state.currentIndex];
    if (paused) {
      stopAutoTimer();
      if (isVideo(activeSlide)) activeSlide.pause();
    } else {
      // Play means now, even with the pointer or focus still on the slider.
      state.isPaused = false;
      if (isVideo(activeSlide)) playVideo(activeSlide);
      startAutoTimer();
    }
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
      dot.setAttribute('aria-controls', slideIds[i]);

      dot.addEventListener('click', () => {
        show(i, true);
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
   * Play a video slide from where it is
   */
  function playVideo(video) {
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.info('Video autoplay blocked (expected behavior):', err.message);
      });
    }
  }

  /**
   * Handle video playback. Video slides loop, so they never fire `ended`: how
   * long one stays up is its data-duration, like any other slide. They ship
   * preload="none" with a poster (a hidden one as data-poster, set when the
   * slider starts), so a clip only downloads once it's shown.
   */
  function handleVideo(slide, shouldPlay) {
    if (!isVideo(slide)) return;

    if (shouldPlay) {
      slide.currentTime = 0;
      playVideo(slide);
    } else {
      slide.pause();
    }
  }

  /**
   * Show specific slide. announce is for changes the visitor made (arrows,
   * dots, keys): the auto-advance stays silent, or a screen reader would be
   * interrupted every few seconds, and so does the first slide on start.
   */
  function show(index, announce = false) {
    // Validate index
    if (index < 0 || index >= slides.length) {
      console.warn(`Invalid slide index: ${index}`);
      return;
    }

    slides.forEach((slide, i) => {
      const isActive = i === index;
      slide.classList.toggle('active', isActive);
      slide.setAttribute('aria-hidden', !isActive);
      
      // Handle video playback (a paused slideshow shows a video's poster or
      // last frame, and plays nothing)
      handleVideo(slide, isActive && !state.userPaused);
    });

    state.currentIndex = index;
    updateIndicators();

    // Announce to screen readers, including the slide description if available.
    // Otherwise the region is emptied, so returning to the slide last announced
    // is still a change a screen reader reads out.
    const activeSlide = slides[index];
    const slideLabel = activeSlide.getAttribute('alt') || activeSlide.getAttribute('aria-label') || '';
    if (!announce) liveRegion.textContent = '';
    else liveRegion.textContent = slideLabel
      ? STR.slideOfLabeled(index + 1, slides.length, slideLabel)
      : STR.slideOf(index + 1, slides.length);
  }

  /**
   * Go to next slide
   */
  function next(announce = false) {
    const nextIndex = (state.currentIndex + 1) % slides.length;
    show(nextIndex, announce);
  }

  /**
   * Go to previous slide
   */
  function prev(announce = false) {
    const prevIndex = (state.currentIndex - 1 + slides.length) % slides.length;
    show(prevIndex, announce);
  }

  /**
   * Start auto-advance timer
   */
  function startAutoTimer() {
    if (state.isPaused || state.offscreen) return;

    clearTimeout(state.autoTimeout);

    // Paused from the toggle (which reduced motion starts in)
    if (state.userPaused) return;

    const currentSlide = slides[state.currentIndex];
    const duration = getSlideDuration(currentSlide);

    state.autoTimeout = setTimeout(() => {
      if (!state.isPaused && !state.offscreen) {
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
    next(true);
    resetTimer();
  });

  prevBtn.addEventListener('click', () => {
    prev(true);
    resetTimer();
  });

  // Keyboard navigation
  if (CONFIG.keyboardNav) {
    rootEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev(true);
        resetTimer();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next(true);
        resetTimer();
      } else if (e.key === 'Home') {
        e.preventDefault();
        show(0, true);
        resetTimer();
      } else if (e.key === 'End') {
        e.preventDefault();
        show(slides.length - 1, true);
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

  // Hold while scrolled out of view: nobody is watching, so it shouldn't
  // advance or play (and download) a video. A flag of its own rather than
  // isPaused, so a stray mouseleave or focusout can't restart it off-screen,
  // and coming back can't lift a hover, focus or toggle pause.
  new IntersectionObserver(([entry]) => {
    state.offscreen = !entry.isIntersecting;
    const activeSlide = slides[state.currentIndex];
    if (state.offscreen) {
      stopAutoTimer();
      if (isVideo(activeSlide)) activeSlide.pause();
    } else {
      if (isVideo(activeSlide) && !state.userPaused) playVideo(activeSlide);
      startAutoTimer();
    }
  }).observe(rootEl);

  // Initialize
  slides.forEach((slide, i) => {
    slide.id = slideIds[i];
    // A hidden video slide ships its poster as data-poster so it doesn't
    // download with the page; the slider is starting, so it's needed now.
    if (slide.dataset.poster) slide.setAttribute('poster', slide.dataset.poster);
  });

  show(state.currentIndex);
  updateToggle();
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
