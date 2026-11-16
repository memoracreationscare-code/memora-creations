const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true, unique: true, maxlength: 1000 },
    userAgent: { type: String, default: '', maxlength: 300 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

module.exports =
  mongoose.models.PushSubscription ||
  mongoose.model('PushSubscription', pushSubscriptionSchema);
