
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


  $$('.product-delete').forEach(button => {

    button.onclick = () => {
      deleteProduct(button.dataset.id);
    };

  });

}


/* ==========================================
   EDIT PRODUCT
========================================== */

function editProduct(id) {

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
        'Product saved successfully.',
        'success'
      );

      clearProductForm();

      await loadProducts();

    } catch (error) {

      window.MC.toast(
        error.message,
        'error'
      );

    }
  }
);


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
   CLEAR FORM
========================================== */

function clearProductForm() {

  window.MC.$('#productForm').reset();

  window.MC.$('#editId').value = '';

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
