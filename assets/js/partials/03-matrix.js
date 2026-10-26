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
