
'use strict';

/*
=========================================
 MEMORA CREATIONS
 SHIPROCKET DRY RUN CONTROLLER V1

 SAFE TEST MODE

 - Verify order eligibility
 - Validate package dimensions
 - Check live courier availability
 - Read courier charges
 - Read Shiprocket estimated date

 NEVER:
 - Create shipment
 - Generate AWB
 - Book pickup
 - Charge payment
 - Modify order or stock
=========================================
*/

const mongoose = require('mongoose');

const { Order } = require('../models');

const {
  checkCourierServiceability
} = require('../services/shiprocketService');


/* =====================================
   PACKAGE VALIDATION
===================================== */

function validatePackage(body) {

  const weight = Number(body.weight);
  const length = Number(body.length);
  const width = Number(
    body.width ?? body.breadth
  );
  const height = Number(body.height);

  const dimensions = [
    weight,
    length,
    width,
    height
  ];

  if (
    dimensions.some(value =>
      !Number.isFinite(value) ||
      value <= 0
    ) ||
    weight > 100 ||
    length > 300 ||
    width > 300 ||
    height > 300
  ) {
    return null;
  }

  return {
    weight,
    length,
    width,
    height
  };
}


/* =====================================
   CHECK ORDER ELIGIBILITY
===================================== */

function checkEligibility(order) {

  if (
    ['Cancelled', 'Delivered']
      .includes(order.orderStatus)
  ) {
    return 'This order is not eligible for shipment.';
  }

  if (order.paymentMethod === 'COD') {

    if (
      !['COD_PENDING', 'SUCCESS']
        .includes(order.paymentStatus)
    ) {
      return 'COD payment status is not eligible.';
    }

  } else if (
    order.paymentStatus !== 'SUCCESS'
  ) {

    return 'Online payment is not confirmed.';
  }

  return null;
}


/* =====================================
   SAFE DRY RUN
===================================== */

async function dryRunShipment(req, res) {

  res.set('Cache-Control', 'no-store');

  try {

    if (
      !mongoose.isValidObjectId(req.params.id)
    ) {
      return res.status(400).json({
        success: false,
        dryRun: true,
        message: 'Invalid order ID.'
      });
    }

    const order = await Order.findById(
      req.params.id
    ).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        dryRun: true,
        message: 'Order not found.'
      });
    }

    const eligibility =
      checkEligibility(order);

    if (eligibility) {
      return res.status(400).json({
        success: false,
        dryRun: true,
        message: eligibility
      });
    }

    const body = req.body || {};

    const packageData =
      validatePackage(body);

    if (!packageData) {
      return res.status(400).json({
        success: false,
        dryRun: true,
        message:
          'Valid package weight and dimensions are required.'
      });
    }

    const pickupLocation = String(
      process.env.SHIPROCKET_PICKUP_LOCATION ||
      'Home'
    ).trim();

    /*
      Read-only Shiprocket serviceability.
      Does not create shipment or AWB.
    */

    const result =
      await checkCourierServiceability({

        pickupLocation,

        deliveryPincode:
          String(
            order.shippingAddress?.pinCode ||
            ''
          ),

        ...packageData,

        cod:
          order.paymentMethod === 'COD',

        declaredValue:
          Number(order.grandTotal || 0)

      });

    const couriers = (
      Array.isArray(result.couriers)
        ? result.couriers
        : []
    )
      .filter(item =>
        item &&
        Number(item.courier_company_id) > 0 &&
        (
          order.paymentMethod !== 'COD' ||
          item.cod === true ||
          item.cod === 'Y' ||
          Number(item.cod) === 1
        )
      )
      .map(item => ({

        courierCompanyId:
          item.courier_company_id,

        courierName:
          item.courier_name || '',

        rate:
          Number(item.rate || 0),

        freightCharge:
          Number(
            item.freight_charge || 0
          ),

        codCharges:
          Number(item.cod_charges || 0),

        estimatedDeliveryDate:
          item.etd || null,

        estimatedDeliveryDays:
          item.estimated_delivery_days ?? null

      }));

    return res.json({

      success: true,

      dryRun: true,

      shipmentCreated: false,

      awbGenerated: false,

      pickupBooked: false,

      message:
        'Dry run completed. No shipment or AWB was created.',

      orderId: order.orderId,

      paymentMethod:
        order.paymentMethod,

      pickupPincode:
        result.pickupPincode,

      deliveryPincode:
        result.deliveryPincode,

      package: packageData,

      available:
        couriers.length > 0,

      courierCount:
        couriers.length,

      couriers,

      note:
        'Courier rates and delivery dates ' +
        'are estimates. Final amounts ' +
        'may change at booking.'

    });

  } catch (error) {

    console.error(
      '[Shiprocket Dry Run]',
      error.message
    );

    return res.status(500).json({

      success: false,

      dryRun: true,

      shipmentCreated: false,

      message:
        'Dry run could not be completed.'

    });
  }
}


/* =====================================
   EXPORT
===================================== */

module.exports = {
  dryRunShipment
};
