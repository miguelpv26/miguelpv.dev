/************************************************************
 * MOBILE MENU
 ************************************************************/

// Viewport width at which the mobile nav drawer kicks in.
// MUST stay in sync with the @media (max-width: 1276px) block in
// assets/css/partials/15-responsive.css.
const MOBILE_BREAKPOINT_PX = 1276;

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

  // Everything on the page except the header (skip link, main, footer…). While
  // the drawer is open these go inert, so Tab cycles through the header — the
  // logo, the toggle and the drawer's links — instead of wandering into the
  // page hidden behind the overlay.
  const header = toggleButton.closest('header') || nav.closest('header');
  const outsideHeader = () => Array.from(document.body.children).filter(el => el !== header && el.tagName !== 'SCRIPT');

  function isOpen() {
    return document.body.classList.contains('nav-open');
  }

  function lockScroll(lock) {
    // html is the scroll container here (03-base.css sets overflow-x: hidden on
    // html, which makes the viewport scroll from html, not body), so lock html.
    document.documentElement.style.overflow = lock ? 'hidden' : '';
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  function trapFocus(trap) {
    if (!header) return;
    outsideHeader().forEach(el => { el.inert = trap; });
  }

  function openMenu() {
    if (isOpen()) return;

    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    document.body.classList.add('nav-open');
    lockScroll(true);
    trapFocus(true);

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
    trapFocus(false);

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
