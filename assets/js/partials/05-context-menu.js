/************************************************************
 * FULL RESOLUTION IMAGE CONTEXT MENU
 ************************************************************/

/**
 * Open a same-origin file in a new tab, reporting whether a tab opened.
 * window.open() with the 'noopener' feature always returns null, opened or
 * blocked alike, so it's called plainly and the opener cut by hand instead.
 * @param {string} url
 * @returns {boolean}
 */
function openInNewTab(url) {
  try {
    const tab = window.open(url, '_blank');
    if (!tab) {
      console.warn('Popup blocked by browser');
      return false;
    }
    tab.opener = null;
    return true;
  } catch (err) {
    console.error('Failed to open file:', err);
    return false;
  }
}

function initContextMenuHandlers() {
  // Right-click opens the full-size file instead of the menu. When the tab is
  // blocked, the browser's own menu shows as usual.
  document.querySelectorAll('picture[data-fullres]').forEach(pic => {
    pic.addEventListener('contextmenu', (e) => {
      const url = pic.dataset.fullres;
      if (url && openInNewTab(url)) e.preventDefault();
    });
  });

  // --- FULL RESOLUTION VIDEO CONTEXT MENU ---
  document.addEventListener('contextmenu', (e) => {
    const video = e.target.closest('video[data-slide]');
    const videoSrc = video && video.getAttribute('src');
    if (videoSrc && openInNewTab(videoSrc)) e.preventDefault();
  });
}
