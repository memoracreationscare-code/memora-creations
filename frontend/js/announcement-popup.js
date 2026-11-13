
/*
  MEMORA CREATIONS
  HOMEPAGE WELCOME / ANNOUNCEMENT POPUP

  - Only on homepage
  - Once per announcement per browser
  - Refresh will not repeat it
  - New admin announcement can appear once
  - Safe if API or storage is unavailable
*/

(() => {
  'use strict';

  const API_URL =
    'https://memora-creations.onrender.com/api/announcement';

  const STORAGE_KEY = 'memora_seen_announcement_v2';

  let overlay = null;
  let started = false;
  let currentKey = '';

  function isHomePage() {
    const path = window.location.pathname
      .replace(/\/+$/, '/')
      .toLowerCase();

    return (
      path === '/' ||
      path === '/frontend/index.html' ||
      path === '/' ||
      path === '/frontend/index.html'
    );
  }

  function getSeenKey() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return window.__memoraSeenAnnouncement || '';
    }
  }

  function markSeen(key) {
    window.__memoraSeenAnnouncement = key;

    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch (_) {
      // Storage blocked: fall back to current page.
    }
  }

  function closePopup() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }

    document.body.classList.remove('mc-announcement-open');

    document.removeEventListener('keydown', onKeyDown);
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      closePopup();
    }
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;

    if (text !== undefined) {
      element.textContent = String(text);
    }

    return element;
  }

  function installStyles() {
    if (document.getElementById('mcAnnouncementStyles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'mcAnnouncementStyles';

    style.textContent = `
      body.mc-announcement-open {
        overflow: hidden !important;
      }

      .mc-announcement-overlay {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(24, 16, 12, .68);
        backdrop-filter: blur(5px);
      }

      .mc-announcement-popup {
        position: relative;
        width: min(100%, 460px);
        max-height: calc(100dvh - 32px);
        overflow-y: auto;
        background: #fffaf6;
        color: #302117;
        border-radius: 22px;
        padding: 30px 24px 24px;
        text-align: center;
        box-shadow: 0 24px 75px rgba(0,0,0,.27);
        animation: mcWelcomeEnter .25s ease-out;
      }

      .mc-announcement-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        margin: 0 auto 18px;
        border-radius: 18px;
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
        font-size: clamp(22px,5vw,29px);
        line-height: 1.3;
        overflow-wrap: anywhere;
      }

      .mc-announcement-message {
        margin: 0 0 24px;
        color: #68574a;
        font-size: 15px;
        line-height: 1.7;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      .mc-announcement-close {
        width: 100%;
        min-height: 46px;
        padding: 13px 18px;
        border: 0;
        border-radius: 12px;
        background: #302117;
        color: white;
        font-size: 15px;
        font-weight: 800;
        cursor: pointer;
      }

      .mc-announcement-close:hover {
        background: #946343;
      }

      @keyframes mcWelcomeEnter {
        from {
          opacity: 0;
          transform: translateY(15px) scale(.97);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @media (max-width:480px) {
        .mc-announcement-popup {
          padding: 25px 18px 20px;
          border-radius: 18px;
        }

        .mc-announcement-message {
          font-size: 14px;
        }
      }

      @media (prefers-reduced-motion:reduce) {
        .mc-announcement-popup {
          animation: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function showPopup(title, message, key) {
    if (overlay || getSeenKey() === key) return;

    // Record it before opening so refresh does not repeat.
    markSeen(key);
    installStyles();

    overlay = createElement(
      'div',
      'mc-announcement-overlay'
    );

    const popup = createElement(
      'section',
      'mc-announcement-popup'
    );

    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute(
      'aria-labelledby',
      'mcAnnouncementHeading'
    );

    const icon = createElement(
      'div',
      'mc-announcement-icon',
      '📢'
    );

    icon.setAttribute('aria-hidden', 'true');

    const brand = createElement(
      'div',
      'mc-announcement-brand',
      'MEMORA CREATIONS'
    );

    const heading = createElement(
      'h2',
      'mc-announcement-title',
      title
    );

    heading.id = 'mcAnnouncementHeading';

    const description = createElement(
      'p',
      'mc-announcement-message',
      message
    );

    const close = createElement(
      'button',
      'mc-announcement-close',
      'Continue Shopping'
    );

    close.type = 'button';
    close.addEventListener('click', closePopup);

    popup.append(
      icon,
      brand,
      heading,
      description,
      close
    );

    overlay.appendChild(popup);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        closePopup();
      }
    });

    document.body.appendChild(overlay);
    document.body.classList.add('mc-announcement-open');
    document.addEventListener('keydown', onKeyDown);

    close.focus();
  }

  async function loadAnnouncement() {
    if (!isHomePage()) return;

    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      const announcement = data?.announcement;

      if (
        data?.success !== true ||
        announcement?.enabled !== true
      ) {
        return;
      }

      const title = String(
        announcement.title || ''
      ).trim();

      const message = String(
        announcement.message || ''
      ).trim();

      if (!title || !message) return;

      const version = String(
        announcement.updatedAt || `${title}:${message}`
      );

      const key = `${version}:${title}:${message}`;

      if (getSeenKey() === key) return;

      showPopup(title, message, key);

    } catch (error) {
      console.warn(
        'Welcome announcement unavailable:',
        error
      );
    }
  }

  function start() {
    if (started) return;
    started = true;
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
