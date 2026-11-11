(async () => {
  const { api, $, esc, toast } = window.MC;

  try { await window.requireAdmin(); } catch (_) { return; }

  let categories = [];
  let items = [];

  try {
    categories = (await api('/admin/products')).categories || [];
  } catch (e) {
    toast(e.message || 'Categories load nahi hui.', 'error');
  }

  const byName = new Map(categories.filter(c => c.isActive !== false).map(c => [String(c.name).trim().toLowerCase(), c]));
  const num = v => (String(v ?? '').trim() === '' ? NaN : Number(String(v).replace(/[₹,\s]/g, '')));

  function check(r) {
    const cat = byName.get(String(r.category || '').trim().toLowerCase());
    const body = {
      name: String(r.name || '').trim(),
      description: String(r.description || '').trim(),
      category: cat?._id,
      originalPrice: num(r.originalPrice),
      sellingPrice: num(r.sellingPrice),
      stock: num(r.stock === undefined || r.stock === '' ? 0 : r.stock),
      keywords: String(r.keywords || '').split(/[,;|]/).map(x => x.trim()).filter(Boolean),
      isActive: false
    };
    let why = '';

    if (body.name.length < 2) why = 'Naam chhota hai';
    else if (!body.description) why = 'Description nahi hai';
    else if (!cat) why = `Category "${r.category || ''}" nahi mili`;
    else if (!Number.isFinite(body.originalPrice) || body.originalPrice < 0) why = 'MRP sahi nahi';
    else if (!Number.isFinite(body.sellingPrice) || body.sellingPrice < 0) why = 'Price sahi nahi';
    else if (body.sellingPrice > body.originalPrice) why = 'Price MRP se zyada hai';
    else if (!Number.isInteger(body.stock) || body.stock < 0) why = 'Stock poora number hona chahiye';

    return { body, why, cat };
  }

  $('#sample').onclick = () => {
    const name = categories[0]?.name || 'Home Decor';
    const csv = 'name,description,category,originalPrice,sellingPrice,stock,keywords\n' +
      `"Moon Lamp","3D glowing moon lamp, USB powered",${JSON.stringify(name)},999,699,10,"lamp, moon, gift"\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'products-sample.csv';
    a.click();
  };

  $('#file').onchange = async event => {
    const file = event.target.files[0];

    if (!file) return;
    if (file.size > 1024 * 1024) { $('#msg').textContent = 'File 1 MB se badi hai.'; return; }

    const rows = window.mcParseCsv(await file.text());
    const head = (rows.shift() || []).map(h => h.trim());
    const required = ['name', 'description', 'category', 'originalPrice', 'sellingPrice'];
    const missing = required.filter(k => !head.includes(k));

    if (missing.length) {
      $('#msg').textContent = 'Ye columns nahi mile: ' + missing.join(', ');
      $('#preview').hidden = true;
      return;
    }
    if (rows.length > 200) { $('#msg').textContent = 'Ek baar me 200 se zyada products nahi.'; return; }

    items = rows.map(r => check(Object.fromEntries(head.map((h, i) => [h, r[i]]))));

    const good = items.filter(x => !x.why).length;

    $('#rows').innerHTML = items.map((x, i) => `<tr>
      <td>${i + 1}</td><td>${esc(x.body.name)}</td><td>${esc(x.cat?.name || '')}</td>
      <td>${esc(Number.isFinite(x.body.originalPrice) ? x.body.originalPrice : '')}</td>
      <td>${esc(Number.isFinite(x.body.sellingPrice) ? x.body.sellingPrice : '')}</td>
      <td>${esc(Number.isFinite(x.body.stock) ? x.body.stock : '')}</td>
      <td class="${x.why ? 'bad' : 'ok'}" data-i="${i}">${x.why ? '✕ ' + esc(x.why) : '✓ theek'}</td></tr>`).join('');
    $('#msg').textContent = `${good} product theek hain, ${items.length - good} me galti hai (wo import nahi honge).`;
    $('#go').disabled = good === 0;
    $('#go').textContent = `${good} product import karo`;
    $('#preview').hidden = false;
  };

  $('#go').onclick = async () => {
    $('#go').disabled = true;
    let done = 0, failed = 0;

    for (let i = 0; i < items.length; i++) {
      if (items[i].why) continue;

      const cell = document.querySelector(`td[data-i="${i}"]`);

      try {
        await api('/admin/products', { method: 'POST', body: JSON.stringify(items[i].body) });
        done++;
        cell.className = 'ok';
        cell.textContent = '✓ ban gaya (draft)';
      } catch (e) {
        failed++;
        cell.className = 'bad';
        cell.textContent = '✕ ' + (e.message || 'fail');
      }

      $('#msg').textContent = `Ho raha hai... ${done + failed} / ${items.filter(x => !x.why).length}`;
    }

    $('#msg').innerHTML = `${done} product bane${failed ? `, ${failed} fail hue` : ''}. ` +
      '<a href="/memora-creations/admin/products.html">Products page par jakar photo lagayein aur "Website par dikhao" dabayein →</a>';
    toast(`${done} product import hue.`, failed ? 'warning' : 'success');
  };
})();
