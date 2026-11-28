'use strict';

/*
  GET /api/admin/connections

  Really asks Shiprocket and Cashfree "are my keys accepted?" and reads the
  Shiprocket wallet. Read-only: it creates, changes and charges nothing, and
  never sends a key, password or token back to the browser.
*/

const { asyncHandler, ok } = require('../utils/http');

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('Jawab nahi aaya (timeout).')), ms))
]);

const walletOf = data => {
  const raw =
    data?.data?.balance_amount ?? data?.balance_amount ??
    data?.data?.balance ?? data?.balance ?? null;
  const n = raw === null ? NaN : Number(raw);

  return Number.isFinite(n) ? n : null;
};

async function checkShiprocket(sr, lowBalance) {
  if (!sr.configured()) {
    return { id: 'shiprocket', level: 'bad', title: 'Shiprocket', detail: 'Login Render me set nahi hai.' };
  }

  try {
    const balance = walletOf(await withTimeout(sr.getWalletBalance(), 20000));

    if (balance === null) {
      return { id: 'shiprocket', level: 'ok', title: 'Shiprocket', detail: 'Login sahi hai (wallet balance padh nahi paya).', balance: null };
    }

    if (lowBalance > 0 && balance < lowBalance) {
      return {
        id: 'shiprocket', level: 'bad', title: 'Shiprocket wallet kam hai', balance,
        detail: `Balance ₹${balance} hai (alert limit ₹${lowBalance}). Shiprocket me paisa daalein, warna shipment nahi banegi.`
      };
    }

    return { id: 'shiprocket', level: 'ok', title: 'Shiprocket', balance, detail: `Login sahi hai. Wallet balance ₹${balance}.` };
  } catch (err) {
    return { id: 'shiprocket', level: 'bad', title: 'Shiprocket', detail: 'Judne me dikkat: ' + String(err.message || 'unknown').slice(0, 160) };
  }
}

async function checkCashfree(cf) {
  try {
    const { status, env } = await withTimeout(cf.pingCashfree(), 20000);
    const mode = env === 'production' ? 'asli (production)' : 'TEST (sandbox)';

    if (status === 401 || status === 403) {
      return { id: 'cashfree', level: 'bad', title: 'Cashfree', detail: `Keys Cashfree ne nahi maani (${mode} mode). Render me CASHFREE_CLIENT_ID / SECRET aur CASHFREE_ENV match karte hain ya nahi dekhein.` };
    }

    if (status >= 500) {
      return { id: 'cashfree', level: 'warn', title: 'Cashfree', detail: 'Cashfree abhi jawab nahi de raha, thodi der baad dekhein.' };
    }

    return {
      id: 'cashfree', level: env === 'production' ? 'ok' : 'warn', title: 'Cashfree',
      detail: env === 'production' ? 'Keys sahi hain, asli (production) mode.' : 'Keys sahi hain, par TEST (sandbox) mode: asli paisa nahi katega.'
    };
  } catch (err) {
    const notSet = err && err.statusCode === 503;

    return {
      id: 'cashfree', level: 'bad', title: 'Cashfree',
      detail: notSet ? 'Cashfree keys Render me set nahi hain.' : 'Judne me dikkat: ' + String(err.message || 'unknown').slice(0, 160)
    };
  }
}

