/*
  Adds a search box above the product list in the admin Products
  page. It filters the cards already on the screen by name, category
  or price, so it works as you type.
*/
(() => {

  function start() {
    const grid = document.querySelector('#products');

    if (!grid || document.querySelector('#productSearch')) return;

    const input = document.createElement('input');
    input.id = 'productSearch';
    input.type = 'search';
    input.placeholder = 'Search products by name, category or price';
    input.setAttribute('aria-label', 'Search products');
    input.style.cssText =
      'width:100%;max-width:420px;margin:0 0 14px;padding:11px 14px;' +
      'border:1px solid #e9dfd4;border-radius:12px;font:inherit';

    const note = document.createElement('div');
    note.style.cssText = 'margin:0 0 12px;color:#81776f;font-size:13px';

    grid.parentNode.insertBefore(input, grid);
    grid.parentNode.insertBefore(note, grid);

    function apply() {
      const query = input.value.trim().toLowerCase();
      let shown = 0;
      const cards = grid.querySelectorAll(':scope > .card');

      cards.forEach(card => {
        const match = !query || card.textContent.toLowerCase().includes(query);
        card.style.display = match ? '' : 'none';
        if (match) shown += 1;
      });

      note.textContent = query
        ? `${shown} of ${cards.length} products shown`
        : '';
    }

    input.addEventListener('input', apply);

    // Keep the filter when the list is redrawn after an edit.
    new MutationObserver(apply).observe(grid, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
