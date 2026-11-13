/*
  Welcome voice — says "Welcome to Memora Creations" when a customer LOGS IN.

  auth.js fires the `mc:login-success` event right after a successful login.
  The customer has just pressed the Login button, so the browser allows sound.
  The "Login Successful" popup stays open until they tap Continue, so the
  voice is not cut off by the page change.

  Voice source (first that works):
    1. frontend/audio/welcome.mp3   <- drop an AI-made voice file here
    2. the phone/computer's own voice (Web Speech) as a fallback
*/
(function () {
  'use strict';

  const FILE = '/frontend/audio/welcome.mp3?v=1';
  const TEXT = 'Welcome to Memora Creations';
  let busy = false;

  function speak() {
    if (!('speechSynthesis' in window)) return false;
    try {
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
      return true;
    } catch (e) {
      return false;
    }
  }

  function play() {
    if (busy) return;
    busy = true;
    setTimeout(() => { busy = false; }, 4000);

    let fellBack = false;
    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      speak();
    };

    const audio = new Audio(FILE);
    audio.volume = 0.9;
    audio.addEventListener('error', fallback);
    const p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(fallback);
  }

  window.addEventListener('mc:login-success', play);
})();
