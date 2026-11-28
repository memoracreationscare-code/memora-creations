/* "Khaas din" card on the profile page: the customer saves up to 5 dates
   (Maa ka birthday, anniversary...) and gets a gift reminder email before the day.
   Admin switch: occasionReminderEnabled. All text is set with textContent. */
(() => {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const style = document.createElement('style');
  style.textContent = `.mc-sd .sd-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f0e8de;font-size:14px}
.mc-sd .sd-row small{color:#8a7a68;display:block}
.mc-sd .sd-del{border:0;background:none;color:#b3261e;font-weight:700;cursor:pointer;padding:6px}
.mc-sd form{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.mc-sd form .full{grid-column:1/-1}
.mc-sd form button{grid-column:1/-1;padding:11px;border:0;border-radius:10px;background:#8a5a3b;color:#fff;font-weight:700;cursor:pointer}
.mc-sd .sd-msg{margin-top:8px;font-size:13px;color:#7a6a58}`;
  document.head.appendChild(style);

  const el = (tag, props = {}, text) => {
    const n = document.createElement(tag);
    Object.assign(n, props);
    if (text != null) n.textContent = text;
    return n;
  };
  const api = (path, opts) => window.MC.api('/profile' + path, opts);

  function option(sel, value, label) { sel.appendChild(el('option', { value }, label)); }

  function mount(card, state) {
    const list = el('div');
    const msg = el('div', { className: 'sd-msg', role: 'status' });
    const form = el('form');
    form.noValidate = true;

    const name = el('input', { className: 'profile-input full', maxLength: 60, placeholder: 'Kiska? (jaise: Maa, Rahul)' });
    name.setAttribute('aria-label', 'Naam');
    const occ = el('select', { className: 'profile-input' });
    [['Birthday', 'Birthday'], ['Anniversary', 'Anniversary'], ['Other', 'Koi aur din']].forEach(([v, l]) => option(occ, v, l));
    const day = el('select', { className: 'profile-input' });
    for (let i = 1; i <= 31; i++) option(day, String(i).padStart(2, '0'), String(i));
    const month = el('select', { className: 'profile-input' });
    MONTHS.forEach((m, i) => option(month, String(i + 1).padStart(2, '0'), m));
    const add = el('button', { type: 'submit' }, 'Din save karein');
    occ.classList.add('full');
    [name, occ, day, month, add].forEach(n => form.appendChild(n));

    function render(dates) {
      list.textContent = '';
      state.count = dates.length;
      if (!dates.length) list.appendChild(el('p', { className: 'sd-msg' }, 'Abhi koi din save nahi hai.'));
      dates.forEach(d => {
        const [mm, dd] = d.date.split('-');
        const row = el('div', { className: 'sd-row' });
        const left = el('div');
        left.appendChild(el('b', {}, d.name));
        left.appendChild(el('small', {}, `${d.occasion === 'Other' ? 'Khaas din' : d.occasion} · ${Number(dd)} ${MONTHS[Number(mm) - 1]}`));
        const del = el('button', { type: 'button', className: 'sd-del', title: 'Hatayein' }, 'Hatayein');
        del.addEventListener('click', async () => {
          del.disabled = true;
          try { render((await api('/dates/' + encodeURIComponent(d._id), { method: 'DELETE' })).dates || []); }
          catch (e) { msg.textContent = e.message || 'Hata nahi paya.'; del.disabled = false; }
        });
        row.appendChild(left); row.appendChild(del); list.appendChild(row);
      });
      form.hidden = dates.length >= 5;
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      msg.textContent = '';
      add.disabled = true;
      try {
        const data = await api('/dates', { method: 'POST', body: JSON.stringify({ name: name.value, occasion: occ.value, date: `${month.value}-${day.value}` }) });
        name.value = '';
        render(data.dates || []);
        msg.textContent = 'Save ho gaya. Din se pehle email se yaad dilayenge.';
      } catch (err) { msg.textContent = err.message || 'Save nahi ho paya.'; }
      add.disabled = false;
    });

    card.appendChild(list); card.appendChild(form); card.appendChild(msg);
    api('/dates').then(d => render(d.dates || [])).catch(() => { list.textContent = ''; });
  }

  async function start() {
    const anchor = document.getElementById('addressesCard');
    if (!anchor || document.querySelector('.mc-sd')) return;
    try {
      const r = await fetch(window.MC.API_BASE + '/settings');
      const d = await r.json();
      const s = (d && (d.settings || d.data || d)) || {};
      if (s.occasionReminderEnabled === false) return;
    } catch (_) { /* show it; the server decides about emails */ }

    const card = el('section', { className: 'profile-card mc-sd' });
    const head = el('div', { className: 'profile-card-heading' });
    const inner = el('div');
    inner.appendChild(el('span', {}, 'GIFT REMINDER'));
    inner.appendChild(el('h2', {}, 'Khaas din'));
    head.appendChild(inner);
    card.appendChild(head);
    card.appendChild(el('p', { className: 'sd-msg' }, 'Kisi ka birthday ya anniversary save karein; hum kuch din pehle gift ke liye yaad dila denge.'));
    anchor.insertAdjacentElement('afterend', card);
    mount(card, {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
