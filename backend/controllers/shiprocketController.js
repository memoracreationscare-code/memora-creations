
'use strict';

/*
=========================================
 MEMORA CREATIONS
 SHIPROCKET CONTROLLER - TRACKING V3

 - Courier rates
 - Selected courier ETA
 - Save shipment and AWB
 - Save estimated delivery date
 - Prevent duplicate shipment requests
 - Read existing shipment details
 - Protect COD and prepaid orders
 - No payment or stock modifications
=========================================
*/

const mongoose = require('mongoose');

const { cashOnDelivery } = require('../utils/codAdvance');
const {
  Order,
  ShipmentTracking
} = require('../models');

const {
  createShiprocketOrder,
  checkCourierServiceability,
  assignCourierAwb
} = require('../services/shiprocketService');

const {
  getCourierEstimate
} = require('../services/deliveryPincodeService');


/* =====================================
   HELPERS
===================================== */

async function getOrder(req) {

  if (!mongoose.isValidObjectId(req.params.id)) {
    return null;
  }

  return Order.findById(req.params.id)
    .populate('user', 'fullName mobile email');
}


function readPackage(body) {

  const weight = Number(body.weight);
  const length = Number(body.length);

  const width = Number(
    body.width ?? body.breadth
  );

  const height = Number(body.height);

  const values = [
    weight,
    length,
    width,
    height
  ];

  if (
    values.some(value =>
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


function shipmentEligibility(order) {

  if (!order) {
    return 'Order not found.';
  }

  if (
    order.orderStatus === 'Cancelled' ||
    order.orderStatus === 'Delivered'
  ) {
    return 'This order cannot be shipped.';
  }

  if (order.paymentMethod === 'COD') {

    if (
      !['COD_PENDING', 'SUCCESS']
        .includes(order.paymentStatus)
    ) {
      return 'COD order is not ready for shipment.';
    }

  } else if (
    order.paymentStatus !== 'SUCCESS'
  ) {
    return 'Online payment is not confirmed.';
  }

  return null;
}


function getPickupLocation(body) {

  return String(
    body.pickupLocation ||
    process.env.SHIPROCKET_PICKUP_LOCATION ||
    'Home'
  ).trim();
}


function getShiprocketOrderId(data) {

  return String(
    data?.order_id ??
    data?.data?.order_id ??
    ''
  );
}


function getShiprocketShipmentId(data) {

  const value = Number(
    data?.shipment_id ??
    data?.data?.shipment_id
  );

  return (
    Number.isSafeInteger(value) &&
    value > 0
  )
    ? value
    : null;
}


/* =====================================
   SHIPROCKET ESTIMATED DELIVERY

   Use the selected courier only.
   No date is invented locally.
===================================== */

function selectedCourierETA(courier) {

  if (!courier) return null;

  const estimate = getCourierEstimate([
    courier
  ]);

  if (!estimate?.date) {
    return null;
  }

  const date = new Date(
    estimate.date + 'T00:00:00.000Z'
  );

  return Number.isFinite(date.getTime())
    ? date
    : null;
}


/* =====================================
   CHECK COURIER RATES
===================================== */

async function checkCourierRates(req, res) {

  try {

    const order = await getOrder(req);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    const eligibility =
      shipmentEligibility(order);

    if (eligibility) {
      return res.status(400).json({
        success: false,
        message: eligibility
      });
    }

    const packageData = readPackage(
      req.body || {}
    );

    if (!packageData) {
      return res.status(400).json({
        success: false,
        message:
          'Valid package weight and dimensions are required.'
      });
    }

    /*
      Do not offer shipment creation
      for an order already registered.
    */

    const existing =
      await ShipmentTracking.findOne({
        order: order._id
      }).lean();

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          'Shipment record already exists. ' +
          'Check shipment status before proceeding.'
      });
    }

    const result =
      await checkCourierServiceability({

        pickupLocation:
          getPickupLocation(req.body || {}),

        deliveryPincode:
          String(
            order.shippingAddress?.pinCode || ''
          ),

        ...packageData,

        cod:
          cashOnDelivery(order) > 0,

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
        Number.isSafeInteger(
          Number(item.courier_company_id)
        ) &&
        Number(item.courier_company_id) > 0
      )
      .map(item => ({

        courierCompanyId:
          item.courier_company_id,

        courierName:
          item.courier_name,

        rate:
          item.rate,

        freightCharge:
          item.freight_charge,

        codCharges:
          item.cod_charges,

        etd:
          item.etd,

        estimatedDeliveryDays:
          item.estimated_delivery_days,

        rating:
          item.rating

      }));

    return res.json({

      success: true,

      message: couriers.length
        ? 'Courier options found.'
        : 'No courier available.',

      pickupLocation:
        result.pickupLocation,

      pickupPincode:
        result.pickupPincode,

      deliveryPincode:
        result.deliveryPincode,

      couriers

    });

  } catch (error) {

    console.error(
      '[Shiprocket] Courier rate check failed:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to check courier rates.'
    });
  }
}


