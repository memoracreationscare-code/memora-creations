(() => {

  const { api, $, esc, money, toast } = window.MC;

  const DONE_KEY = 'mc_return_parcels_done';

  const MESSAGES = {
    undelivered:
      'Namaste {name} ji 🙏\n' +
      'Memora Creations se aapka order {order} deliver nahi ho paya, ' +
      'courier aapko nahi mila.\n' +
      'Kripya apna sahi address aur phone number confirm kar dein, ' +
      'hum dobara delivery karwa denge.',
    returning:
      'Namaste {name} ji 🙏\n' +
      'Memora Creations ka aapka order {order} delivery na ho paane ki wajah se ' +
      'hamare paas wapas aa raha hai.\n' +
      'Agar aap ab bhi ye order chahte hain to hume bata dijiye, ' +
      'hum dobara bhej denge.',
    returned:
      'Namaste {name} ji 🙏\n' +
      'Memora Creations ka aapka order {order} hamare paas wapas aa gaya hai.\n' +
      'Agar aap ab bhi ye order chahte hain to hume bata dijiye, ' +
      'hum dobara bhej denge.',
    lost:
      'Namaste {name} ji 🙏\n' +
      'Memora Creations ke aapke order {order} me courier ki taraf se dikkat aayi hai. ' +
      'Hum jaldi isse theek karke aapko batayenge. Dhanyavaad.'
  };

  function readDone() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DONE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeDone(map) {
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify(map));
    } catch {
      /* page still works without storage */
    }
  }

  // Done is remembered for this exact status, so a new problem on the
  // same parcel shows up again.
  const doneId = parcel => `${parcel.id}:${parcel.status}`;

  function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || 'Customer';
  }

  function whatsappUrl(parcel) {
    const mobile = String(parcel.mobile || '').replace(/\D/g, '').slice(-10);
    const text = (MESSAGES[parcel.kind] || MESSAGES.undelivered)
      .replaceAll('{name}', firstName(parcel.fullName))
      .replaceAll('{order}', parcel.orderId || '');

    return `https://wa.me/91${mobile}?text=${encodeURIComponent(text)}`;
  }

  function when(value) {
    if (!value) return 'not checked yet';

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? 'not checked yet'
      : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }

  const list = $('#rpList');
  const summary = $('#rpSummary');

  let parcels = [];
  let filter = 'all';

  function cardHtml(parcel, done) {
    const tracking = parcel.trackingUrl && /^https?:\/\//.test(parcel.trackingUrl)
      ? `<a href="${esc(parcel.trackingUrl)}" target="_blank" rel="noopener noreferrer">Track parcel</a>`
      : '';

    return `
      <article class="rp-card ${done ? 'done' : ''}">
        <div>
          <span class="rp-badge ${esc(parcel.kind)}">${esc(parcel.kindLabel)}</span>
          <div class="ac-name" style="margin-top:8px">${esc(parcel.fullName || 'Customer')}</div>
          <div class="ac-meta">
            ${esc(parcel.mobile)}<br>
            Order ${esc(parcel.orderId)}
            · ${esc(money(parcel.amount))}
            ${parcel.isCod ? '<span class="rp-cod">COD</span>' : ''}
          </div>
        </div>

        <div class="rp-lines">
          <div><b>Courier status:</b> ${esc(parcel.status)}</div>
          <div class="rp-muted">
            ${esc(parcel.courierName || 'Courier')}
            · AWB ${esc(parcel.awbCode)}
            · last check: ${esc(when(parcel.lastTrackedAt))}
          </div>
          <div class="rp-muted">${esc(parcel.address)}</div>
          <div>${tracking}</div>
        </div>

        <div class="ac-actions">
          <a class="ac-wa" target="_blank" rel="noopener noreferrer"
             href="${esc(whatsappUrl(parcel))}">Contact customer</a>
          <button class="ac-mark" type="button" data-done="${esc(parcel.id)}">
            ${done ? '✓ Handled (undo)' : 'Mark as handled'}
          </button>
        </div>
      </article>`;
  }

  function render() {
    const doneMap = readDone();
    const shown = parcels.filter(p => filter === 'all' || p.kind === filter);

    if (!shown.length) {
      summary.textContent = '';
      list.innerHTML =
        '<div class="ac-state">No parcels in this list. 🎉</div>';
      return;
    }

    const open = shown.filter(p => !doneMap[doneId(p)]).length;

    summary.textContent =
      `${shown.length} parcel${shown.length === 1 ? '' : 's'} (${open} still to handle)`;

    list.innerHTML = shown
      .map(p => cardHtml(p, Boolean(doneMap[doneId(p)])))
      .join('');
  }

  async function load() {
    list.innerHTML = '<div class="ac-state">Loading...</div>';
    summary.textContent = '';

    try {
      const data = await api('/admin/return-parcels');

      parcels = data.parcels || [];
      render();

    } catch (e) {
      parcels = [];
      list.innerHTML =
        '<div class="ac-state">Could not load parcels. If the server was asleep, wait a minute and press Refresh.</div>';
      toast(e.message || 'Could not load return parcels.', 'error');
    }
  }

  list.addEventListener('click', event => {
    const button = event.target.closest('[data-done]');

    if (!button) return;

    const parcel = parcels.find(p => p.id === button.dataset.done);

    if (!parcel) return;

    const map = readDone();

    if (map[doneId(parcel)]) delete map[doneId(parcel)];
    else map[doneId(parcel)] = Date.now();

    writeDone(map);
    render();
  });

  $('#rpTabs').addEventListener('click', event => {
    const tab = event.target.closest('[data-kind]');

    if (!tab) return;

    filter = tab.dataset.kind;

    document.querySelectorAll('.rp-tab').forEach(el =>
      el.classList.toggle('active', el === tab)
    );

    render();
  });

  $('#rpRefresh').addEventListener('click', load);

  (async () => {
    if (await window.requireAdmin()) load();
  })();

})();
