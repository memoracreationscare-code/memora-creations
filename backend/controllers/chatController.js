'use strict';

/*
  POST /api/chat   { messages: [{role:'user'|'assistant', content:'...'}] }
  Switched on/off from Admin -> Store Settings. Needs ANTHROPIC_API_KEY on Render.
*/

const FALLBACK = 'Abhi chat available nahi hai. Kripya WhatsApp par Memora team se baat karein.';

/*
  Which AI to use. GEMINI_API_KEY = Google's free tier. ANTHROPIC_API_KEY = Claude (paid).
  If both exist, CHAT_PROVIDER ('gemini' or 'anthropic') decides, else Claude.
*/
function pickProvider(env) {
  const claude = env.ANTHROPIC_API_KEY;
  const gemini = env.GEMINI_API_KEY;
  const use = env.CHAT_PROVIDER === 'gemini' || (!claude && gemini) ? 'gemini' : 'anthropic';

  if (use === 'gemini') {
    return { provider: 'gemini', apiKey: gemini, model: env.CHAT_MODEL || 'gemini-flash-latest' };
  }

  return { provider: 'anthropic', apiKey: claude, model: env.CHAT_MODEL || 'claude-haiku-5-5' };
}

// Global safety valve so a bot/spam wave can never run up a big AI bill.
let day = '';
let used = 0;

function underDailyCap(limit) {
  const today = new Date().toISOString().slice(0, 10);

  if (today !== day) { day = today; used = 0; }

  if (used >= limit) return false;

  used += 1;
  return true;
}

function resetDailyCount() { day = ''; used = 0; }

async function chat(req, res, deps = {}) {
  res.set('Cache-Control', 'no-store');

  const settings = deps.settings || require('../services/settingsService').peek();
  const { apiKey, provider, model } = deps.apiKey !== undefined
    ? { apiKey: deps.apiKey, provider: deps.provider || 'anthropic', model: deps.model || 'm' }
    : pickProvider(process.env);

  if (settings.chatEnabled !== true || !apiKey) {
    return res.status(503).json({ success: false, message: FALLBACK });
  }

  const limit = deps.dailyLimit || Number(process.env.CHAT_DAILY_LIMIT) || 400;

  if (!underDailyCap(limit)) {
    return res.status(429).json({ success: false, message: FALLBACK });
  }

  const agent = deps.agent || require('../services/chatAgent');

  try {
    const text = await agent.reply((req.body || {}).messages, settings, {
      apiKey,
      provider,
      model,
      fetch: deps.fetch || fetch,
      models: deps.models || require('../models'),
      lookupOrder: deps.lookupOrder || require('./trackOrderController').lookupOrder,
      siteUrl: process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.replace(/\/$/, '')
        : 'https://memoracreationscare-code.github.io/memora-creations'
    });

    return res.json({ success: true, reply: text });
  } catch (err) {
    if (err.code === 'EMPTY') {
      return res.status(400).json({ success: false, message: 'Kuch likhiye.' });
    }

    console.error('[Chat]', `${provider}:`, err.message);
    return res.status(502).json({ success: false, message: FALLBACK });
  }
}

/* Plain-language reason for the owner (Admin -> Store Settings -> "AI test karo"). */
function explain(err, provider) {
  const s = err && err.status;
  const name = provider === 'gemini' ? 'Gemini' : 'Claude';

  if (s === 400 || s === 401 || s === 403) return `${name} ne key accept nahi ki. Key dobara copy karke Render me daalein (aage-peeche space na ho), phir redeploy karein.`;
  if (s === 404) return `Model ka naam ${name} ko nahi mila. Render me CHAT_MODEL hata dein ya sahi naam daalein.`;
  if (s === 429) return `${name} ki free limit abhi poori hai. Thodi der baad try karein.`;
  if (s >= 500) return `${name} ka server abhi problem me hai. Thodi der baad try karein.`;

  return 'AI tak pahunch nahi paye: ' + String((err && err.message) || 'unknown').slice(0, 160);
}

async function test(req, res, deps = {}) {
  res.set('Cache-Control', 'no-store');

  const picked = deps.picked || pickProvider(process.env);

  if (!picked.apiKey) {
    return res.json({
      success: true, ok: false, provider: picked.provider,
      message: 'Render me GEMINI_API_KEY (free) ya ANTHROPIC_API_KEY nahi mili. Key daal kar redeploy karein.'
    });
  }

  try {
    const text = await (deps.agent || require('../services/chatAgent')).reply(
      [{ role: 'user', content: 'Say hi in 3 words.' }],
      { ...require('../services/settingsService').peek(), chatEnabled: true },
      {
        apiKey: picked.apiKey, provider: picked.provider, model: picked.model,
        fetch: deps.fetch || fetch, models: deps.models || require('../models'),
        lookupOrder: async () => null, siteUrl: ''
      }
    );

    return res.json({ success: true, ok: true, provider: picked.provider, model: picked.model, message: 'AI chal raha hai ✔ Jawab: ' + text.slice(0, 80) });
  } catch (err) {
    console.error('[Chat test]', err.message);
    return res.json({ success: true, ok: false, provider: picked.provider, model: picked.model, message: explain(err, picked.provider) });
  }
}

module.exports = { chat, test, explain, resetDailyCount, pickProvider };
