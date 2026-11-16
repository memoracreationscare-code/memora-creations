const mongoose = require('mongoose');

const pushMessageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    body: { type: String, required: true, trim: true, maxlength: 240 },
    url: { type: String, trim: true, maxlength: 300, default: '/frontend/index.html' },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, index: true }
  },
  { versionKey: false }
);

module.exports =
  mongoose.models.PushMessage ||
  mongoose.model('PushMessage', pushMessageSchema);
