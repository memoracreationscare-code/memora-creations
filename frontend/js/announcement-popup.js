
/*
=========================================
 MEMORA CREATIONS
 CUSTOMER ANNOUNCEMENT POPUP

 FEATURES:
 - Loads announcement from backend
 - Shows popup on homepage visit
 - Admin-controlled ON/OFF
 - Admin-controlled title and message
 - Close button
 - Mobile responsive
 - Safe text rendering
 - No payment/order modifications
=========================================
*/

(function () {
  'use strict';

  const API_URL =
    'https://memora-creations.onrender.com/api/announcement';

  let overlay = null;

  function removePopup() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }

    document.body.classList.remove(
      'mc-announcement-open'
    );

    document.removeEventListener(
      'keydown',
      handleEscape
    );
  }

  function handleEscape(event) {
    if (event.key === 'Escape') {
      removePopup();
    }
  }

  function addStyles() {
    if (
      document.getElementById(
        'mcAnnouncementStyles'
      )
    ) {
      return;
    }

    const style =
      document.createElement('style');

    style.id = 'mcAnnouncementStyles';

    style.textContent = `
      .mc-announcement-open {
        overflow: hidden !important;
      }

      .mc-announcement-overlay {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(24, 16, 12, .68);
        backdrop-filter: blur(5px);
      }

      .mc-announcement-popup {
        position: relative;
        width: min(100%, 460px);
        max-height: calc(100dvh - 36px);
        overflow-y: auto;
        background: #fffaf6;
        color: #302117;
        border-radius: 22px;
        box-shadow:
          0 24px 75px rgba(0, 0, 0, .27);
        padding: 34px 25px 26px;
        text-align: center;
        animation:
          mcAnnouncementEnter .3s ease-out;
      }

      .mc-announcement-icon {
        width: 67px;
        height: 67px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
        border-radius: 20px;
        background: #f1e1d2;
        font-size: 32px;
      }

      .mc-announcement-brand {
        margin-bottom: 12px;
        color: #946343;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 2px;
      }

      .mc-announcement-title {
        margin: 0 0 16px;
        color: #302117;
        font-size: clamp(22px, 5vw, 29px);
        line-height: 1.3;
        font-weight: 900;
        overflow-wrap: anywhere;
      }

      .mc-announcement-message {
        margin: 0 0 25px;
        color: #68574a;
        font-size: 15px;
        line-height: 1.8;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      .mc-announcement-close {
        display: block;
        width: 100%;
        padding: 15px 18px;
        border: 0;
        border-radius: 12px;
        background: #302117;
        color: white;
        font-size: 15px;
        font-weight: 800;
        cursor: pointer;
        transition: background .2s;
      }

      .mc-announcement-close:hover {
        background: #946343;
      }

      .mc-announcement-close:focus-visible {
        outline: 3px solid #b98b68;
        outline-offset: 3px;
      }

      @keyframes mcAnnouncementEnter {
        from {
          opacity: 0;
          transform: translateY(18px) scale(.97);
        }

        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @media (max-width: 480px) {
        .mc-announcement-overlay {
          padding: 14px;
        }

        .mc-announcement-popup {
          padding: 28px 19px 21px;
          border-radius: 18px;
        }

        .mc-announcement-message {
          font-size: 14px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .mc-announcement-popup {
          animation: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function makeElement(
    tag,
    className,
    text
  ) {
    const element =
      document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = String(text);
    }

    return element;
  }

  function showPopup(announcement) {
    if (overlay) return;

    addStyles();

    overlay = makeElement(
      'div',
      'mc-announcement-overlay'
    );

    const popup = makeElement(
      'section',
      'mc-announcement-popup'
    );

    popup.setAttribute(
      'role',
      'dialog'
    );

    popup.setAttribute(
      'aria-modal',
      'true'
    );

    popup.setAttribute(
      'aria-labelledby',
      'mcAnnouncementHeading'
    );

    popup.setAttribute(
      'aria-describedby',
      'mcAnnouncementDescription'
    );

    const icon = makeElement(
      'div',
      'mc-announcement-icon',
      '📢'
    );

    icon.setAttribute(
      'aria-hidden',
      'true'
    );

    const brand = makeElement(
      'div',
      'mc-announcement-brand',
      'MEMORA CREATIONS'
    );

    const title = makeElement(
      'h2',
      'mc-announcement-title',
      announcement.title
    );

    title.id = 'mcAnnouncementHeading';

    const message = makeElement(
      'p',
      'mc-announcement-message',
      announcement.message
    );

    message.id =
      'mcAnnouncementDescription';

    const closeButton = makeElement(
      'button',
      'mc-announcement-close',
      'Close'
    );

    closeButton.type = 'button';

    closeButton.addEventListener(
      'click',
      removePopup
    );

    popup.append(
      icon,
      brand,
      title,
      message,
      closeButton
    );

    overlay.appendChild(popup);

    document.body.appendChild(overlay);

    document.body.classList.add(
      'mc-announcement-open'
    );

    document.addEventListener(
      'keydown',
      handleEscape
    );

    closeButton.focus();
  }

  async function loadAnnouncement() {
    try {
      const response = await fetch(
        API_URL,
        {
          method: 'GET',
          credentials: 'omit',
          cache: 'no-store',
          headers: {
            Accept: 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(
          'Announcement API: ' +
          response.status
        );
      }

      const data = await response.json();

      const announcement =
        data && data.announcement;

      if (
        !data.success ||
        !announcement ||
        announcement.enabled !== true
      ) {
        return;
      }

      const title = String(
        announcement.title || ''
      ).trim();

      const message = String(
        announcement.message || ''
      ).trim();

      if (!title || !message) {
        return;
      }

      showPopup({
        title,
        message
      });

    } catch (error) {
      /*
        Announcement errors must never
        prevent customers from using
        the website.
      */

      console.warn(
        'Announcement unavailable:',
        error
      );
    }
  }

  function start() {
    loadAnnouncement();
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      start,
      { once: true }
    );
  } else {
    start();
  }

})();
