'use strict';

/*
  Products page, phones only: the long filter panel is folded behind a
  "Filters" button so customers see products sooner.
  - If anything goes wrong (or JS is off) the panel simply stays open.
  - It opens automatically when a filter is already active.
*/

(() => {
  const card = document.querySelector('.products-filter-card');
  const form = document.getElementById('filterForm');
  const top = card && card.querySelector('.filter-top');
  if (!card || !form || !top) return;

  const style = document.createElement('style');
  style.textContent = `
.filter-toggle{display:none}
@media (max-width:700px){
  .products-filter-card .filter-top{flex-wrap:wrap;gap:6px 12px}
  .filter-toggle{flex:1 1 100%;justify-content:center;display:inline-flex;align-items:center;gap:6px;margin-top:6px;padding:9px 16px;border-radius:999px;border:1px solid #d9c3b0;background:#fff;color:#6b4126;font-weight:800;font-size:14px;cursor:pointer}
  .filter-toggle .ft-dot{width:8px;height:8px;border-radius:50%;background:#b0603a;display:none}
  .filter-toggle.has-filters .ft-dot{display:inline-block}
  .products-filter-card.is-folded .products-filter-form{display:none}
}`;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'filter-toggle';
  btn.setAttribute('aria-expanded', 'true');
  btn.innerHTML = '<span aria-hidden="true">⚙️</span><span class="ft-label">Filters</span><span class="ft-dot" aria-hidden="true"></span>';
  top.appendChild(btn);

  const params = new URLSearchParams(location.search);
  const active = ['q', 'category', 'min', 'max', 'minPrice', 'maxPrice', 'inStock', 'sort']
    .some(k => params.get(k));

  function fold(on) {
    card.classList.toggle('is-folded', on);
    btn.setAttribute('aria-expanded', String(!on));
    btn.querySelector('.ft-label').textContent = on ? 'Filters dikhao' : 'Filters chhupao';
  }

  btn.classList.toggle('has-filters', active);
  fold(!active);
  btn.addEventListener('click', () => fold(!card.classList.contains('is-folded')));
})();