/* =====================================
   VIEW EXISTING SHIPMENT

   Admin-only route can use this
   controller in the next step.

   Read-only: no Shiprocket request.
===================================== */

async function getShipmentStatus(req, res) {

  try {

    const order = await getOrder(req);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    const shipment =
      await ShipmentTracking.findOne({
        order: order._id
      }).lean();

    if (!shipment) {
      return res.json({
        success: true,
        shipmentExists: false,
        message:
          'No shipment record exists for this order.'
      });
    }

    return res.json({

      success: true,
      shipmentExists: true,

      shipment: {

        shiprocketOrderId:
          shipment.shiprocketOrderId || null,

        shipmentId:
          shipment.shipmentId || null,

        courierCompanyId:
          shipment.courierCompanyId ?? null,

        courierName:
          shipment.courierName || null,

        awbCode:
          shipment.awbCode || null,

        shipmentStatus:
          shipment.shipmentStatus || 'NOT_CREATED',

        shipmentCreatedAt:
          shipment.shipmentCreatedAt || null,

        awbAssignedAt:
          shipment.awbAssignedAt || null,

        estimatedDeliveryDate:
          shipment.estimatedDeliveryDate || null,

        pickedUpAt:
          shipment.pickedUpAt || null,

        deliveredAt:
          shipment.deliveredAt || null,

        lastTrackedAt:
          shipment.lastTrackedAt || null

      }

    });

  } catch (error) {

    console.error(
      '[Shiprocket] Shipment status read failed:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to read shipment status.'
    });
  }
}


/* =====================================
   CREATE SHIPMENT + AWB

   Real Shiprocket operation.
   One shipment record per order.
===================================== */

