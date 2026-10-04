require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDatabase = require('../backend/config/db');
const Admin = require('../backend/models/Admin');

(async () => {
  try {
    await connectDatabase();
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required.');
    if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');

    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await Admin.findOne({ email });

    if (existing) {
      existing.passwordHash = passwordHash;
      existing.isActive = true;
      await existing.save();
      console.log(`Admin updated: ${email}`);
    } else {
      await Admin.create({ name: 'Store Admin', email, passwordHash });
      console.log(`Admin created: ${email}`);
    }
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
})();
