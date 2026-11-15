'use strict';

/*
  "Ask Memora" instant answers.

  Most customer questions can be answered straight from the shop's own data
  (offers, products, orders, delivery rules). Doing that here is instant, free,
  never "overloaded", and cannot make things up.

  Only READS data. Orders: a logged-in customer sees only their own orders;
  anyone else must give the order number AND checkout mobile (same rule as the
  Track Order page). Anything not recognised returns null so the AI can try.
*/

const agent = require('./chatAgent');

const inr = n => 'Rs ' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const day = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '');
const esc = v => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ORDER_ID = /\bMC-\d{4}-[A-Z0-9]{3,14}\b/i;
const MOBILE = /(?<!\d)[6-9]\d{9}(?!\d)/;

const STOP = new Set(('kya kaun kon kaha kahan kahaan hai hain ho hu hun he mujhe mujhko hume humein chahiye chahie dikhao dikha do de dena dijiye bata batao batana bataiye ' +
  'ke ki ka ko se me mein par pe aur ya ye wo woh yeh koi kuch sab saare sare aap tum mera meri mere apna apni the is it to a an the and or for of in on with me my i want need show tell about please plz pls ' +
  'available milta milte milega milenge hota hote sakte sakta sakti hain price rate kitna kitne kitni rupee rupees rs ka').split(/\s+/));

const has = (t, re) => re.test(t);

/* ---------- intent detection ---------- */

function detect(text) {
  const t = String(text || '').toLowerCase();

  if (has(t, /^\s*(hi+|hello+|hey+|hlo+|namaste|namaskar|hii+|good\s*(morning|afternoon|evening))\W*$/)) return 'greet';
  if (has(t, /^\s*(thanks?|thank\s*you|thx|shukriya|dhanyavaad|dhanyawad|ok(ay)?|theek hai|thik hai|great|nice)\W*$/)) return 'thanks';
  if (ORDER_ID.test(text) || has(t, /\b(order|orders|parcel|shipment|tracking|track|awb|courier)\b.*\b(status|kahan|kaha|kidhar|kab|aayega|pahunch|ship|deliver|track|detail)|\b(status|kahan|kaha|kidhar)\b.*\b(order|parcel|shipment)|mera order|my order|order status|order track|track order|order kaha/)) return 'order';
  if (has(t, /\b(offer|offers|coupon|coupons|discount|discounts|sale|promo|code|chhoot|chhut|cashback|deal|deals|kuch off|off milega|sasta|sasti)\b/)) return 'offers';
  if (has(t, /\b(delivery|shipping|ship|deliver|dispatch)\b.*\b(charge|charges|fee|free|kitne|time|din|days|kab|kitna|available|hota)|delivery charge|free delivery|kitne din|kitne time|kab tak|shipping charge/)) return 'delivery';
  if (has(t, /\b(return|returns|refund|replace|replacement|exchange|wapas|cancel)\b/)) return 'returns';
  if (has(t, /\b(cod|cash on delivery|payment|pay|upi|card|advance)\b/)) return 'payment';
  if (has(t, /\b(whatsapp|contact|call|phone|number|email|address|location|kahan hai|shop|store|owner|support|help|baat)\b/) && !has(t, /\border\b/)) return 'contact';
  if (has(t, /\b(gift wrap|gift wrapping|wrapping|packing)\b/)) return 'giftwrap';
  // "how is it made / why / difference" are explanation questions: leave them to the AI
  if (has(t, /\b(kaise|kaisa|kyu|kyun|kyon|why|how|process|banta|banti|banate|material|made of|difference|farak|care|saaf|clean)\b/)) return null;
  if (has(t, /\b(gift|gifts|present|product|products|item|items|frame|frames|decor|collection|catalog|catalogue|categor|vase|tray|candle|resin|wall|clock|lamp|showpiece|hamper|birthday|anniversary|wedding|marriage|mother|mom|father|dad|couple|girlfriend|boyfriend|wife|husband|sister|brother|friend|diwali|raksha|rakhi|valentine|housewarming|photo|kya kya|kaun kaun|best|popular|bestseller|trending|new|latest)\b/)) return 'products';

  return null;
}

/* ---------- formatters ---------- */

