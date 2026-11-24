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

async function gather({
  sr = require('../services/shiprocketService'),
  cf = require('../services/cashfreeService'),
  settings = require('../services/settingsService')
} = {}) {
  const low = Number(settings.peek().shiprocketLowBalance) || 0;
  const checks = await Promise.all([checkShiprocket(sr, low), checkCashfree(cf)]);

  return {
    checks,
    summary: { bad: checks.filter(c => c.level === 'bad').length, warn: checks.filter(c => c.level === 'warn').length }
  };
}

const live = asyncHandler(async (_req, res) => ok(res, await gather()));

module.exports = { live, gather, checkShiprocket, checkCashfree, walletOf };
