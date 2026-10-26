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
