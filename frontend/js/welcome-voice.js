/*
  Welcome voice — plays "Welcome to Memora Creations" ONCE per visitor.

  Browsers block sound until the visitor touches the page, so we wait for the
  first tap / click / key press and play then. The visitor is marked as
  "welcomed" only after the sound really started, so it never repeats.

  Voice source (first that works):
    1. frontend/audio/welcome.mp3   <- drop an AI-made voice file here
    2. the phone/computer's own voice (Web Speech) as a fallback
*/
(function () {
  'use strict';

  const KEY = 'mc_welcome_voice_v1';
  const FILE = '/memora-creations/frontend/audio/welcome.mp3?v=1';
  const TEXT = 'Welcome to Memora Creations';
  const SKIP = /\/(checkout|login|signup|forgot-password|reset-password)\.html/;

  function seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function mark() { try { localStorage.setItem(KEY, '1'); } catch (e) { /* private mode */ } }

  if (seen() || SKIP.test(location.pathname)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let started = false;

  function speak() {
    if (!('speechSynthesis' in window)) return false;
    const say = () => {
      const u = new SpeechSynthesisUtterance(TEXT);
      const voices = speechSynthesis.getVoices();
      const pick =
        voices.find(v => /en[-_]IN/i.test(v.lang) && /female|heera|neerja|google/i.test(v.name)) ||
        voices.find(v => /en[-_]IN/i.test(v.lang)) ||
        voices.find(v => /^en/i.test(v.lang) && /female|zira|samantha|google/i.test(v.name));
      if (pick) u.voice = pick;
      u.lang = (pick && pick.lang) || 'en-IN';
      u.rate = 0.92;
      u.pitch = 1.05;
      u.volume = 0.9;
      speechSynthesis.speak(u);
    };
    try { say(); return true; } catch (e) { return false; }
  }

  function play() {
    if (started) return;
    started = true;
    ['pointerdown', 'touchstart', 'keydown'].forEach(e =>
      window.removeEventListener(e, play, true));

    let fellBack = false;
    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      if (speak()) mark();
    };

    const audio = new Audio(FILE);
    audio.volume = 0.9;
    audio.addEventListener('error', fallback);
    const p = audio.play();
    if (p && typeof p.then === 'function') p.then(mark).catch(fallback);
  }

  ['pointerdown', 'touchstart', 'keydown'].forEach(e =>
    window.addEventListener(e, play, { capture: true, passive: true }));
})();