async function createShipment(req, res) {

  let trackingRecord = null;

  try {

    const order = await getOrder(req);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    const eligibility =
      shipmentEligibility(order);

    if (eligibility) {
      return res.status(400).json({
        success: false,
        message: eligibility
      });
    }

    const body = req.body || {};

    const packageData = readPackage(body);

    if (!packageData) {
      return res.status(400).json({
        success: false,
        message:
          'Valid package weight and dimensions are required.'
      });
    }

    const courierCompanyId = Number(
      body.courierCompanyId
    );

    if (
      !Number.isSafeInteger(courierCompanyId) ||
      courierCompanyId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Please select a valid courier.'
      });
    }

    const pickupLocation =
      getPickupLocation(body);

    /*
      Recheck selected courier with
      the actual parcel details.
    */

    const serviceability =
      await checkCourierServiceability({

        pickupLocation,

        deliveryPincode:
          String(
            order.shippingAddress?.pinCode || ''
          ),

        ...packageData,

        cod:
          cashOnDelivery(order) > 0,

        declaredValue:
          Number(order.grandTotal || 0)

      });

    const selectedCourier = (
      Array.isArray(serviceability.couriers)
        ? serviceability.couriers
        : []
    ).find(item =>
      item &&
      Number(item.courier_company_id) ===
      courierCompanyId
    );

    if (!selectedCourier) {
      return res.status(400).json({
        success: false,
        message:
          'Selected courier is no longer available. ' +
          'Please check courier rates again.'
      });
    }

    /*
      Important:
      Estimate belongs to the
      selected courier, not the
      earliest of all couriers.
    */

    const estimatedDeliveryDate =
      selectedCourierETA(selectedCourier);

    /*
      Atomic unique order lock.

      Do not remove a lock automatically
      if Shiprocket returns an error,
      because the external shipment
      may already exist.
    */

    try {

      trackingRecord =
        await ShipmentTracking.create({

          order:
            order._id,

          courierCompanyId,

          courierName:
            String(
              selectedCourier.courier_name || ''
            ).slice(0, 150),

          estimatedDeliveryDate,

          shipmentStatus:
            'CREATION_STARTED'

        });

    } catch (error) {

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message:
            'Shipment request already exists. ' +
            'Check its status before retrying. ' +
            'Do not create a duplicate shipment.'
        });
      }

      throw error;
    }

    /*
      STEP 1:
      Create Shiprocket shipment.
    */

    const shiprocketOrder =
      await createShiprocketOrder(
        order,
        {
          ...packageData,
          pickupLocation
        }
      );

    const shipmentId =
      getShiprocketShipmentId(
        shiprocketOrder
      );

    trackingRecord.shiprocketOrderId =
      getShiprocketOrderId(
        shiprocketOrder
      );

    if (!shipmentId) {

      trackingRecord.shipmentStatus =
        'NEEDS_MANUAL_REVIEW';

      await trackingRecord.save();

      return res.status(502).json({
        success: false,
        message:
          'Shiprocket did not return a valid ' +
          'shipment ID. Check Shiprocket ' +
          'dashboard before retrying.'
      });
    }

    /*
      STEP 2:
      Persist external shipment ID
      before assigning AWB.
    */

    trackingRecord.shipmentId =
      String(shipmentId);

    trackingRecord.shipmentCreatedAt =
      new Date();

    trackingRecord.shipmentStatus =
      'SHIPMENT_CREATED';

    await trackingRecord.save();

    /*
      STEP 3:
      Assign courier and AWB.
    */

    const awb =
      await assignCourierAwb({
        shipmentId,
        courierCompanyId
      });

    if (!awb.awbCode) {

      trackingRecord.shipmentStatus =
        'NEEDS_MANUAL_REVIEW';

      await trackingRecord.save();

      return res.status(502).json({
        success: false,
        message:
          'Shipment was created but AWB ' +
          'could not be confirmed. Check ' +
          'Shiprocket dashboard before retrying.'
      });
    }

    /*
      STEP 4:
      Save real AWB and courier.
    */

    trackingRecord.awbCode =
      String(awb.awbCode);

    trackingRecord.courierName =
      String(
        awb.courierName ||
        selectedCourier.courier_name ||
        ''
      ).slice(0, 150);

    trackingRecord.awbAssignedAt =
      new Date();

    trackingRecord.shipmentStatus =
      'AWB_ASSIGNED';

    await trackingRecord.save();

    /*
      Preserve response expected by
      existing Admin Orders UI.
    */

    return res.status(200).json({

      success: true,

      message:
        'Shipment created and tracking saved.',

      shiprocketOrder,

      awb,

      tracking: {

        shipmentId:
          trackingRecord.shipmentId,

        awbCode:
          trackingRecord.awbCode,

        courierName:
          trackingRecord.courierName,

        shipmentCreatedAt:
          trackingRecord.shipmentCreatedAt,

        awbAssignedAt:
          trackingRecord.awbAssignedAt,

        estimatedDeliveryDate:
          trackingRecord.estimatedDeliveryDate,

        shipmentStatus:
          trackingRecord.shipmentStatus

      }

    });

  } catch (error) {

    console.error(
      '[Shiprocket] Shipment creation failed:',
      error.message
    );

    /*
      A failed response does not prove
      that Shiprocket did not create
      a shipment.

      Preserve the record for review.
    */

    if (trackingRecord) {

      try {

        if (
          trackingRecord.shipmentStatus !==
          'AWB_ASSIGNED'
        ) {

          trackingRecord.shipmentStatus =
            'NEEDS_MANUAL_REVIEW';

          await trackingRecord.save();
        }

      } catch (saveError) {

        console.error(
          '[Shiprocket] Review state save failed:',
          saveError.message
        );
      }
    }

    return res.status(500).json({

      success: false,

      message: trackingRecord
        ? 'Shipment request needs manual review. ' +
          'Check Shiprocket dashboard before retrying.'
        : 'Failed to start shipment creation.'

    });
  }
}


/* =====================================
   EXPORTS
===================================== */

module.exports = {

  checkCourierRates,

  getShipmentStatus,

  createShipment

};
