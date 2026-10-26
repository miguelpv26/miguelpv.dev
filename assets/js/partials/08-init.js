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
  safeInit('Project Filters', initProjectFilters);

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