async function checkMail(mail, fetchFn = fetch) {
  const which = mail.provider();

  if (!which) {
    return {
      id: 'mail', level: 'bad', title: 'Email (customer ko mail)',
      detail: 'Email service juda hi nahi hai: koi bhi mail (order, birthday, offer, password link) nahi jaa rahi. Keys & Connections me Brevo API key aur bhejne wala email daalein.'
    };
  }

  if (which === 'brevo') {
    try {
      const r = await fetchFn('https://api.brevo.com/v3/account', {
        headers: { 'api-key': process.env.BREVO_API_KEY, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000)
      });

      if (r.status === 401 || r.status === 403) {
        return { id: 'mail', level: 'bad', title: 'Email (Brevo)', detail: 'Brevo ne API key nahi maani. Nayi key banakar Keys & Connections me daalein.' };
      }

      if (!r.ok) return { id: 'mail', level: 'warn', title: 'Email (Brevo)', detail: 'Brevo abhi jawab nahi de raha, thodi der baad dekhein.' };
    } catch (_) {
      return { id: 'mail', level: 'warn', title: 'Email (Brevo)', detail: 'Brevo tak pahunch nahi paye, thodi der baad dekhein.' };
    }
  }

  return {
    id: 'mail', level: 'ok', title: `Email (${which === 'brevo' ? 'Brevo' : 'Resend'})`,
    detail: 'Key sahi hai. "Test email bhejo" se ek asli mail bhejkar pakka kar lein (sender email verified hona chahiye).'
  };
}

async function gather({
  sr = require('../services/shiprocketService'),
  cf = require('../services/cashfreeService'),
  settings = require('../services/settingsService'),
  mail = require('../services/mailService')
} = {}) {
  const low = Number(settings.peek().shiprocketLowBalance) || 0;
  const checks = await Promise.all([checkShiprocket(sr, low), checkCashfree(cf), checkMail(mail)]);

  return {
    checks,
    summary: { bad: checks.filter(c => c.level === 'bad').length, warn: checks.filter(c => c.level === 'warn').length }
  };
}

const live = asyncHandler(async (_req, res) => ok(res, await gather()));

function explainMailError(err) {
  const raw = String((err && err.message) || 'unknown').slice(0, 220);
  const low = raw.toLowerCase();
  let hint = '';

  if (/sender|from|not valid|not verified|unverified/.test(low)) {
    hint = 'Brevo me "bhejne wala address" verify nahi hua. Brevo → Senders me use verify karein, aur Keys & Connections me wahi address daalein.';
  } else if (/401|403|unauthor|key not found|invalid.*key|api[- ]?key/.test(low)) {
    hint = 'Brevo ne API key nahi maani. Brevo me nayi key banakar Keys & Connections me daalein.';
  } else if (/timeout|timed out|abort|fetch failed|network/.test(low)) {
    hint = 'Brevo tak pahunch nahi paye. Thodi der baad dobara try karein.';
  }

  return ('Email nahi gayi. ' + hint + ' (Detail: ' + raw + ')').replace('  ', ' ');
}

/* POST /api/admin/test-email  { to? }  -> sends one real test mail (to the owner by default) */
const testEmail = asyncHandler(async (req, res) => {
  const { error } = require('../utils/http');
  const mail = require('../services/mailService');
  const asked = String((req.body || {}).to || '').trim();
  const to = asked || String((req.admin && req.admin.email) || process.env.ADMIN_ALERT_EMAIL || '').trim();

  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(to)) throw error(400, 'Sahi email address likhein.');
  if (!mail.mailConfigured()) throw error(400, 'Email service juda hi nahi hai. Pehle Brevo API key aur bhejne wala email daalein.');

  try {
    await mail.sendMail({
      to,
      subject: 'Memora Creations: test email',
      html: require('../utils/emailTemplates').shell('Test email ✅', '<p style="margin:0">Ye ek test email hai. Ye mil gayi, matlab aapki website se email theek jaa rahi hai.</p>', null, { preheader: 'Email setup theek chal raha hai.' })
    });
  } catch (err) {
    // 422, not 5xx: the server hides the text of 5xx errors, and the owner needs to read this.
    throw error(422, explainMailError(err));
  }

  return ok(res, { sent: true, to: to.replace(/^(.).*(@.*)$/, '$1***$2'), message: 'Test email bhej di gayi. Inbox (aur spam) dekhein.' });
});

module.exports = { live, gather, checkShiprocket, checkCashfree, checkMail, walletOf, testEmail };
