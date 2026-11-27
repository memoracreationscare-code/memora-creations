'use strict';

/*
  Price-drop email for Wishlist products.

  - First time a saved product is seen we only remember its price (no email).
  - If the price later falls by at least 3% AND Rs 10, the customer gets one
    email (several products are put in the same email) and the new price is
    remembered. A price that goes up is remembered silently, so a later fall
    is measured from the higher price.
  - Needs: "Email the customer on every order update" ON, the
    "Wishlist cheaper" switch ON, and the email service set up.
  - Small batches; a failed send keeps the old price so it is tried again.
*/

const MIN_PERCENT = 0.03;
const MIN_RUPEES = 10;
const MAX_LISTS = 40;
const MAX_PRODUCTS = 5;

function defaultDeps() {
  const models = require('../models');

  return {
    Wishlist: models.Wishlist,
    Product: models.Product,
    User: models.User,
    settings: require('./settingsService'),
    mail: require('./mailService'),
    templates: require('../utils/emailTemplates')
  };
}

function isDrop(oldPrice, newPrice) {
  const diff = oldPrice - newPrice;

  return diff >= MIN_RUPEES && diff >= oldPrice * MIN_PERCENT;
}

async function sweepPriceDrops(deps = defaultDeps()) {
  const { Wishlist, Product, User, settings, mail, templates } = deps;
  const s = settings.peek();
  const result = { sent: 0, failed: 0 };

  if (!s.emailNotificationsEnabled || s.priceDropEmailEnabled === false || !mail.mailConfigured()) return result;

  const lists = await Wishlist.find({ 'products.0': { $exists: true } })
    .select('+seenPrices user products').sort({ updatedAt: -1 }).limit(MAX_LISTS).lean();

  if (!lists.length) return result;

  const ids = [...new Set(lists.flatMap(l => l.products.map(String)))];
  const products = await Product.find({ _id: { $in: ids }, isActive: true })
    .select('name sellingPrice').lean();
  const byId = new Map(products.map(p => [String(p._id), p]));

  for (const list of lists) {
    const seen = list.seenPrices || {};
    const next = {};
    const drops = [];

    for (const pid of list.products.map(String)) {
      const p = byId.get(pid);

      if (!p || !(Number(p.sellingPrice) > 0)) continue;

      const price = Number(p.sellingPrice);
      const old = Number(seen instanceof Map ? seen.get(pid) : seen[pid]);

      if (!(old > 0)) { next[pid] = price; continue; }
      if (isDrop(old, price)) { drops.push({ name: p.name, oldPrice: old, newPrice: price, pid }); continue; }

      next[pid] = price;
    }

    let sent = false;

    if (drops.length) {
      const user = await User.findOne({ _id: list.user, isActive: true, 'parentConsent.required': { $ne: true }, email: { $exists: true, $ne: '' } })
        .select('fullName email').lean();

      if (user && user.email) {
        try {
          const message = templates.priceDropEmail(user, drops.slice(0, MAX_PRODUCTS));

          await mail.sendMail({ to: user.email, subject: message.subject, html: message.html });
          result.sent += 1;
          sent = true;
        } catch (err) {
          result.failed += 1;
          console.warn('[Price drop]', err.message);
        }
      } else {
        sent = true; // nobody to email: just remember the new price
      }

      for (const d of drops) {
        if (sent) next[d.pid] = d.newPrice;
        else next[d.pid] = d.oldPrice;
      }
    }

    const changed = Object.keys(next).length !== Object.keys(seen instanceof Map ? Object.fromEntries(seen) : seen).length ||
      Object.entries(next).some(([k, v]) => Number((seen instanceof Map ? seen.get(k) : seen[k])) !== v);

    if (changed) await Wishlist.updateOne({ _id: list._id }, { $set: { seenPrices: next } });
  }

  return result;
}

module.exports = { sweepPriceDrops, isDrop };
