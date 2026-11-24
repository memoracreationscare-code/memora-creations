const mongoose = require('mongoose');

/* Text the owner wrote in Admin -> Website pages for a policy / about page.
   Empty or missing = the page keeps the text written in its file. */
const schema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    body: { type: String, default: '', maxlength: 20000 }
  },
  { versionKey: false, timestamps: true }
);

module.exports = mongoose.models.PageContent || mongoose.model('PageContent', schema);
