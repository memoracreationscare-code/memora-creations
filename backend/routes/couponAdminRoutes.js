
const router = require('express').Router();

const { Coupon } = require('../models');

const {
  requireAdmin
} = require('../middleware/auth');

const {
  asyncHandler,
  error,
  ok
} = require('../utils/http');

// All coupon management requires admin login.
router.use(requireAdmin);

function normalizeCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function validateInput(body, current = null) {
  const data = {};

  if (body.code !== undefined || !current) {
    const code = normalizeCode(body.code);

    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
      throw error(
        400,
        'Coupon code must contain 3-30 letters, numbers, - or _.'
      );
    }

    data.code = code;
  }

  if (body.description !== undefined) {
    data.description = String(
      body.description || ''
    ).trim();
  }

  if (body.discountType !== undefined || !current) {
    if (
      !['PERCENTAGE', 'FIXED'].includes(
        body.discountType
      )
    ) {
      throw error(400, 'Invalid discount type.');
    }

    data.discountType = body.discountType;
  }

  if (body.discountValue !== undefined || !current) {
    const value = Number(body.discountValue);

    if (
      body.discountValue === null ||
      body.discountValue === '' ||
      !Number.isFinite(value) ||
      value <= 0
    ) {
      throw error(400, 'Invalid discount value.');
    }

    data.discountValue = value;
  }

  for (const field of [
    'minOrderAmount',
    'maxDiscountAmount'
  ]) {
    if (body[field] !== undefined) {
      if (
        field === 'maxDiscountAmount' &&
        (body[field] === null || body[field] === '')
      ) {
        data[field] = null;
        continue;
      }

      const value = Number(body[field]);

      if (
        body[field] === null ||
        body[field] === '' ||
        !Number.isFinite(value) ||
        value < 0
      ) {
        throw error(400, `Invalid ${field}.`);
      }

      data[field] = value;
    }
  }

  for (const field of [
    'usageLimit',
    'perUserLimit'
  ]) {
    if (body[field] !== undefined || !current) {
      const value = Number(body[field]);

      if (
        body[field] === null ||
        body[field] === '' ||
        !Number.isSafeInteger(value) ||
        value < 1
      ) {
        throw error(400, `Invalid ${field}.`);
      }

      data[field] = value;
    }
  }

  for (const field of [
    'startsAt',
    'expiresAt'
  ]) {
    if (body[field] !== undefined) {
      const date = new Date(body[field]);

      if (
        !body[field] ||
        Number.isNaN(date.getTime())
      ) {
        throw error(400, `Invalid ${field}.`);
      }

      data[field] = date;
    }
  }

  if (
    !current &&
    !data.expiresAt
  ) {
    throw error(400, 'Expiry date is required.');
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      throw error(400, 'isActive must be boolean.');
    }

    data.isActive = body.isActive;
  }

  const type =
    data.discountType ||
    current?.discountType;

  const value =
    data.discountValue ??
    current?.discountValue;

  if (
    type === 'PERCENTAGE' &&
    value > 100
  ) {
    throw error(
      400,
      'Percentage cannot exceed 100.'
    );
  }

  const start =
    data.startsAt ||
    current?.startsAt ||
    new Date();

  const expiry =
    data.expiresAt ||
    current?.expiresAt;

  if (expiry && expiry <= start) {
    throw error(
      400,
      'Expiry must be after start date.'
    );
  }

  const limit =
    data.usageLimit ??
    current?.usageLimit;

  if (
    current &&
    limit < current.usedCount
  ) {
    throw error(
      400,
      'Usage limit cannot be below used count.'
    );
  }

  return data;
}

// GET /api/admin/coupons
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const coupons = await Coupon.find()
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return ok(res, { coupons });
  })
);

// GET /api/admin/coupons/report
router.get(
  '/report',
  asyncHandler(async (req, res) => {
    const now = new Date();

    const [
      totalCoupons,
      activeCoupons,
      expiredCoupons,
      usage
    ] = await Promise.all([
      Coupon.countDocuments(),
      Coupon.countDocuments({
        isActive: true,
        startsAt: { $lte: now },
        expiresAt: { $gt: now }
      }),
      Coupon.countDocuments({
        expiresAt: { $lte: now }
      }),
      Coupon.aggregate([
        {
          $group: {
            _id: null,
            totalUses: { $sum: '$usedCount' }
          }
        }
      ])
    ]);

    return ok(res, {
      summary: {
        totalCoupons,
        activeCoupons,
        expiredCoupons,
        totalUses: usage[0]?.totalUses || 0
      }
    });
  })
);

// POST /api/admin/coupons
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = validateInput(req.body || {});

    const existing = await Coupon.exists({
      code: data.code
    });

    if (existing) {
      throw error(409, 'Coupon already exists.');
    }

    const coupon = await Coupon.create({
      ...data,
      createdBy: req.admin._id,
      updatedBy: req.admin._id
    });

    return ok(
      res,
      {
        message: 'Coupon created successfully.',
        coupon
      },
      201
    );
  })
);

// PUT /api/admin/coupons/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const coupon = await Coupon.findById(
      req.params.id
    ).catch(() => null);

    if (!coupon) {
      throw error(404, 'Coupon not found.');
    }

    const data = validateInput(
      req.body || {},
      coupon
    );

    if (
      data.code &&
      data.code !== coupon.code
    ) {
      const duplicate = await Coupon.exists({
        code: data.code,
        _id: { $ne: coupon._id }
      });

      if (duplicate) {
        throw error(409, 'Coupon code already exists.');
      }
    }

    Object.assign(coupon, data);
    coupon.updatedBy = req.admin._id;

    await coupon.save();

    return ok(res, {
      message: 'Coupon updated successfully.',
      coupon
    });
  })
);

// PATCH /api/admin/coupons/:id/status
router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    if (typeof req.body?.isActive !== 'boolean') {
      throw error(
        400,
        'isActive must be true or false.'
      );
    }

    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isActive: req.body.isActive,
          updatedBy: req.admin._id
        }
      },
      {
        new: true,
        runValidators: true
      }
    ).catch(err => {
      if (err.name === 'CastError') {
        throw error(400, 'Invalid coupon ID.');
      }
      throw err;
    });

    if (!coupon) {
      throw error(404, 'Coupon not found.');
    }

    return ok(res, {
      message: coupon.isActive
        ? 'Coupon enabled.'
        : 'Coupon disabled.',
      coupon
    });
  })
);

module.exports = router;
