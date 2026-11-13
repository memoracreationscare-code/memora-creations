'use strict';

/*
  POST /api/chat   { messages: [{role:'user'|'assistant', content:'...'}] }
  Switched on/off from Admin -> Store Settings. Needs ANTHROPIC_API_KEY on Render.
*/

const FALLBACK = 'Abhi chat available nahi hai. Kripya WhatsApp par Memora team se baat karein.';

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
  const apiKey = deps.apiKey !== undefined ? deps.apiKey : process.env.ANTHROPIC_API_KEY;

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
      model: process.env.CHAT_MODEL || 'claude-haiku-5-5',
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

    console.error('[Chat]', err.message);
    return res.status(502).json({ success: false, message: FALLBACK });
  }
}

module.exports = { chat, resetDailyCount };