function formatOffers(data) {
  const lines = [];
  const sales = data.offers.filter(o => o.type === 'festival_sale');
  const coupons = data.offers.filter(o => o.type === 'coupon');
  const welcome = data.offers.find(o => o.type === 'first_order_discount');
  const refer = data.offers.find(o => o.type === 'refer_and_earn');
  const free = data.offers.find(o => o.type === 'free_delivery');

  lines.push('Abhi ye offers chal rahe hain 🎁');

  for (const s of sales) {
    lines.push('', `🔥 ${s.name}: ${s.percentOff}% off ${s.productsOnSale} products par (${day(s.endsAt)} tak). Price product page par pehle se kam dikhta hai, code ki zaroorat nahi.`);
  }

  for (const c of coupons) {
    const bits = [c.discount];
    if (c.minOrder) bits.push(`minimum order ${c.minOrder}`);
    if (c.maxDiscount) bits.push(`max discount ${c.maxDiscount}`);
    if (c.firstOrderOnly) bits.push('sirf pehle order par');
    lines.push('', `🏷️ Code ${c.code}: ${bits.join(', ')}. ${day(c.validTill)} tak valid.${c.about ? ' ' + c.about : ''}`);
  }

  if (welcome) lines.push('', `👋 Pehle order par ${welcome.discount} (min order ${welcome.minOrder}), login ke baad.`);
  if (refer) lines.push('', `🤝 Refer & Earn: dost ko ${refer.friendGets}, aapko ${refer.youGet} (min order ${refer.minOrder}). Code Profile page par hai.`);
  if (free) lines.push('', `🚚 ${free.note}`);

  if (!sales.length && !coupons.length && !welcome && !refer) {
    lines.splice(0, 1, 'Abhi koi khaas coupon ya sale nahi chal rahi.');
  }

  lines.push('', 'Coupon Checkout page ke "Coupon" box me daalein.');
  return lines.join('\n');
}

function statusLine(status) {
  switch (status) {
    case 'Order Placed': return 'order mil gaya hai, jaldi confirm hoga';
    case 'Confirmed': return 'confirm ho gaya hai, packing ki taiyari hai';
    case 'Packed': return 'pack ho gaya hai, courier ko dene wale hain';
    case 'Shipped': return 'courier ke saath nikal chuka hai';
    case 'Out for Delivery': return 'aaj delivery ke liye nikla hai';
    case 'Delivered': return 'deliver ho chuka hai';
    case 'Cancelled': return 'cancel ho chuka hai';
    default: return String(status || '');
  }
}

function formatOneOrder(o) {
  const lines = [];
  const items = (o.items || []).map(i => `${i.name} x${i.quantity}`).join(', ');
  lines.push(`📦 Order ${o.orderId}: ${o.status}, ${statusLine(o.status)}.`);
  if (items) lines.push(`Products: ${items}`);

  const a = o.amounts;
  const p = o.payment;
  if (a && a.total != null) {
    let pay = `Total ${inr(a.total)}`;
    if (p && p.method) pay += `, payment ${p.method}${p.status ? ' (' + p.status + ')' : ''}`;
    lines.push(pay);
  }
  if (p && p.codAdvancePaid != null && p.codBalanceDueOnDelivery != null) {
    lines.push(`COD: advance ${inr(p.codAdvancePaid)} mil chuka hai, delivery par ${inr(p.codBalanceDueOnDelivery)} dena hai.`);
  }

  const s = o.shipment;
  if (s && typeof s === 'object') {
    const parts = [s.courier, s.awb ? 'AWB ' + s.awb : '', s.status].filter(Boolean);
    if (parts.length) lines.push(`Courier: ${parts.join(' · ')}`);
    if (s.expectedDelivery) lines.push(`Expected delivery: ${day(s.expectedDelivery)}`);
    if (s.trackingUrl) lines.push(`Track: ${s.trackingUrl}`);
  } else if (!['Delivered', 'Cancelled'].includes(o.status)) {
    lines.push('Abhi courier ko nahi diya gaya, ship hote hi tracking milegi.');
  }

  if (o.returnRequest) lines.push(`Return request: ${o.returnRequest.status}`);
  if (o.refund) lines.push(`Refund: ${o.refund.status}`);
  return lines.join('\n');
}

function formatPublicOrder(r) {
  return formatOneOrder({
    orderId: r.orderId,
    status: r.orderStatus,
    items: r.items,
    shipment: r.shipment
      ? {
        courier: r.shipment.courierName, awb: r.shipment.awbCode, status: r.shipment.status,
        expectedDelivery: r.shipment.estimatedDeliveryDate, trackingUrl: r.shipment.trackingUrl
      }
      : null
  });
}

/* ---------- products ---------- */

const keywordsOf = text => String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));

