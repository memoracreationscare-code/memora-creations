
/*
==========================================
 MEMORA CREATIONS
 PRODUCT REVIEWS & RATINGS FRONTEND

 VERIFIED PURCHASE
 1-5 STAR RATING
 PHOTO UPLOAD
 APPROVED CUSTOMER REVIEWS
==========================================
*/

(function () {
  'use strict';

  const API =
    'https://memora-creations.onrender.com/api';

  const BASE = '';

  const params = new URLSearchParams(
    window.location.search
  );

  const productId = params.get('id');

  const MAX_PHOTOS = 3;
  const MAX_SIZE = 5 * 1024 * 1024;

  if (!productId || !document.querySelector('#product')) {
    return;
  }

  let selectedRating = 0;
  let selectedPhotos = [];
  let currentPage = 1;

  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char])
    );

  function notify(message, type = 'success') {
    if (window.MC?.toast) {
      window.MC.toast(message, type);
    }
  }

  function makeElement(tag, className, text) {
    const el = document.createElement(tag);

    if (className) {
      el.className = className;
    }

    if (text !== undefined) {
      el.textContent = String(text);
    }

    return el;
  }

  /*
  ==========================================
   CREATE REVIEW SECTION
  ==========================================
  */

  function createSection() {
    const section = document.createElement('section');

    section.id = 'mcProductReviews';

    section.innerHTML = `
      <style>
        #mcProductReviews {
          margin: 38px 0;
          padding: 28px;
          background: #fff;
          border: 1px solid #eadfd5;
          border-radius: 24px;
          color: #302117;
        }

        #mcProductReviews * {
          box-sizing: border-box;
        }

        #mcProductReviews h2 {
          margin: 0 0 8px;
          font-size: 27px;
          color: #302117;
        }

        #mcProductReviews .mc-muted {
          color: #80756d;
          font-size: 14px;
          line-height: 1.6;
        }

        #mcProductReviews .mc-rating-summary {
          display: flex;
          gap: 20px;
          align-items: center;
          flex-wrap: wrap;
          margin: 25px 0;
          padding: 22px;
          background: #faf6f2;
          border-radius: 16px;
        }

        #mcProductReviews .mc-average {
          font-size: 42px;
          font-weight: 900;
        }

        #mcProductReviews .mc-stars {
          color: #e3a32f;
          font-size: 24px;
          letter-spacing: 2px;
        }

        #mcProductReviews .mc-review-form {
          padding: 24px;
          margin: 25px 0;
          border: 1px solid #eadfd5;
          border-radius: 18px;
          background: #fffdfb;
        }

        #mcProductReviews label {
          display: block;
          margin: 14px 0 7px;
          font-weight: 700;
          font-size: 14px;
        }

        #mcProductReviews input[type="text"],
        #mcProductReviews textarea {
          display: block;
          width: 100%;
          padding: 12px 14px;
          border: 1px solid #dacdc0;
          border-radius: 12px;
          font: inherit;
          background: #fff;
        }

        #mcProductReviews textarea {
          min-height: 120px;
          resize: vertical;
        }

        #mcProductReviews .mc-star-buttons {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }

        #mcProductReviews .mc-star-button {
          border: none;
          background: none;
          padding: 5px;
          font-size: 35px;
          cursor: pointer;
          color: #c9c3bc;
        }

        #mcProductReviews .mc-star-button.active {
          color: #e3a32f;
        }

        #mcProductReviews .mc-button {
          padding: 13px 22px;
          background: #8b5b3a;
          border: none;
          color: #fff;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
          margin-top: 15px;
        }

        #mcProductReviews .mc-button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        #mcProductReviews .mc-review-card {
          padding: 20px 0;
          border-bottom: 1px solid #eee3d9;
        }

        #mcProductReviews .mc-review-images {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 12px;
        }

        #mcProductReviews .mc-review-images img {
          width: 105px;
          height: 105px;
          object-fit: cover;
          border-radius: 12px;
          border: 1px solid #eee;
        }

        #mcProductReviews .mc-message {
          padding: 14px;
          margin: 15px 0;
          background: #faf6f2;
          border-radius: 12px;
          line-height: 1.6;
        }

        #mcProductReviews .mc-error {
          color: #b42318;
        }

        #mcProductReviews .mc-verified {
          color: #267247;
          font-size: 12px;
          font-weight: 800;
        }

        @media (max-width: 600px) {
          #mcProductReviews {
            padding: 18px;
          }

          #mcProductReviews h2 {
            font-size: 23px;
          }
        }
      </style>

      <h2>Customer Reviews & Ratings</h2>

      <p class="mc-muted">
        See what verified customers say about this product.
      </p>

      <div id="mcRatingSummary"
        class="mc-rating-summary">
        Loading ratings...
      </div>

      <div id="mcReviewEligibility">
        Checking review eligibility...
      </div>

      <div id="mcReviewFormContainer"></div>

      <h3>Customer Reviews</h3>

      <div id="mcReviewsList">
        Loading reviews...
      </div>

      <button
        id="mcLoadMoreReviews"
        class="mc-button"
        type="button"
        hidden>
        Load More Reviews
      </button>
    `;

    const product = document.querySelector('#product');

    product.insertAdjacentElement(
      'afterend',
      section
    );
  }

  /*
  ==========================================
   STARS
  ==========================================
  */

  function starText(rating) {
    const number = Math.max(
      0,
      Math.min(5, Math.round(Number(rating) || 0))
    );

    return '★'.repeat(number) +
      '☆'.repeat(5 - number);
  }

  function renderStarButtons() {
    const buttons = document.querySelectorAll(
      '#mcProductReviews .mc-star-button'
    );

    buttons.forEach(button => {
      const rating = Number(button.dataset.rating);

      button.classList.toggle(
        'active',
        rating <= selectedRating
      );

      button.setAttribute(
        'aria-pressed',
        String(rating === selectedRating)
      );
    });
  }

  /*
  ==========================================
   PUBLIC REVIEWS
  ==========================================
  */

  async function loadReviews(page = 1) {
    const list = document.querySelector(
      '#mcReviewsList'
    );

    const summary = document.querySelector(
      '#mcRatingSummary'
    );

    const more = document.querySelector(
      '#mcLoadMoreReviews'
    );

    more.hidden = true;

    try {
      const data = await window.MC.api(
        '/reviews/product/' +
        encodeURIComponent(productId) +
        '?page=' + page
      );

      const average = Number(
        data.summary?.averageRating || 0
      );

      const total = Number(
        data.summary?.totalRatings || 0
      );

      summary.innerHTML = `
        <div class="mc-average">
          ${average.toFixed(1)}
        </div>
        <div>
          <div class="mc-stars">
            ${starText(average)}
          </div>
          <div class="mc-muted">
            ${total} verified ratings
          </div>
        </div>
      `;

      if (page === 1) {
        list.replaceChildren();
      }

      const reviews = data.reviews || [];

      if (!reviews.length && page === 1) {
        list.append(
          makeElement(
            'p',
            'mc-message',
            'No reviews yet. Be the first verified buyer to review this product.'
          )
        );
      }

      for (const review of reviews) {
        const card = makeElement(
          'article',
          'mc-review-card'
        );

        const name = makeElement(
          'strong',
          '',
          review.customerName || 'Customer'
        );

        const stars = makeElement(
          'div',
          'mc-stars',
          starText(review.rating)
        );

        const title = makeElement(
          'h4',
          '',
          review.title || 'Product Review'
        );

        const comment = makeElement(
          'p',
          '',
          review.comment || ''
        );

        card.append(name, stars, title, comment);

        if (review.verifiedPurchase) {
          card.append(
            makeElement(
              'div',
              'mc-verified',
              '✓ Verified Purchase'
            )
          );
        }

        const gallery = makeElement(
          'div',
          'mc-review-images'
        );

        for (const url of review.photos || []) {
          if (
            typeof url !== 'string' ||
            !url.startsWith(
              'https://res.cloudinary.com/'
            )
          ) {
            continue;
          }

          const link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';

          const img = document.createElement('img');
          img.src = url;
          img.loading = 'lazy';
          img.alt = 'Customer product photo';

          link.append(img);
          gallery.append(link);
        }

        card.append(gallery);
        list.append(card);
      }

      currentPage = page;

      more.hidden =
        page >= Number(data.pagination?.pages || 0);

    } catch (err) {
      if (page === 1) {
        list.replaceChildren(
          makeElement(
            'p',
            'mc-message mc-error',
            err.message || 'Unable to load reviews.'
          )
        );
      }

      notify(
        err.message || 'Review loading failed.',
        'error'
      );
    }
  }

  /*
  ==========================================
   LOGIN / ELIGIBILITY
  ==========================================
  */

  async function checkEligibility() {
    const box = document.querySelector(
      '#mcReviewEligibility'
    );

    box.textContent = 'Checking purchase eligibility...';

    try {
      const data = await window.MC.api(
        '/reviews/product/' +
        encodeURIComponent(productId) +
        '/eligibility'
      );

      if (!data.eligible) {
        box.replaceChildren(
          makeElement(
            'p',
            'mc-message',
            data.message ||
            'Review available after delivery.'
          )
        );

        return;
      }

      box.textContent =
        '✓ Verified Purchase — You can review this product.';

      showReviewForm();

    } catch (err) {
      if (err.status === 401) {
        const message = makeElement(
          'p',
          'mc-message',
          'Please login to check your review eligibility. '
        );

        const link = document.createElement('a');

        link.href =
          BASE +
          '/frontend/login.html?next=' +
          encodeURIComponent(
            window.location.pathname +
            window.location.search
          );

        link.textContent = 'Login';

        message.append(link);

        box.replaceChildren(message);

      } else {
        box.replaceChildren(
          makeElement(
            'p',
            'mc-message mc-error',
            err.message ||
            'Eligibility check failed.'
          )
        );
      }
    }
  }

  /*
  ==========================================
   REVIEW FORM
  ==========================================
  */

  function showReviewForm() {
    const container = document.querySelector(
      '#mcReviewFormContainer'
    );

    container.innerHTML = `
      <form
        id="mcSubmitReviewForm"
        class="mc-review-form">

        <h3>Write Your Review</h3>

        <label>Your Rating *</label>

        <div class="mc-star-buttons"
          role="group"
          aria-label="Choose a rating">
          ${[1, 2, 3, 4, 5].map(n => `
            <button
              type="button"
              class="mc-star-button"
              data-rating="${n}"
              aria-label="${n} stars"
              aria-pressed="false">
              ★
            </button>
          `).join('')}
        </div>

        <label for="mcReviewTitle">
          Review Title
        </label>

        <input
          id="mcReviewTitle"
          type="text"
          maxlength="120"
          placeholder="Great quality product"
        >

        <label for="mcReviewComment">
          Your Review *
        </label>

        <textarea
          id="mcReviewComment"
          minlength="10"
          maxlength="1500"
          placeholder="Share your experience..."
          required></textarea>

        <label for="mcReviewPhotos">
          Product Photos (Optional, Max 3)
        </label>

        <input
          id="mcReviewPhotos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
        >

        <p class="mc-muted">
          JPG, PNG or WebP. Each photo up to 5 MB.
        </p>

        <div id="mcPhotoSelection"
          class="mc-muted"></div>

        <button
          class="mc-button"
          id="mcSubmitReview"
          type="submit">
          Submit Review
        </button>

        <p id="mcReviewStatus"
          role="status"
          aria-live="polite"></p>

      </form>
    `;

    const form = document.querySelector(
      '#mcSubmitReviewForm'
    );

    form.querySelectorAll('.mc-star-button')
      .forEach(button => {
        button.addEventListener('click', () => {
          selectedRating = Number(
            button.dataset.rating
          );

          renderStarButtons();
        });
      });

    form.querySelector('#mcReviewPhotos')
      .addEventListener('change', event => {

        const files = Array.from(
          event.target.files || []
        );

        if (files.length > MAX_PHOTOS) {
          notify(
            'Maximum 3 photos allowed.',
            'error'
          );

          event.target.value = '';
          selectedPhotos = [];
          return;
        }

        for (const file of files) {
          if (
            ![
              'image/jpeg',
              'image/png',
              'image/webp'
            ].includes(file.type) ||
            file.size > MAX_SIZE
          ) {
            notify(
              'Only JPG, PNG or WebP under 5 MB allowed.',
              'error'
            );

            event.target.value = '';
            selectedPhotos = [];
            return;
          }
        }

        selectedPhotos = files;

        document.querySelector(
          '#mcPhotoSelection'
        ).textContent =
          files.length + ' photos selected.';
      });

    form.addEventListener(
      'submit',
      submitReview
    );
  }

  /*
  ==========================================
   CLOUDINARY PHOTO UPLOAD
  ==========================================
  */

  async function uploadReviewPhoto(file) {
    const data = new FormData();

    data.append('photo', file);

    const response = await fetch(
      API +
      '/reviews/product/' +
      encodeURIComponent(productId) +
      '/photo',
      {
        method: 'POST',
        credentials: 'include',
        body: data
      }
    );

    const result = await response.json()
      .catch(() => ({}));

    if (!response.ok || !result.url) {
      throw new Error(
        result.message || 'Photo upload failed.'
      );
    }

    return result.url;
  }

  /*
  ==========================================
   SUBMIT CUSTOMER REVIEW
  ==========================================
  */

  async function submitReview(event) {
    event.preventDefault();

    const button = document.querySelector(
      '#mcSubmitReview'
    );

    const status = document.querySelector(
      '#mcReviewStatus'
    );

    const title = document.querySelector(
      '#mcReviewTitle'
    ).value.trim();

    const comment = document.querySelector(
      '#mcReviewComment'
    ).value.trim();

    if (
      !Number.isInteger(selectedRating) ||
      selectedRating < 1 ||
      selectedRating > 5
    ) {
      notify('Please select 1 to 5 stars.', 'error');
      return;
    }

    if (comment.length < 10) {
      notify(
        'Review must contain at least 10 characters.',
        'error'
      );
      return;
    }

    button.disabled = true;

    try {
      const photos = [];

      for (let i = 0; i < selectedPhotos.length; i++) {
        status.textContent =
          'Uploading photo ' +
          (i + 1) +
          ' of ' +
          selectedPhotos.length +
          '...';

        const photoUrl = await uploadReviewPhoto(
          selectedPhotos[i]
        );

        photos.push(photoUrl);
      }

      status.textContent = 'Submitting review...';

      await window.MC.api(
        '/reviews/product/' +
        encodeURIComponent(productId),
        {
          method: 'POST',
          body: JSON.stringify({
            rating: selectedRating,
            title,
            comment,
            photos
          })
        }
      );

      document.querySelector(
        '#mcReviewFormContainer'
      ).replaceChildren();

      document.querySelector(
        '#mcReviewEligibility'
      ).replaceChildren(
        makeElement(
          'p',
          'mc-message',
          'Thank you! Your review has been submitted and is waiting for admin approval.'
        )
      );

      notify(
        'Review submitted successfully.',
        'success'
      );

      selectedPhotos = [];
      selectedRating = 0;

      await loadReviews(1);

    } catch (err) {
      status.textContent =
        err.message || 'Review submission failed.';

      notify(
        err.message || 'Review submission failed.',
        'error'
      );

    } finally {
      button.disabled = false;
    }
  }

  /*
  ==========================================
   INITIALIZE REVIEWS
  ==========================================
  */

  async function initReviews() {
    if (!window.MC?.api) {
      console.error(
        'Memora app.js must load before reviews.js'
      );
      return;
    }

    createSection();

    document.querySelector(
      '#mcLoadMoreReviews'
    ).addEventListener('click', () => {
      loadReviews(currentPage + 1);
    });

    await Promise.all([
      loadReviews(1),
      checkEligibility()
    ]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initReviews,
      { once: true }
    );
  } else {
    initReviews();
  }

})();
