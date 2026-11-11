
/* ==========================================
   MEMORA CREATIONS
   ADMIN PRODUCTS - PREMIUM POPUPS
========================================== */

let productState = {
  products: [],
  categories: []
};

/* ==========================================
   PREMIUM CONFIRM / INPUT POPUP
========================================== */

function adminPopup({
  title = 'Confirm Action',
  message = '',
  confirmText = 'Confirm',
  defaultValue = null,
  danger = false
} = {}) {

  return new Promise(resolve => {

    const oldPopup = document.getElementById(
      'mcAdminDialog'
    );

    if (oldPopup) {
      oldPopup.remove();
    }

    const overlay = document.createElement('div');

    overlay.id = 'mcAdminDialog';
    overlay.className = 'mc-admin-popup-overlay';

    overlay.innerHTML = `
      <div
        class="mc-admin-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcDialogTitle"
      >

        <div style="
          width:65px;
          height:65px;
          margin:0 auto 16px;
          border-radius:50%;
          display:flex;
          align-items:center;
          justify-content:center;
          background:${danger ? '#fff0ed' : '#f6ede4'};
          color:${danger ? '#c34848' : '#8b5b3a'};
          font-size:30px;
        ">
          ${danger ? '⚠' : '✎'}
        </div>

        <h2 id="mcDialogTitle"></h2>

        <p id="mcDialogMessage"></p>

        <div id="mcDialogInputWrap"
          style="display:none;margin-top:18px;text-align:left;"
        >
          <label for="mcDialogInput"
            style="display:block;margin-bottom:7px;
            color:#4a382b;font-weight:700;"
          >
            Category Name
          </label>

          <input
            id="mcDialogInput"
            type="text"
            maxlength="100"
            style="
              width:100%;
              padding:13px;
              border:1px solid #dfd2c6;
              border-radius:12px;
              outline:none;
              color:#302117;
            "
          >
        </div>

        <div class="mc-admin-popup-actions">

          <button type="button" id="mcDialogCancel"
            style="
              flex:1;
              padding:13px;
              border:0;
              border-radius:12px;
              background:#f1e9e1;
              color:#302117;
              font-weight:800;
              cursor:pointer;
            "
          >
            Cancel
          </button>

          <button type="button" id="mcDialogConfirm"
            style="
              flex:1;
              padding:13px;
              border:0;
              border-radius:12px;
              background:${danger ? '#c34848' : '#8b5b3a'};
              color:white;
              font-weight:800;
              cursor:pointer;
            "
          ></button>

        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    const titleEl = overlay.querySelector(
      '#mcDialogTitle'
    );

    const messageEl = overlay.querySelector(
      '#mcDialogMessage'
    );

    const confirmBtn = overlay.querySelector(
      '#mcDialogConfirm'
    );

    const cancelBtn = overlay.querySelector(
      '#mcDialogCancel'
    );

    const inputWrap = overlay.querySelector(
      '#mcDialogInputWrap'
    );

    const input = overlay.querySelector(
      '#mcDialogInput'
    );

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = confirmText;

    const hasInput = defaultValue !== null;

    if (hasInput) {
      inputWrap.style.display = 'block';
      input.value = String(defaultValue || '');
      input.focus();
      input.select();
    } else {
      cancelBtn.focus();
    }

    let finished = false;

    function closePopup(value) {
      if (finished) return;

      finished = true;

      document.removeEventListener(
        'keydown',
        onKeyDown
      );

      overlay.remove();

      resolve(value);
    }

    function onKeyDown(event) {

      if (event.key === 'Escape') {
        event.preventDefault();
        closePopup(null);
      }

      if (
        event.key === 'Tab'
      ) {
        const focusables = hasInput
          ? [input, cancelBtn, confirmBtn]
          : [cancelBtn, confirmBtn];

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey &&
            document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last
        ) {
          event.preventDefault();
          first.focus();
        }
      }

      if (
        hasInput &&
        event.key === 'Enter' &&
        document.activeElement === input
      ) {
        event.preventDefault();
        confirmBtn.click();
      }
    }

    document.addEventListener(
      'keydown',
      onKeyDown
    );

    cancelBtn.addEventListener(
      'click',
      () => closePopup(null)
    );

    confirmBtn.addEventListener(
      'click',
      () => {

        if (hasInput) {

          const value = input.value.trim();

          if (!value) {
            input.focus();
            window.MC.toast(
              'Please enter category name.',
              'error'
            );
            return;
          }

          closePopup(value);

        } else {
          closePopup(true);
        }
      }
    );

    overlay.addEventListener(
      'click',
      event => {
        if (event.target === overlay) {
          closePopup(null);
        }
      }
    );

  });
}


/* ==========================================
   LOAD PRODUCTS AND CATEGORIES
========================================== */

async function loadProducts() {

  const admin = await requireAdmin();

  if (!admin) return;

  const d = await window.MC.api(
    '/admin/products'
  );

  productState = d;

  const $ = window.MC.$;
  const $$ = window.MC.$$;

  /* CATEGORY DROPDOWN */

  $('#category').innerHTML =
    d.categories
      .filter(c => c.isActive !== false)
      .map(c => `
        <option value="${c._id}">
          ${window.MC.esc(c.name)}
        </option>
      `)
      .join('');


  /* CATEGORY LIST */

  $('#categories').innerHTML =
    d.categories.map(c => `
      <span class="pill">

        ${window.MC.esc(c.name)}

        ${c.isActive !== false ? `
          <button
            type="button"
            class="btn secondary catedit"
            data-id="${c._id}"
          >
            Edit
          </button>

          <button
            type="button"
            class="btn danger catdel"
            data-id="${c._id}"
          >
            ×
          </button>
        ` : ''}

      </span>
    `).join('');


  /* CATEGORY DISABLE */

  $$('.catdel').forEach(button => {

    button.onclick = async () => {

      const category = productState.categories.find(
        c => c._id === button.dataset.id
      );

      const approved = await adminPopup({
        title: 'Disable Category?',
        message:
          'Are you sure you want to disable ' +
          (category?.name || 'this category') +
          '?',
        confirmText: 'Disable',
        danger: true
      });

      if (!approved) return;

      try {

        await window.MC.api(
          '/admin/categories/' + button.dataset.id,
          {
            method: 'DELETE'
          }
        );

        window.MC.toast(
          'Category disabled successfully.',
          'success'
        );

        await loadProducts();

      } catch (error) {

        window.MC.toast(
          error.message,
          'error'
        );

      }
    };
  });


  /* CATEGORY EDIT */

  $$('.catedit').forEach(button => {

    button.onclick = async () => {

      const category = productState.categories.find(
        c => c._id === button.dataset.id
      );

      if (!category) return;

      const name = await adminPopup({
        title: 'Edit Category',
        message: 'Update the category name.',
        confirmText: 'Save Changes',
        defaultValue: category.name
      });

      if (name === null) return;

      try {

        await window.MC.api(
          '/admin/categories/' + category._id,
          {
            method: 'PUT',
            body: JSON.stringify({ name })
          }
        );

        window.MC.toast(
          'Category updated successfully.',
          'success'
        );

        await loadProducts();

      } catch (error) {

        window.MC.toast(
          error.message,
          'error'
        );

      }
    };
  });


  /* PRODUCT CARDS */

  $('#products').innerHTML =
    d.products.map(product => `

      <article class="card">

        <img
          class="productimg"
          src="${window.MC.esc(
            product.images?.[0]?.url ||
            'https://placehold.co/600x600'
          )}"
          alt=""
        >

        <div class="cardbody">

          <h3>
            ${window.MC.esc(product.name)}
          </h3>

          <p>
            ${window.MC.money(product.sellingPrice)}
            · Stock ${product.stock}
          </p>

          <div class="actions">

            <button
              type="button"
              class="btn product-edit"
              data-id="${product._id}"
            >
              Edit
            </button>

            <button
              type="button"
              class="btn secondary product-visibility"
              data-id="${product._id}"
              data-active="${product.isActive !== false}"
              title="Website par dikhana ya chhupana"
            >
              ${product.isActive === false ? 'Website par dikhao' : 'Chhupao'}
            </button>

            <button
              type="button"
              class="btn secondary product-copy"
              data-id="${product._id}"
              title="Isi jaisa naya product banao"
            >
              Copy
            </button>

            <button
              type="button"
              class="btn danger product-delete"
              data-id="${product._id}"
            >
              Delete
            </button>

          </div>

        </div>

      </article>

    `).join('');


  $$('.product-edit').forEach(button => {

    button.onclick = () => {
      editProduct(button.dataset.id);
    };

  });


  $$('.product-visibility').forEach(button => {

    button.onclick = async () => {
      const show = button.dataset.active !== 'true';

      button.disabled = true;

      try {
        const r = await window.MC.api(
          '/admin/products/' + encodeURIComponent(button.dataset.id) + '/visibility',
          { method: 'PATCH', body: JSON.stringify({ isActive: show }) }
        );

        window.MC.toast(r.message, 'success');
        loadProducts();
      } catch (e) {
        window.MC.toast(e.message || 'Badal nahi paya.', 'error');
        button.disabled = false;
      }
    };

  });


  $$('.product-copy').forEach(button => {

    button.onclick = () => {
      editProduct(button.dataset.id, true);
    };

  });


  $$('.product-delete').forEach(button => {

    button.onclick = () => {
      deleteProduct(button.dataset.id);
    };

  });

}


/* ==========================================
   EDIT PRODUCT
========================================== */

function editProduct(id, asCopy = false) {

  const product = productState.products.find(
    p => p._id === id
  );

  if (!product) return;

  const $ = window.MC.$;

  $('#editId').value = product._id;
  $('#name').value = product.name;
  $('#description').value = product.description;
  $('#category').value =
    product.category?._id || product.category;

  $('#originalPrice').value =
    product.originalPrice;

  $('#sellingPrice').value =
    product.sellingPrice;

  $('#stock').value = product.stock;
  setVariantRows(product.variants || []);

  // Copy: same details, but saved as a NEW product (new name, own photos).
  if (asCopy) {
    $('#editId').value = '';
    $('#name').value = product.name + ' (Copy)';
    setVariantRows((product.variants || []).map(({ _id, ...rest }) => rest));
    window.MC.toast('Copy tayyar hai: naam badlo, photo chuno aur Save karo.', 'message');
  }

  // Optional saved shipping fields for editing
  for (const key of [
    'shippingWeightKg',
    'packageLengthCm',
    'packageWidthCm',
    'packageHeightCm'
  ]) {
    const input = document.getElementById(key);
    if (input) input.value = product[key] ?? '';
  }

  $('#keywords').value =
    (product.keywords || []).join(',');

  $('#isFeatured').checked =
    Boolean(product.isFeatured);

  $('#isBestSeller').checked =
    Boolean(product.isBestSeller);

  window.scrollTo(0, 0);
}


/* ==========================================
   UPLOAD PRODUCT IMAGE
========================================== */

async function uploadProductImage(file) {

  const signature = await window.MC.api(
    '/admin/cloudinary/signature',
    {
      method: 'POST',
      body: JSON.stringify({
        folder: 'memora-creations/products'
      })
    }
  );

  const fd = new FormData();

  fd.append('file', file);
  fd.append('api_key', signature.apiKey);
  fd.append('timestamp', signature.timestamp);
  fd.append('folder', signature.folder);
  fd.append('signature', signature.signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
    {
      method: 'POST',
      body: fd
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message || 'Image upload failed'
    );
  }

  return {
    url: data.secure_url,
    publicId: data.public_id,
    alt: file.name
  };
}


/* ==========================================
   SAVE PRODUCT
========================================== */

window.MC.$('#productForm').addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    const $ = window.MC.$;

    try {

      const files = [...$('#images').files];

      const uploadedImages = await Promise.all(
        files.map(uploadProductImage)
      );

      const current = productState.products.find(
        p => p._id === $('#editId').value
      );

      const body = {

        name: $('#name').value,

        description: $('#description').value,

        category: $('#category').value,

        originalPrice:
          Number($('#originalPrice').value),

        sellingPrice:
          Number($('#sellingPrice').value),

        stock:
          Number($('#stock').value),

        variants: readVariantRows(),

        // Read from the admin form. Empty means unknown.
        shippingWeightKg:
          $('#shippingWeightKg').value.trim() === ''
            ? null : Number($('#shippingWeightKg').value),

        packageLengthCm:
          $('#packageLengthCm').value.trim() === ''
            ? null : Number($('#packageLengthCm').value),

        packageWidthCm:
          $('#packageWidthCm').value.trim() === ''
            ? null : Number($('#packageWidthCm').value),

        packageHeightCm:
          $('#packageHeightCm').value.trim() === ''
            ? null : Number($('#packageHeightCm').value),

        keywords: $('#keywords').value
          .split(',')
          .map(x => x.trim())
          .filter(Boolean),

        images: uploadedImages.length
          ? uploadedImages
          : (current?.images || []),

        isFeatured:
          $('#isFeatured').checked,

        isBestSeller:
          $('#isBestSeller').checked

      };

      const id = $('#editId').value;

      await window.MC.api(
        id
          ? '/admin/products/' + id
          : '/admin/products',
        {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(body)
        }
      );

      window.MC.toast(
        'Product saved. It now shows on the website (refresh the website page).',
        'success'
      );

      showProductFormMessage('');

      clearProductForm();

      await loadProducts();

    } catch (error) {

      const text =
        error.message ||
        'Product could not be saved. Please check all fields and the photo.';

      window.MC.toast(text, 'error');

      // Stays on screen (a toast disappears), so the reason is not missed.
      showProductFormMessage(text);

    }
  }
);

function showProductFormMessage(text) {

  const form = document.getElementById('productForm');

  if (!form) return;

  let box = document.getElementById('productFormMsg');

  if (!box) {
    box = document.createElement('p');
    box.id = 'productFormMsg';
    box.setAttribute('role', 'alert');
    box.style.cssText =
      'margin:10px 0;padding:10px 12px;border-radius:10px;' +
      'background:#fff1f0;border:1px solid #d62828;color:#7a1212;font-weight:600';
    form.appendChild(box);
  }

  box.textContent = text;
  box.style.display = text ? 'block' : 'none';
}


/* ==========================================
   DELETE PRODUCT
========================================== */

async function deleteProduct(id) {

  const product = productState.products.find(
    p => p._id === id
  );

  const approved = await adminPopup({
    title: 'Disable Product?',
    message:
      'Are you sure you want to disable ' +
      (product?.name || 'this product') +
      '?',
    confirmText: 'Disable',
    danger: true
  });

  if (!approved) return;

  try {

    await window.MC.api(
      '/admin/products/' + id,
      {
        method: 'DELETE'
      }
    );

    window.MC.toast(
      'Product disabled successfully.',
      'success'
    );

    await loadProducts();

  } catch (error) {

    window.MC.toast(
      error.message,
      'error'
    );

  }

}


/* ==========================================
   VARIANT (SIZE / COLOUR) ROWS
========================================== */

function variantRowHtml(v) {
  const e = window.MC.esc;
  return `<div class="variant-row" data-id="${e(v._id || '')}" style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap">
    <input class="input v-label" placeholder="Option (e.g. Large / Red)" value="${e(v.label || '')}" style="flex:2;min-width:140px">
    <input class="input v-price" type="number" min="0" placeholder="Price (optional)" value="${v.price ?? ''}" style="flex:1;min-width:100px">
    <input class="input v-mrp" type="number" min="0" placeholder="MRP (optional)" value="${v.originalPrice ?? ''}" style="flex:1;min-width:100px">
    <input class="input v-stock" type="number" min="0" step="1" placeholder="Stock" value="${v.stock ?? ''}" style="flex:1;min-width:80px">
    <button type="button" class="btn btn-secondary v-del">Hatao</button>
  </div>`;
}

function syncStockField() {
  const has = document.querySelectorAll('#variantRows .variant-row').length > 0;
  const stock = document.getElementById('stock');
  stock.required = !has;
  stock.readOnly = has;
  if (has) {
    stock.value = [...document.querySelectorAll('#variantRows .v-stock')]
      .reduce((sum, i) => sum + (Number(i.value) || 0), 0);
  }
}

function setVariantRows(list) {
  document.getElementById('variantRows').innerHTML = list.map(variantRowHtml).join('');
  syncStockField();
}

function readVariantRows() {
  return [...document.querySelectorAll('#variantRows .variant-row')].map(row => {
    const out = {
      label: row.querySelector('.v-label').value,
      stock: Number(row.querySelector('.v-stock').value || 0)
    };
    if (row.dataset.id) out._id = row.dataset.id;
    const price = row.querySelector('.v-price').value;
    const mrp = row.querySelector('.v-mrp').value;
    if (price !== '') out.price = Number(price);
    if (mrp !== '') out.originalPrice = Number(mrp);
    return out;
  });
}

document.getElementById('addVariant').onclick = () => {
  document.getElementById('variantRows').insertAdjacentHTML('beforeend', variantRowHtml({}));
  syncStockField();
};

document.getElementById('variantRows').addEventListener('click', e => {
  if (e.target.classList.contains('v-del')) {
    e.target.closest('.variant-row').remove();
    syncStockField();
  }
});

document.getElementById('variantRows').addEventListener('input', syncStockField);


/* ==========================================
   CLEAR FORM
========================================== */

function clearProductForm() {

  window.MC.$('#productForm').reset();

  window.MC.$('#editId').value = '';

  setVariantRows([]);

}

window.MC.$('#cancelEdit').onclick =
  clearProductForm;


/* ==========================================
   ADD CATEGORY
========================================== */

window.MC.$('#categoryForm').addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    try {

      await window.MC.api(
        '/admin/categories',
        {
          method: 'POST',
          body: JSON.stringify({
            name:
              window.MC.$('#categoryName').value
          })
        }
      );

      event.currentTarget.reset();

      await loadProducts();

      window.MC.toast(
        'Category added successfully.',
        'success'
      );

    } catch (error) {

      window.MC.toast(
        error.message,
        'error'
      );

    }

  }
);


/* ==========================================
   INITIAL LOAD
========================================== */

loadProducts().catch(error => {

  window.MC.toast(
    error.message || 'Products load failed.',
    'error'
  );

});