async function findProducts(text, deps, limit = 6) {
  const { Product } = deps.models;
  const words = keywordsOf(text).filter(w => !/^(gift|gifts|present|product|products|item|items|collection|best|popular|new|latest|trending|bestseller)$/.test(w)).slice(0, 5);
  const pick = 'name sellingPrice originalPrice stock variants images';

  if (words.length) {
    const re = w => ({ $regex: esc(w), $options: 'i' });
    const fields = w => ({ $or: [{ name: re(w) }, { description: re(w) }, { keywords: re(w) }] });

    let rows = await Product.find({ isActive: true, $and: words.map(fields) }).select(pick).limit(limit).lean();
    if (!rows.length) rows = await Product.find({ isActive: true, $or: words.map(fields) }).select(pick).limit(limit).lean();
    if (rows.length) return { rows, matched: true };
  }

  const rows = await Product.find({ isActive: true, stock: { $gt: 0 } }).select(pick).sort({ isBestSeller: -1, isFeatured: -1, createdAt: -1 }).limit(limit).lean();
  return { rows, matched: false };
}

async function categoryNames(deps) {
  const { Category } = deps.models;
  if (!Category) return [];
  const rows = await Category.find({ isActive: true }).select('name').sort({ name: 1 }).limit(30).lean();
  return rows.map(c => c.name);
}

async function answerProducts(text, deps) {
  const [{ rows, matched }, cats] = await Promise.all([findProducts(text, deps), categoryNames(deps).catch(() => [])]);
  const lines = [];
  const wantsList = /kya kya|kaun kaun|kon kon|categor|collection|catalog|sab|saare|sare|all|types?/.test(String(text).toLowerCase());

  if (!rows.length) {
    lines.push('Is naam ka product abhi nahi mila.');
    if (cats.length) lines.push(`Hamare paas ye categories hain: ${cats.join(', ')}.`);
    lines.push(`Poora collection: ${deps.siteUrl}/frontend/products.html`);
    return lines.join('\n');
  }

  if (wantsList && cats.length) lines.push(`Hamare paas ye categories hain: ${cats.join(', ')}.`, '');

  lines.push(matched ? 'Ye products mile 👇' : 'Ye hamare popular products hain 👇');

  for (const p of rows) {
    const inStock = (p.stock || 0) > 0 || (p.variants || []).some(v => v.stock > 0);
    const off = p.originalPrice > p.sellingPrice ? ` (pehle ${inr(p.originalPrice)})` : '';
    lines.push('', `• ${p.name} - ${inr(p.sellingPrice)}${off}${inStock ? '' : ' (abhi stock me nahi)'}`, `  ${deps.siteUrl}/frontend/product.html?id=${p._id}`);
  }

  lines.push('', `Aur dekhne ke liye: ${deps.siteUrl}/frontend/products.html`);
  return lines.join('\n');
}

/* ---------- order ---------- */

function lastMatch(messages, re) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'user') continue;
    const m = String(messages[i].content).match(re);
    if (m) return m[0];
  }
  return null;
}

async function answerOrder(messages, deps) {
  const text = messages[messages.length - 1].content;
  const orderId = (text.match(ORDER_ID) || [])[0] || lastMatch(messages, ORDER_ID);

  if (deps.userId) {
    const r = await agent.myOrders({ orderId: orderId ? orderId.toUpperCase() : undefined }, deps);

    if (!r.found) {
      return orderId
        ? `Aapke account me ${orderId.toUpperCase()} naam ka order nahi mila. Order number dobara check karein, ya jis number se order kiya tha usse "Track Order" page par dekhein.`
        : 'Aapke account me abhi koi order nahi mila.';
    }

    const head = orderId ? '' : (r.orders.length > 1 ? `Aapke last ${r.orders.length} orders:\n\n` : '');
    return head + r.orders.map(formatOneOrder).join('\n\n') + '\n\nAur detail ke liye My Orders page dekhein.';
  }

  const mobile = (text.match(MOBILE) || [])[0] || lastMatch(messages, MOBILE);

  if (orderId && mobile) {
    const found = await deps.lookupOrder(orderId.toUpperCase(), mobile, deps);

    if (!found || found.invalid) {
      return 'Ye details kisi order se match nahi hui. Order number aur checkout par diya hua mobile number dobara check karke bhejiye.';
    }

    return formatPublicOrder(found);
  }

  if (orderId) return `Order ${orderId.toUpperCase()} dekhne ke liye checkout par diya hua 10-digit mobile number bhi bhejiye. Ya login karke My Orders me dekh sakte hain.`;
  if (mobile) return 'Mobile number mil gaya. Ab apna order number bhi bhejiye (jaise MC-2026-ABC123), jo order confirmation me mila tha.';

  return 'Order dekhne ke liye apna order number (jaise MC-2026-ABC123) aur checkout par diya hua mobile number bhejiye. Ya login karke seedha batata hu 😊';
}

