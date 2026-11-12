'use strict';

/* Owner-only: create and manage staff (helper) logins. */

const bcrypt = require('bcryptjs');
const validator = require('validator');
const mongoose = require('mongoose');
const { asyncHandler, error, ok } = require('../utils/http');

const clean = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

function publicStaff(a) {
  return { id: a._id, name: a.name, email: a.email, isActive: a.isActive, lastLoginAt: a.lastLoginAt, createdAt: a.createdAt };
}

function requireOwner(req) {
  if (req.admin.role === 'staff') throw error(403, 'Sirf owner staff manage kar sakta hai.');
}

function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 100) {
    throw error(400, 'Password kam se kam 8 akshar ka hona chahiye.');
  }
}

const me = asyncHandler(async (req, res) =>
  ok(res, { admin: { id: req.admin._id, name: req.admin.name, role: req.admin.role } })
);

const list = asyncHandler(async (req, res) => {
  requireOwner(req);
  const { Admin } = require('../models');
  const staff = await Admin.find({ role: 'staff' }).sort({ createdAt: -1 }).lean();

  return ok(res, { staff: staff.map(publicStaff) });
});

const create = asyncHandler(async (req, res) => {
  requireOwner(req);
  const { Admin } = require('../models');
  const name = clean(req.body.name, 100);
  const email = clean(req.body.email, 150).toLowerCase();
  const password = req.body.password;

  if (name.length < 2) throw error(400, 'Naam likhein.');
  if (!validator.isEmail(email)) throw error(400, 'Sahi email daalein.');
  checkPassword(password);

  if (await Admin.findOne({ email }).lean()) throw error(409, 'Is email se pehle se login bana hua hai.');

  const staff = await Admin.create({
    name, email, role: 'staff', isActive: true,
    passwordHash: await bcrypt.hash(password, 12)
  });

  return ok(res, { message: 'Staff login ban gaya.', staff: publicStaff(staff) });
});

async function findStaff(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw error(400, 'Invalid staff id.');
  const { Admin } = require('../models');
  const staff = await Admin.findOne({ _id: req.params.id, role: 'staff' });

  if (!staff) throw error(404, 'Staff nahi mila.');

  return staff;
}

const toggle = asyncHandler(async (req, res) => {
  requireOwner(req);
  const staff = await findStaff(req);

  staff.isActive = !staff.isActive;
  await staff.save();

  return ok(res, { message: staff.isActive ? 'Staff chalu kar diya.' : 'Staff band kar diya.', staff: publicStaff(staff) });
});

const resetPassword = asyncHandler(async (req, res) => {
  requireOwner(req);
  const staff = await findStaff(req);

  checkPassword(req.body.password);
  staff.passwordHash = await bcrypt.hash(req.body.password, 12);
  await staff.save();

  return ok(res, { message: 'Naya password set ho gaya.' });
});

module.exports = { me, list, create, toggle, resetPassword, requireOwner };
