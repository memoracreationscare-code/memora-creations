/*
  MEMORA CREATIONS - BRAND LOADER

  Loaded in the <head> of every customer page.

  - First page of a visit: the loader shows right away and stays
    for at least 1 second so the logo is seen, then fades out when
    the page has loaded.
  - Later pages of the same visit: the loader only appears if the
    page is still loading after half a second, so fast pages do not
    flash it.
  - It never stays longer than 8 seconds, and it never appears if
    JavaScript is off.
*/

(() => {

  const root = document.documentElement;

  const MIN_VISIBLE_FIRST = 1000;
  const SHOW_AFTER_LATER = 500;
  const MAX_WAIT = 8000;
  const FADE_MS = 450;

  let firstVisit = true;

  try {
    firstVisit = !sessionStorage.getItem('mc_loader_seen');
    sessionStorage.setItem('mc_loader_seen', '1');
  } catch {
    // Storage can be blocked: treat it as a first visit.
  }

  let shownAt = 0;
  let showTimer = null;
  let finished = false;

  function show() {
    if (shownAt || finished) return;

    shownAt = Date.now();
    root.classList.add('mc-loading');
  }

  function remove() {
    root.classList.remove('mc-loading', 'mc-leaving');
  }

  function finish() {
    if (finished) return;

    finished = true;
    clearTimeout(showTimer);

    if (!shownAt) return;

    const minimum = firstVisit ? MIN_VISIBLE_FIRST : 0;
    const wait = Math.max(0, minimum - (Date.now() - shownAt));

    setTimeout(() => {
      root.classList.add('mc-leaving');
      setTimeout(remove, FADE_MS);
    }, wait);
  }

  if (firstVisit) {
    show();
  } else {
    showTimer = setTimeout(show, SHOW_AFTER_LATER);
  }

  if (document.readyState === 'complete') {
    finish();
  } else {
    window.addEventListener('load', finish, { once: true });
  }

  setTimeout(finish, MAX_WAIT);

  // Coming back with the browser's Back button can restore the
  // page from memory: make sure the loader is not left on top.
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      finished = true;
      remove();
    }
  });

})();
