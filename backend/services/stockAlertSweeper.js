'use strict';

/*
  Emails customers who asked "Stock aane par batao" once the product is
  back (stock above 0). Runs with the other automatic jobs. One email per
  request; failed sends stay waiting and are tried again next time.
*/

const BATCH = 30;

function defaultDeps() {
  return {
    StockAlert: require('../models').StockAlert,
    Product: require('../models').Product,
    mail: require('./mailService'),
    templates: require('../utils/emailTemplates')
  };
}

async function sweepStockAlerts(deps = defaultDeps()) {
  const { StockAlert, Product, mail, templates } = deps;
  const result = { sent: 0, failed: 0 };

  if (!mail.mailConfigured()) return result;

  const waiting = await StockAlert.find({ notifiedAt: null }).sort({ createdAt: 1 }).limit(300).lean();

  if (!waiting.length) return result;

  const ids = [...new Set(waiting.map(w => String(w.product)))];
  const back = await Product.find({ _id: { $in: ids }, isActive: true, stock: { $gt: 0 } })
    .select('name sellingPrice stock').lean();
  const byId = new Map(back.map(p => [String(p._id), p]));

  let handled = 0;

  for (const alert of waiting) {
    const product = byId.get(String(alert.product));

    if (!product) continue;
    if (handled >= BATCH) break;
    handled += 1;

    try {
      const message = templates.backInStockEmail(product);

      await mail.sendMail({ to: alert.email, subject: message.subject, html: message.html });
      await StockAlert.updateOne({ _id: alert._id }, { $set: { notifiedAt: new Date() } });
      result.sent += 1;
    } catch (err) {
      result.failed += 1;
      console.warn('[Stock alert]', err.message);
    }
  }

  return result;
}

module.exports = { sweepStockAlerts };