/* ---------- shop facts ---------- */

function answerDelivery(s) {
  return [
    `🚚 Delivery charge ${inr(s.deliveryCharge)}; ${inr(s.freeDeliveryAbove)} se upar ke orders par delivery free.`,
    'Order ship hote hi tracking link milta hai. Delivery ka time pincode par depend karta hai, product page par pincode daalke estimate dekh sakte hain.'
  ].join('\n');
}

function answerReturns(s) {
  if (!s.returnsEnabled) return 'Abhi returns accept nahi ho rahe. Zaroorat ho to WhatsApp par team se baat karein.';
  return [
    `↩️ Delivery ke ${s.returnWindowDays} din ke andar return/replacement request daal sakte hain (My Orders page se).`,
    'Shipped hone ke baad order cancel nahi hota. Cancel sirf shipping se pehle possible hai.',
    'Kisi problem me WhatsApp par team se baat karein.'
  ].join('\n');
}

function answerPayment(s) {
  const lines = ['💳 Online payment (UPI, card, net banking) Cashfree se hoti hai, safe hai.'];
  if (s.codEnabled) lines.push(s.codAdvanceEnabled ? `Cash on Delivery bhi hai: ${s.codAdvancePercent}% advance online, baaki delivery par.` : 'Cash on Delivery bhi available hai.');
  else lines.push('Abhi Cash on Delivery band hai, sirf online payment.');
  return lines.join('\n');
}

function answerContact(s) {
  const lines = ['Memora team se yahan baat kar sakte hain 😊'];
  if (s.whatsapp) lines.push(`WhatsApp: https://wa.me/${s.whatsapp}`);
  if (s.email || s.supportEmail) lines.push(`Email: ${s.supportEmail || s.email}`);
  if (s.address) lines.push(`Address: ${s.address}`);
  return lines.join('\n');
}

function answerGiftWrap(s) {
  return s.giftWrapEnabled
    ? `🎀 Checkout par Gift Wrapping le sakte hain: Standard ${inr(s.giftWrapStandardFee)}, Premium ${inr(s.giftWrapPremiumFee)}, saath me personal message bhi.`
    : 'Gift wrapping abhi available nahi hai.';
}

/* ---------- public ---------- */

async function tryAnswer(messages, settings, deps) {
  const history = agent.cleanHistory(messages);
  const last = history[history.length - 1];

  if (!last || last.role !== 'user') return null;

  const text = last.content;
  let kind = detect(text);

  // a bare order number or mobile number after we asked for it continues the order flow
  if (!kind) {
    const prev = history.slice(-3, -1).reverse().find(m => m.role === 'assistant');
    if (prev && /order number|mobile number/i.test(prev.content) && (ORDER_ID.test(text) || MOBILE.test(text))) kind = 'order';
  }

  if (!kind) return null;

  const d = { ...deps, settings };
  const s = settings || {};

  switch (kind) {
    case 'greet': return 'Namaste! 🌸 Main Memora hu. Products, gifts, offers, delivery ya apne order ke bare me kuch bhi poochiye.';
    case 'thanks': return 'Aapka swagat hai 😊 Kuch aur chahiye to poochiye.';
    case 'offers': return formatOffers(await agent.getOffers(d));
    case 'order': return answerOrder(history, d);
    case 'products': return answerProducts(text, d);
    case 'delivery': return answerDelivery(s);
    case 'returns': return answerReturns(s);
    case 'payment': return answerPayment(s);
    case 'contact': return answerContact(s);
    case 'giftwrap': return answerGiftWrap(s);
    default: return null;
  }
}

/* shown when the AI is unavailable and nothing above matched */
function fallbackMenu(settings) {
  const wa = settings && settings.whatsapp ? `\nWhatsApp: https://wa.me/${settings.whatsapp}` : '';
  return 'Is sawaal ka jawab abhi main nahi de pa raha 🙏 In me se poochiye:\n• "Kaun kaun se gift hain?"\n• "Abhi kya offer chal raha hai?"\n• "Mera order kahan hai?"\n• "Delivery charge kitna hai?"' + wa;
}

module.exports = { tryAnswer, detect, fallbackMenu, formatOffers, formatOneOrder, keywordsOf };
