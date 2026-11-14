/*
  "Apni photo upload karein" box for personalised products (photo frames).

    const box = MCPhoto.mount(container, product);   // container = where it goes
    box.value()      -> { customPhotos: [...], customNote: '...' }
    box.check()      -> true if the customer may continue, otherwise shows why and returns false

  Photos are sent to our server (POST /custom-photos) which stores them in
  Cloudinary. Big phone photos are shrunk in the browser first so they upload
  quickly on mobile data.
*/
(() => {
  const MAX_BYTES = 8 * 1024 * 1024;
  const SHRINK_ABOVE = 2.5 * 1024 * 1024;
  const MAX_SIDE = 2800;
  const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  const style = document.createElement('style');

  style.textContent = `
    .mc-photo-box{margin:16px 0;padding:16px;border:1.5px dashed #d9b99f;border-radius:16px;background:#fff9f3}
    .mc-photo-box h3{margin:0 0 4px;font-size:16px;color:#3a2a20;display:flex;gap:8px;align-items:center}
    .mc-photo-box .mc-photo-hint{margin:0 0 12px;color:#6b5d52;font-size:13.5px;line-height:1.5}
    .mc-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:10px}
    .mc-photo-item,.mc-photo-add{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;background:#f2e6db}
    .mc-photo-item img{width:100%;height:100%;object-fit:cover;display:block}
    .mc-photo-item.busy img{opacity:.45}
    .mc-photo-item .mc-photo-x{position:absolute;top:5px;right:5px;width:26px;height:26px;border:0;border-radius:50%;background:#000a;color:#fff;font-size:16px;line-height:1;cursor:pointer}
    .mc-photo-item .mc-photo-spin{position:absolute;inset:0;display:grid;place-items:center;font-size:12px;font-weight:800;color:#3a2a20}
    .mc-photo-add{border:2px dashed #cfa98a;background:#fffdfb;display:grid;place-items:center;text-align:center;cursor:pointer;color:#7a4b2a;font-weight:800;font-size:12.5px;padding:6px}
    .mc-photo-add:hover,.mc-photo-add:focus-within{background:#fdf1e6;border-color:#9b613c}
    .mc-photo-add svg{width:26px;height:26px;display:block;margin:0 auto 4px}
    .mc-photo-add input{position:absolute;inset:0;opacity:0;cursor:pointer;font-size:0}
    .mc-photo-note{margin-top:12px}
    .mc-photo-note label{display:block;font-size:13px;font-weight:800;color:#3a2a20;margin-bottom:6px}
    .mc-photo-note textarea{width:100%;box-sizing:border-box;min-height:70px;padding:10px 12px;border:1.5px solid #e4d2c6;border-radius:12px;font:inherit;resize:vertical;background:#fff}
    .mc-photo-note small{display:block;margin-top:4px;color:#8a7a6c;text-align:right}
    .mc-photo-msg{margin-top:10px;font-size:13px;font-weight:700;color:#b3261e}
    .mc-photo-box.invalid{border-color:#d13b2f;background:#fff4f2}`;
  document.head.appendChild(style);

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => (window.MC && window.MC.toast ? window.MC.toast(m, t) : alert(m));

  const CAMERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>';

  /* shrink very large photos before uploading (keeps them sharp for printing) */
  async function shrink(file) {
    if (file.size <= SHRINK_ABOVE || file.type === 'image/png') return file;

    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');

      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));

      return blob && blob.size < file.size ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
    } catch (_) {
      return file;
    }
  }

  async function upload(file) {
    const data = new FormData();

    data.append('photo', file);

    const response = await fetch(window.MC.API_BASE + '/custom-photos', {
      method: 'POST',
      credentials: 'include',
      body: data
    });

    const result = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      const err = new Error('Photo upload ke liye pehle login karein.');

      err.status = response.status;
      throw err;
    }

    if (!response.ok || !result.photo) throw new Error(result.message || 'Photo upload nahi ho payi.');

    return result.photo;
  }

  function mount(container, product, opts = {}) {
    const cfg = product.personalization || {};
    const max = Math.min(10, Math.max(1, Number(cfg.maxPhotos) || 1));
    const items = []; // { id, url, publicId, preview, busy }
    let n = 0;
    const initial = opts.initial || {};

    // photos uploaded earlier (page reload) come back already uploaded
    (Array.isArray(initial.photos) ? initial.photos : []).slice(0, max).forEach(p => {
      if (p && p.url && p.publicId) items.push({ id: ++n, url: p.url, publicId: p.publicId, preview: p.url, busy: false });
    });

    const changed = () => {
      if (typeof opts.onChange === 'function') opts.onChange({
        customPhotos: items.filter(it => it.url).map(it => ({ url: it.url, publicId: it.publicId })),
        customNote: note.value.trim()
      });
    };

    const root = document.createElement('section');

    root.className = 'mc-photo-box';
    root.innerHTML = `
      <h3>${CAMERA.replace('<svg', '<svg width="22" height="22"')} ${esc(opts.title || 'Apni photo upload karein')} <span style="color:#b3261e">*</span></h3>
      <p class="mc-photo-hint">${esc(cfg.label || 'Jo photo frame me lagani hai wo yaha upload karein.')} (maximum ${max} photo, JPG / PNG / WebP, har photo 8 MB tak)</p>
      <div class="mc-photo-grid"></div>
      <div class="mc-photo-note">
        <label for="mcPhotoNote${opts.uid || ''}">Kuch likhwana ya batana hai? (optional)</label>
        <textarea id="mcPhotoNote${opts.uid || ''}" maxlength="300" placeholder="Jaise: Naam Riya, date 14-02-2027. Pehli photo bade frame me lagana."></textarea>
        <small><span class="mc-photo-count">0</span>/300</small>
      </div>
      <div class="mc-photo-msg" role="alert" hidden></div>`;

    container.replaceChildren(root);

    const grid = root.querySelector('.mc-photo-grid');
    const msg = root.querySelector('.mc-photo-msg');
    const note = root.querySelector('textarea');

    const say = text => {
      msg.hidden = !text;
      msg.textContent = text || '';
      root.classList.toggle('invalid', !!text);
    };

    note.value = String(initial.note || '').slice(0, 300);
    root.querySelector('.mc-photo-count').textContent = note.value.length;

    note.addEventListener('input', () => {
      root.querySelector('.mc-photo-count').textContent = note.value.length;
      changed();
    });

    function render() {
      grid.innerHTML = items.map(it => `
        <div class="mc-photo-item ${it.busy ? 'busy' : ''}" data-id="${it.id}">
          <img src="${esc(it.preview)}" alt="Aapki photo">
          ${it.busy ? '<div class="mc-photo-spin">Upload ho rahi…</div>' : `<button type="button" class="mc-photo-x" aria-label="Photo hatao" data-remove="${it.id}">×</button>`}
        </div>`).join('') + (items.length < max ? `
        <label class="mc-photo-add">
          <span>${CAMERA}${items.length ? 'Aur photo' : 'Photo chuno'}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" ${max - items.length > 1 ? 'multiple' : ''} aria-label="Photo chuno">
        </label>` : '');
    }

    async function addFiles(files) {
      say('');

      const room = max - items.length;
      const list = [...files].slice(0, room);

      if (files.length > room) toast(`Sirf ${max} photo upload ho sakti hain.`, 'error');

      for (const file of list) {
        if (!OK_TYPES.includes(file.type)) { say('Sirf JPG, PNG ya WebP photo upload karein.'); continue; }
        if (file.size > MAX_BYTES * 3) { say('Photo bahut badi hai. 8 MB se chhoti photo chuno.'); continue; }

        const item = { id: ++n, preview: URL.createObjectURL(file), busy: true };

        items.push(item);
        render();

        try {
          const small = await shrink(file);

          if (small.size > MAX_BYTES) throw new Error('Photo 8 MB se chhoti honi chahiye.');

          const saved = await upload(small);

          item.url = saved.url;
          item.publicId = saved.publicId;
          item.busy = false;
        } catch (err) {
          items.splice(items.indexOf(item), 1);
          URL.revokeObjectURL(item.preview);
          say(err.message || 'Photo upload nahi ho payi. Dobara try karein.');

          if (err.status === 401 || err.status === 403) {
            const next = encodeURIComponent(location.pathname + location.search);

            setTimeout(() => { location.href = '/frontend/login.html?next=' + next; }, 1200);
          }
        }

        render();
        changed();
      }
    }

    root.addEventListener('change', event => {
      if (event.target.matches('input[type=file]')) {
        addFiles(event.target.files);
        event.target.value = '';
      }
    });

    root.addEventListener('click', event => {
      const x = event.target.closest('[data-remove]');

      if (!x) return;

      const i = items.findIndex(it => String(it.id) === x.dataset.remove);

      if (i >= 0) { URL.revokeObjectURL(items[i].preview); items.splice(i, 1); render(); changed(); }
    });

    render();

    return {
      busy: () => items.some(it => it.busy),
      check() {
        if (items.some(it => it.busy)) { say('Photo upload ho rahi hai, thoda ruko…'); root.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }

        if (!items.length) { say('Pehle apni photo upload karein. Ye zaroori hai.'); root.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }

        say('');
        return true;
      },
      value() {
        return {
          customPhotos: items.filter(it => it.url).map(it => ({ url: it.url, publicId: it.publicId })),
          customNote: note.value.trim()
        };
      }
    };
  }

  window.MCPhoto = { mount };
})();
