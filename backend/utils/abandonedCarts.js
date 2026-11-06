'use strict';

/*
=========================================
 MEMORA CREATIONS
 ABANDONED CART LOGIC

 Pure functions (no database access) so
 the rules are easy to read and test.

 A cart counts as "abandoned" when:
 - it still has at least one available
   product,
 - nobody has touched it for at least
   `minHours` hours,
 - it is not older than `maxDays` days,
 - the owner's account is active, and
 - the owner has NOT placed any order
   since the cart was last changed.
=========================================
*/

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const DEFAULT_MIN_HOURS = 2;
const MAX_MIN_HOURS = 168;
const MAX_DAYS = 30;

function clampMinHours(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return DEFAULT_MIN_HOURS;

  return Math.min(Math.max(n, 1), MAX_MIN_HOURS);
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

/**
 * @param {object}   args
 * @param {object[]} args.carts              Cart documents (lean) with `user` and
 *                                           `items[].product` already populated.
 * @param {Map}      args.latestOrderByUser  userId (string) -> Date of the user's
 *                                           most recent order.
 * @param {number}   [args.minHours]
 * @param {Date}     [args.now]
 */
function buildAbandonedCarts({
  carts,
  latestOrderByUser,
  minHours = DEFAULT_MIN_HOURS,
  now = new Date()
}) {
  const hours = clampMinHours(minHours);
  const newest = now.getTime() - hours * HOUR_MS;
  const oldest = now.getTime() - MAX_DAYS * DAY_MS;

  const result = [];

  for (const cart of carts || []) {
    const user = cart.user;

    if (!user || user.isActive === false) continue;

    const touchedAt = new Date(cart.updatedAt).getTime();

    if (!Number.isFinite(touchedAt)) continue;
    if (touchedAt > newest || touchedAt < oldest) continue;

    const lastOrder = latestOrderByUser?.get(String(user._id));

    if (lastOrder && new Date(lastOrder).getTime() >= touchedAt) continue;

    const items = (cart.items || [])
      .filter(item => item.product && item.product.isActive)
      .map(item => {
        const price = Number(item.product.sellingPrice) || 0;

        return {
          name: item.product.name,
          quantity: item.quantity,
          price,
          lineTotal: roundMoney(price * item.quantity),
          inStock: Number(item.product.stock) > 0
        };
      });

    if (!items.length) continue;

    result.push({
      cartId: String(cart._id),
      userId: String(user._id),
      fullName: user.fullName || '',
      mobile: user.mobile || '',
      items,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      total: roundMoney(items.reduce((sum, i) => sum + i.lineTotal, 0)),
      lastUpdated: new Date(touchedAt).toISOString(),
      hoursAgo: Math.floor((now.getTime() - touchedAt) / HOUR_MS)
    });
  }

  return result.sort(
    (a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated)
  );
}

module.exports = {
  buildAbandonedCarts,
  clampMinHours,
  DEFAULT_MIN_HOURS,
  MAX_DAYS
};
