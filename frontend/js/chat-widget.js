/*
  "Ask Memora" chat widget. Loaded by extras.js ONLY when the owner has
  switched the AI chat ON in Admin -> Store Settings.
  Text is always inserted with textContent (never innerHTML).
*/
(() => {
  'use strict';

  if (window.__mcChat) return;
  window.__mcChat = true;

  const MC = window.MC;
  const wa = (window.__mcChatWhatsapp || '').replace(/\D/g, '');

  const css = document.createElement('style');
  css.textContent = `
  .mcc-btn{position:fixed;left:16px;bottom:20px;z-index:900;display:flex;align-items:center;gap:8px;border:0;cursor:pointer;background:#805137;color:#fff;font:800 14px/1 inherit;font-family:inherit;padding:13px 18px;border-radius:999px;box-shadow:0 8px 22px rgba(60,35,20,.35);transition:transform .2s}
  .mcc-btn:hover{transform:translateY(-2px)}
  .mcc-btn svg{width:20px;height:20px;fill:#fff}
  .mcc-panel{position:fixed;left:16px;bottom:20px;z-index:2147483000;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100dvh - 40px));display:none;flex-direction:column;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.35);font-family:inherit}
  .mcc-panel.open{display:flex;animation:mccIn .25s ease}
  @keyframes mccIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .mcc-head{background:#805137;color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}
  .mcc-head b{font-size:16px;display:block}
  .mcc-head small{opacity:.85;font-size:12px}
  .mcc-av{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;font-size:20px;flex:none}
  .mcc-x{margin-left:auto;border:0;background:rgba(255,255,255,.18);color:#fff;width:34px;height:34px;border-radius:50%;font-size:20px;cursor:pointer}
  .mcc-body{flex:1;overflow-y:auto;padding:14px;background:#faf6f0;display:flex;flex-direction:column;gap:10px}
  .mcc-m{max-width:86%;padding:10px 13px;border-radius:16px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
  .mcc-m.bot{background:#fff;color:#241c16;border:1px solid #eee2d3;border-bottom-left-radius:5px;align-self:flex-start}
  .mcc-m.me{background:#805137;color:#fff;border-bottom-right-radius:5px;align-self:flex-end}
  .mcc-m a{color:inherit;font-weight:700;text-decoration:underline}
  .mcc-chips{display:flex;flex-wrap:wrap;gap:8px}
  .mcc-chips button{border:1.5px solid #d9c3a8;background:#fff;color:#5a3a24;border-radius:999px;padding:8px 12px;font:700 13px/1 inherit;font-family:inherit;cursor:pointer}
  .mcc-dots{display:inline-flex;gap:4px}
  .mcc-dots i{width:7px;height:7px;border-radius:50%;background:#b79a7e;animation:mccB 1s infinite}
  .mcc-dots i:nth-child(2){animation-delay:.15s}.mcc-dots i:nth-child(3){animation-delay:.3s}
  @keyframes mccB{0%,60%,100%{opacity:.3}30%{opacity:1}}
  .mcc-form{display:flex;gap:8px;padding:10px;border-top:1px solid #eee2d3;background:#fff}
  .mcc-form input{flex:1;min-width:0;border:1.5px solid #e2d5c6;border-radius:12px;padding:11px 12px;font:15px inherit;font-family:inherit}
  .mcc-form button{border:0;background:#805137;color:#fff;border-radius:12px;padding:0 16px;font:800 14px inherit;font-family:inherit;cursor:pointer}
  .mcc-form button:disabled{opacity:.5}
  .mcc-foot{text-align:center;font-size:11.5px;color:#8a7a6a;padding:0 10px 9px;background:#fff}
  .mcc-foot a{color:#805137;font-weight:700}
  @media(max-width:768px){
    .mcc-btn{left:12px;bottom:100px;padding:12px 15px}
    .mcc-panel{left:0;right:0;bottom:0;width:100%;height:82dvh;border-radius:20px 20px 0 0}
  }
  @media print{.mcc-btn,.mcc-panel{display:none}}
  `;
  document.head.appendChild(css);

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  const btn = el('button', 'mcc-btn');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Ask Memora');
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg><span>Ask Memora</span>';

  const panel = el('div', 'mcc-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Ask Memora');

  const head = el('div', 'mcc-head');
  const av = el('div', 'mcc-av', '🌸');
  const hd = el('div');
  hd.append(el('b', '', 'Ask Memora'), el('small', '', 'Product, delivery aur order ke sawal'));
  const x = el('button', 'mcc-x', '×');
  x.type = 'button';
  x.setAttribute('aria-label', 'Band karein');
  head.append(av, hd, x);

  const body = el('div', 'mcc-body');
  const form = el('form', 'mcc-form');
  const input = el('input');
  input.type = 'text';
  input.maxLength = 500;
  input.placeholder = 'Apna sawal likhein…';
  input.autocomplete = 'off';
  const send = el('button', '', 'Bhejein');
  send.type = 'submit';
  form.append(input, send);

  const foot = el('div', 'mcc-foot');
  foot.append('AI assistant galti kar sakta hai. ');
  if (wa) {
    const a = el('a', '', 'WhatsApp par team se baat karein');
    a.href = 'https://wa.me/' + wa;
    a.target = '_blank';
    a.rel = 'noopener';
    foot.append(a);
  }

  panel.append(head, body, form, foot);
  document.body.append(btn, panel);

  const history = [];
  let busy = false;

  /* turn only https links into anchors; everything else stays plain text */
  function fill(node, text) {
    const parts = String(text).split(/(https:\/\/[^\s)]+)/g);
    parts.forEach(part => {
      if (/^https:\/\/[^\s)]+$/.test(part)) {
        const a = document.createElement('a');
        a.href = part;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = part.replace(/^https:\/\//, '').slice(0, 42) + (part.length > 50 ? '…' : '');
        node.append(a);
      } else if (part) {
        node.append(part);
      }
    });
  }

  function add(role, text) {
    const m = el('div', 'mcc-m ' + role);
    if (role === 'bot') fill(m, text); else m.textContent = text;
    body.append(m);
    body.scrollTop = body.scrollHeight;
    return m;
  }

  function greet() {
    add('bot', 'Namaste! 🌸 Main Memora hu. Product, delivery, return ya apne order ke bare me kuch bhi poochiye.');
    const chips = el('div', 'mcc-chips');
    ['Abhi kaun sa offer chal raha hai?', 'Mere order ka status', 'Delivery charge kitna hai?', 'Gift ke liye kya sahi rahega?', 'Return kaise hota hai?'].slice(0, 4).forEach(t => {
      const b = el('button', '', t);
      b.type = 'button';
      b.addEventListener('click', () => { chips.remove(); ask(t); });
      chips.append(b);
    });
    body.append(chips);
  }

  async function ask(text) {
    text = String(text || '').trim().slice(0, 500);
    if (!text || busy) return;
    busy = true;
    send.disabled = true;
    add('me', text);
    history.push({ role: 'user', content: text });

    const typing = el('div', 'mcc-m bot');
    typing.innerHTML = '<span class="mcc-dots"><i></i><i></i><i></i></span>';
    body.append(typing);
    body.scrollTop = body.scrollHeight;

    try {
      const data = await MC.api('/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: history.slice(-12) })
      });
      typing.remove();
      const reply = data.reply || 'Maaf kijiye, jawab nahi mila.';
      add('bot', reply);
      history.push({ role: 'assistant', content: reply });
    } catch (err) {
      typing.remove();
      add('bot', (err && err.message) || 'Abhi chat available nahi hai. WhatsApp par likhein.');
      history.pop();
    } finally {
      busy = false;
      send.disabled = false;
      input.focus();
    }
  }

  let greeted = false;
  function open() {
    panel.classList.add('open');
    btn.style.display = 'none';
    if (!greeted) { greeted = true; greet(); }
    setTimeout(() => input.focus(), 50);
  }
  function close() {
    panel.classList.remove('open');
    btn.style.display = '';
  }

  btn.addEventListener('click', open);
  x.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = input.value;
    input.value = '';
    ask(v);
  });
})();
