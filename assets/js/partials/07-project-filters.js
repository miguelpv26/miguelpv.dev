/************************************************************
 * PROJECT FILTERS (dedicated projects page)
 ************************************************************/

/**
 * Search / tag-filter / date-sort controls for the projects hub.
 *
 * The markup ships every card visible and the toolbar `hidden`, so a JS-less
 * visitor still gets the complete list rather than dead controls. All the
 * user-facing strings live in `data-` attributes on the markup, which keeps the
 * two locales' copy in their own HTML files instead of in an I18N table here.
 *
 * A tag is any token in a card's `data-tags`: the category (`product`,
 * `client`, `open-source`) and every tech tag. Toolbar chips and the tags
 * printed inside the cards are the same control, so pressing either one filters
 * the list and both light up. The active tag and query are mirrored into the
 * query string so a filtered view can be linked to.
 */
function initProjectFilters() {
  const root = document.querySelector('[data-project-filters]');
  if (!root) return;

  const toolbar = root.querySelector('[data-project-toolbar]');
  const grid = root.querySelector('.projects-grid');
  const searchInput = root.querySelector('[data-project-search]');
  const clearButton = root.querySelector('[data-search-clear]');
  const sortButton = root.querySelector('[data-project-sort]');
  const sortLabel = root.querySelector('[data-sort-label]');
  const status = root.querySelector('[data-project-status]');
  const empty = root.querySelector('[data-project-empty]');
  const cards = Array.from(root.querySelectorAll('.project-card'));

  if (!toolbar || !grid || !searchInput || !sortButton || !status || !cards.length) {
    console.warn('Project filters: markup incomplete, leaving the list unfiltered');
    return;
  }

  // Everything a card can be matched on, flattened once: its tags plus all of
  // its visible copy (title, role, year, description, tag labels).
  const haystacks = new Map(
    cards.map(card => [card, `${card.dataset.tags || ''} ${card.textContent}`.replace(/\s+/g, ' ').toLowerCase()])
  );
  // Projects are ranked by last activity, not by launch date: a 2025 project
  // still being worked on today outranks one that shipped and went quiet.
  const updated = new Map(cards.map(card => [card, Number(card.dataset.updated) || 0]));
  // Within one year, the ones still moving come first.
  const ongoing = new Map(cards.map(card => [card, card.hasAttribute('data-ongoing') ? 1 : 0]));
  // Authored position, so projects that tie on both break it in a fixed order —
  // and flipping the sort mirrors the list exactly.
  const authored = new Map(cards.map((card, index) => [card, index]));
  const tagsOf = card => (card.dataset.tags || '').split(' ').filter(Boolean);

  let activeTag = 'all';
  let query = '';
  let sort = sortButton.dataset.sort === 'asc' ? 'asc' : 'desc';

  /** Every control bound to a tag: toolbar chips and in-card tag buttons. */
  const tagControls = () => Array.from(root.querySelectorAll('[data-tag]'));

  const knownTag = tag => tag === 'all' || cards.some(card => tagsOf(card).includes(tag));

  function render() {
    const needle = query.trim().toLowerCase();
    const visible = [];

    cards.forEach(card => {
      const matchesTag = activeTag === 'all' || tagsOf(card).includes(activeTag);
      const matchesQuery = !needle || haystacks.get(card).includes(needle);
      const show = matchesTag && matchesQuery;

      card.hidden = !show;
      if (show) visible.push(card);
    });

    // render() reorders the DOM, so a plain stable sort would let the previous
    // pass decide this one's ties. Sort against the authored order instead.
    const direction = sort === 'desc' ? 1 : -1;
    visible.sort((a, b) => direction * (
      updated.get(b) - updated.get(a) ||
      ongoing.get(b) - ongoing.get(a) ||
      authored.get(a) - authored.get(b)
    ));

    visible.forEach((card, index) => {
      card.classList.toggle('project-card--reverse', index % 2 === 1);
      grid.append(card);
    });

    tagControls().forEach(control => {
      control.setAttribute('aria-pressed', String(control.dataset.tag === activeTag));
    });

    const count = visible.length;
    const copy = status.dataset;
    if (count === 0) status.textContent = copy.none;
    else if (count === 1) status.textContent = copy.one;
    else status.textContent = copy.many.replace('{n}', String(count));

    if (empty) empty.hidden = count !== 0;

    clearButton.hidden = !query;
    sortLabel.textContent = sort === 'desc' ? sortButton.dataset.labelDesc : sortButton.dataset.labelAsc;
    sortButton.dataset.sort = sort;
  }

  /**
   * Mirror the current view into ?tag= / ?q= without adding a history entry.
   * Both params are rewritten from scratch every time so the same view always
   * produces the same URL, whichever control the visitor touched last.
   */
  function syncUrl() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('tag');
      url.searchParams.delete('q');

      if (activeTag !== 'all') url.searchParams.set('tag', activeTag);
      if (query.trim()) url.searchParams.set('q', query.trim());

      window.history.replaceState(null, '', url);
    } catch (error) {
      console.warn('Project filters: could not sync the URL', error);
    }
  }

  function setTag(tag) {
    // Pressing the active tag again clears it — chips behave as toggles.
    activeTag = tag === activeTag && tag !== 'all' ? 'all' : tag;
    render();
    syncUrl();
  }

  function setQuery(value) {
    query = value;
    render();
    syncUrl();
  }

  root.addEventListener('click', e => {
    const control = e.target.closest('[data-tag]');
    if (!control) return;

    setTag(control.dataset.tag);

    // A tag pressed deep in the list would otherwise leave the reflowed results
    // scrolled off-screen above the viewport.
    if (control.closest('.project-card')) {
      toolbar.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  });

  searchInput.addEventListener('input', debounce(() => setQuery(searchInput.value), 150));

  searchInput.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !searchInput.value) return;
    searchInput.value = '';
    setQuery('');
  });

  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    setQuery('');
    searchInput.focus();
  });

  sortButton.addEventListener('click', () => {
    sort = sort === 'desc' ? 'asc' : 'desc';
    render();
  });

  if (empty) {
    empty.querySelector('.btn')?.addEventListener('click', () => {
      searchInput.value = '';
      query = '';
      activeTag = 'all';
      render();
      syncUrl();
    });
  }

  // `/` focuses the search, the way it does in a repo or a docs site.
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.activeElement?.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    searchInput.focus();
  });

  const params = new URLSearchParams(window.location.search);
  const requestedTag = params.get('tag');
  // An unknown tag (a renamed slug, a typo in a shared link) falls back to the
  // full list rather than an empty page.
  if (requestedTag && knownTag(requestedTag)) activeTag = requestedTag;
  query = params.get('q') || '';
  searchInput.value = query;

  toolbar.hidden = false;
  status.hidden = false;
  render();
  // Rewrite the URL from what actually rendered, so it never advertises a
  // filter the page ignored.
  syncUrl();
}
