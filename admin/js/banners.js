(() => {

  const { api, $, esc, toast } = window.MC;

  let banners = [];
  let editing = null;

  async function upload(file) {
    const sig = await api('/admin/cloudinary/signature', {
      method: 'POST',
      body: JSON.stringify({ folder: 'memora-creations/banners' })
    });

    const fd = new FormData();

    fd.append('file', file);
    fd.append('api_key', sig.apiKey);
    fd.append('timestamp', sig.timestamp);
    fd.append('folder', sig.folder);
    fd.append('signature', sig.signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: 'POST', body: fd });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error?.message || 'Photo upload failed.');

    return data.secure_url;
  }

  const msg = (text, ok) => {
    const box = $('#bnMsg');
    box.textContent = text;
    box.style.color = ok ? '#1b6e2d' : '#b42318';
  };

  const day = v => v ? new Date(v).toISOString().slice(0, 10) : '';

  function render() {
    $('#bnList').innerHTML = banners.length
      ? banners.map(b => `
        <div class="bn-row ${b.active ? '' : 'bn-off'}">
          <img src="${esc(b.imageUrl)}" alt="">
          <div>
            <b>${esc(b.title || '(no title)')}</b> ${b.active ? '' : '<em>(hidden)</em>'}<br>
            <small>${esc(b.subtitle || '')}</small><br>
            <small>Link: ${esc(b.link || 'none')} · Order ${esc(b.sortOrder)}
              ${b.startsAt ? ' · from ' + esc(day(b.startsAt)) : ''}${b.endsAt ? ' · until ' + esc(day(b.endsAt)) : ''}</small>
          </div>
          <div class="bn-act">
            <button class="btn secondary" data-act="edit" data-id="${esc(b._id)}" type="button">Edit</button>
            <button class="btn secondary" data-act="toggle" data-id="${esc(b._id)}" type="button">${b.active ? 'Hide' : 'Show'}</button>
            <button class="btn secondary" data-act="delete" data-id="${esc(b._id)}" type="button">Delete</button>
          </div>
        </div>`).join('')
      : '<div class="bn-box">No banners yet. Add your first one above.</div>';
  }

  async function load() {
    try {
      banners = (await api('/admin/banners')).banners || [];
      render();
    } catch {
      $('#bnList').innerHTML = '<div class="bn-box">Could not load banners. If the server was asleep, wait a minute and reload.</div>';
    }
  }

  function reset() {
    editing = null;
    $('#bnForm').reset();
    $('#bnActive').checked = true;
    $('#bnFormTitle').textContent = 'Add a banner';
    $('#bnCancel').hidden = true;
    $('#bnImageNote').textContent = '';
    $('#bnMobileNote').textContent = '';
  }

  $('#bnForm').addEventListener('submit', async event => {
    event.preventDefault();

    const button = $('#bnSave');

    button.disabled = true;
    msg('Saving...', true);

    try {
      const body = {
        title: $('#bnTitle').value,
        subtitle: $('#bnSub').value,
        buttonText: $('#bnBtn').value,
        link: $('#bnLink').value,
        sortOrder: $('#bnOrder').value || 0,
        active: $('#bnActive').checked,
        startsAt: $('#bnStart').value || null,
        endsAt: $('#bnEnd').value ? $('#bnEnd').value + 'T23:59:59' : null
      };

      const image = $('#bnImage').files[0];
      const mobile = $('#bnMobile').files[0];

      if (image) body.imageUrl = await upload(image);
      if (mobile) body.mobileImageUrl = await upload(mobile);

      if (editing) {
        await api('/admin/banners/' + encodeURIComponent(editing), { method: 'PUT', body: JSON.stringify(body) });
      } else {
        if (!body.imageUrl) throw new Error('Please choose a banner photo.');
        await api('/admin/banners', { method: 'POST', body: JSON.stringify(body) });
      }

      msg('✔ Saved. It shows on the homepage within a minute.', true);
      toast('Banner saved.', 'success');
      reset();
      await load();

    } catch (e) {
      msg('✖ ' + (e.message || 'Could not save.'), false);
    } finally {
      button.disabled = false;
    }
  });

  $('#bnCancel').addEventListener('click', reset);

  $('#bnList').addEventListener('click', async event => {
    const button = event.target.closest('[data-act]');

    if (!button) return;

    const id = button.dataset.id;
    const banner = banners.find(b => b._id === id);

    if (!banner) return;

    try {
      if (button.dataset.act === 'edit') {
        editing = id;
        $('#bnTitle').value = banner.title || '';
        $('#bnSub').value = banner.subtitle || '';
        $('#bnBtn').value = banner.buttonText || '';
        $('#bnLink').value = banner.link || '';
        $('#bnOrder').value = banner.sortOrder || 0;
        $('#bnActive').checked = banner.active !== false;
        $('#bnStart').value = day(banner.startsAt);
        $('#bnEnd').value = day(banner.endsAt);
        $('#bnFormTitle').textContent = 'Edit banner';
        $('#bnImageNote').textContent = 'Leave empty to keep the current photo.';
        $('#bnCancel').hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (button.dataset.act === 'toggle') {
        await api('/admin/banners/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify({ active: !banner.active }) });
      }

      if (button.dataset.act === 'delete') {
        if (!(await window.mcConfirm('Delete this banner?', { title: 'Banner hatana hai?', okText: 'Haan, hatao', danger: true }))) return;
        await api('/admin/banners/' + encodeURIComponent(id), { method: 'DELETE' });
      }

      await load();

    } catch (e) {
      toast(e.message || 'Action failed.', 'error');
    }
  });

  (async () => {
    if (await window.requireAdmin()) load();
  })();

})();
