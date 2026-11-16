const mongoose = require('mongoose');

/* One document that keeps the website's push (VAPID) keys, so they are
   created once and never change (a change would drop every subscriber). */
const pushConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'vapid', unique: true },
    publicKey: { type: String, required: true },
    privateKeyPem: { type: String, required: true }
  },
  { versionKey: false }
);

module.exports =
  mongoose.models.PushConfig ||
  mongoose.model('PushConfig', pushConfigSchema);
