const mongoose = require('mongoose');

/* One document. Holds the keys the owner saved in Admin -> Connections,
   each one ENCRYPTED (see utils/secretBox). Never sent to any browser. */
const schema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    values: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { versionKey: false, timestamps: true, minimize: false }
);

module.exports = mongoose.models.SecretVault || mongoose.model('SecretVault', schema);
