let productState = { products: [], categories: [] };

async function loadProducts() {
  await requireAdmin();

  const d = await window.MC.api('/admin/products');
  productState = d;

  window.MC.$('#category').innerHTML = d.categories
    .filter(c => c.isActive !== false)
    .map(c => `<option value="${c._id}">${window.MC.esc(c.name)}</option>`)
    .join('');

  window.MC.$('#categories').innerHTML = d.categories
    .map(c => `
      <span class="pill">
        ${window.MC.esc(c.name)}
        ${c.isActive !== false ? `
          <button class="btn secondary catedit" data-id="${c._id}">Edit</button>
          <button class="btn danger catdel" data-id="${c._id}">×</button>
        ` : ''}
      </span>
    `).join('');

  window.MC.$$('.catdel').forEach(b => {
    b.onclick = async () => {
      if (confirm('Disable category?')) {
        try {
          await window.MC.api('/admin/categories/' + b.dataset.id, {
            method: 'DELETE'
          });
          loadProducts();
        } catch (e) {
          window.MC.toast(e.message, 'error');
        }
      }
    };
  });

  window.MC.$$('.catedit').forEach(b => {
    b.onclick = async () => {
      const c = productState.categories.find(x => x._id === b.dataset.id);
      if (!c) return;

      const name = prompt('Category name', c.name);
      if (name === null) return;

      try {
        await window.MC.api('/admin/categories/' + c._id, {
          method: 'PUT',
          body: JSON.stringify({ name })
        });
        loadProducts();
      } catch (e) {
        window.MC.toast(e.message, 'error');
      }
    };
  });

  window.MC.$('#products').innerHTML = d.products.map(p => `
    <article class="card">
      <img
        class="productimg"
        src="${window.MC.esc(p.images?.[0]?.url || 'https://placehold.co/600x600')}"
        alt=""
      >
      <div class="cardbody">
        <h3>${window.MC.esc(p.name)}</h3>
        <p>${window.MC.money(p.sellingPrice)} · Stock ${p.stock}</p>

        <div class="actions">
          <button class="btn product-edit" data-id="${p._id}">Edit</button>
          <button class="btn danger product-delete" data-id="${p._id}">Delete</button>
        </div>
      </div>
    </article>
  `).join('');

  window.MC.$$('.product-edit').forEach(b => {
    b.onclick = () => editProduct(b.dataset.id);
  });

  window.MC.$$('.product-delete').forEach(b => {
    b.onclick = () => deleteProduct(b.dataset.id);
  });
}

function editProduct(id) {
  const p = productState.products.find(x => x._id === id);
  if (!p) return;

  window.MC.$('#editId').value = p._id;
  window.MC.$('#name').value = p.name;
  window.MC.$('#description').value = p.description;
  window.MC.$('#category').value = p.category?._id || p.category;
  window.MC.$('#originalPrice').value = p.originalPrice;
  window.MC.$('#sellingPrice').value = p.sellingPrice;
  window.MC.$('#stock').value = p.stock;
  window.MC.$('#keywords').value = (p.keywords || []).join(',');
  window.MC.$('#isFeatured').checked = p.isFeatured;
  window.MC.$('#isBestSeller').checked = p.isBestSeller;

  scrollTo(0, 0);
}

async function uploadProductImage(file) {
  const s = await window.MC.api('/admin/cloudinary/signature', {
    method: 'POST',
    body: JSON.stringify({
      folder: 'memora-creations/products'
    })
  });

  const fd = new FormData();
  fd.append('file', file);
  fd.append('api_key', s.apiKey);
  fd.append('timestamp', s.timestamp);
  fd.append('folder', s.folder);
  fd.append('signature', s.signature);

  const r = await fetch(
    `https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`,
    {
      method: 'POST',
      body: fd
    }
  );

  const d = await r.json();

  if (!r.ok) {
    throw new Error(d.error?.message || 'Image upload failed');
  }

  return {
    url: d.secure_url,
    publicId: d.public_id,
    alt: file.name
  };
}

window.MC.$('#productForm').addEventListener('submit', async e => {
  e.preventDefault();

  try {
    const files = [...window.MC.$('#images').files];
    const imgs = await Promise.all(files.map(uploadProductImage));

    const current = productState.products.find(
      x => x._id === window.MC.$('#editId').value
    );

    const body = {
      name: window.MC.$('#name').value,
      description: window.MC.$('#description').value,
      category: window.MC.$('#category').value,
      originalPrice: Number(window.MC.$('#originalPrice').value),
      sellingPrice: Number(window.MC.$('#sellingPrice').value),
      stock: Number(window.MC.$('#stock').value),

      keywords: window.MC.$('#keywords').value
        .split(',')
        .map(x => x.trim())
        .filter(Boolean),

      images: imgs.length ? imgs : (current?.images || []),

      isFeatured: window.MC.$('#isFeatured').checked,
      isBestSeller: window.MC.$('#isBestSeller').checked
    };

    const id = window.MC.$('#editId').value;

    await window.MC.api(
      id ? '/admin/products/' + id : '/admin/products',
      {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(body)
      }
    );

    window.MC.toast('Product saved.', 'success');

    clearProductForm();
    loadProducts();

  } catch (e) {
    window.MC.toast(e.message, 'error');
  }
});

async function deleteProduct(id) {
  if (!confirm('Disable this product?')) return;

  try {
    await window.MC.api('/admin/products/' + id, {
      method: 'DELETE'
    });

    loadProducts();

  } catch (e) {
    window.MC.toast(e.message, 'error');
  }
}

function clearProductForm() {
  window.MC.$('#productForm').reset();
  window.MC.$('#editId').value = '';
}

window.MC.$('#cancelEdit').onclick = clearProductForm;

window.MC.$('#categoryForm').addEventListener('submit', async e => {
  e.preventDefault();

  try {
    await window.MC.api('/admin/categories', {
      method: 'POST',
      body: JSON.stringify({
        name: window.MC.$('#categoryName').value
      })
    });

    e.currentTarget.reset();
    await loadProducts();

    window.MC.toast('Category added.', 'success');

  } catch (e) {
    window.MC.toast(e.message, 'error');
  }
});

loadProducts().catch(e => {
  window.MC.toast(e.message, 'error');
});
