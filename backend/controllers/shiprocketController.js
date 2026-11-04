
'use strict';

/*
=========================================
 MEMORA CREATIONS
 SHIPROCKET CONTROLLER - TRACKING V2

 - Admin-only routes (adminRoutes)
 - Courier rate checking
 - Payment eligibility validation
 - Duplicate shipment prevention
 - Persist Shiprocket Shipment ID
 - Persist Courier and AWB
 - Safe handling of partial failures

 IMPORTANT:
 Does not alter payment, stock,
 cancellation or order status.

 If Shiprocket creates a shipment but
 a later step fails, an admin must
 reconcile it manually before retrying.
=========================================
*/

const {
  Order,
  ShipmentTracking
} = require('../models');

const {
  createShiprocketOrder,
  checkCourierServiceability,
  assignCourierAwb
} = require('../services/shiprocketService');


/* =====================================
   HELPERS
===================================== */

async function getOrder(req) {
  return Order.findById(req.params.id)
    .populate('user', 'fullName mobile email');
}

function readPackage(body) {
  const weight = Number(body.weight);
  const length = Number(body.length);
  const width = Number(body.width);
  const height = Number(body.height);

  const values = [
    weight,
    length,
    width,
    height
  ];

  if (
    values.some(
      number =>
        !Number.isFinite(number) ||
        number <= 0
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
      ![
        'COD_PENDING',
        'SUCCESS'
      ].includes(order.paymentStatus)
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
  const value =
    data?.order_id ??
    data?.data?.order_id ??
    '';

  return String(value);
}

function getShiprocketShipmentId(data) {
  const value =
    data?.shipment_id ??
    data?.data?.shipment_id;

  const id = Number(value);

  return Number.isSafeInteger(id) &&
    id > 0
      ? id
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

    const existing =
      await ShipmentTracking.findOne({
        order: order._id
      }).lean();

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          'A shipment record already exists for this order. ' +
          'Check its status before proceeding.'
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
          order.paymentMethod === 'COD',

        declaredValue:
          Number(order.grandTotal || 0)

      });

    const couriers =
      (result.couriers || [])
        .filter(item =>
          item &&
          item.courier_company_id
        )
        .map(item => ({
          courierCompanyId:
            item.courier_company_id,

          courierName:
            item.courier_name,

          rate: item.rate,

          freightCharge:
            item.freight_charge,

          codCharges:
            item.cod_charges,

          etd: item.etd,

          estimatedDeliveryDays:
            item.estimated_delivery_days,

          rating: item.rating
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
      'Courier rate check error:',
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
   CREATE SHIPMENT + SAVE TRACKING

   Uses a unique Order reference to stop
   duplicate requests from creating
   multiple Shiprocket shipments.
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

    const courierCompanyId =
      Number(body.courierCompanyId);

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
      Verify selected courier directly
      against current Shiprocket response.
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
          order.paymentMethod === 'COD',

        declaredValue:
          Number(order.grandTotal || 0)

      });

    const selectedCourier =
      (serviceability.couriers || [])
        .find(item =>
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
      Unique database constraint provides
      protection against two requests
      creating a shipment for one order.
    */

    try {
      trackingRecord =
        await ShipmentTracking.create({

          order: order._id,

          courierCompanyId,

          courierName:
            String(
              selectedCourier.courier_name || ''
            ).slice(0, 150),

          shipmentStatus:
            'CREATION_STARTED'

        });

    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message:
            'Shipment creation has already been started ' +
            'for this order. Please check its status. ' +
            'Do not create another shipment.'
        });
      }

      throw error;
    }

    /*
      External call 1:
      Create shipment in Shiprocket.
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
          'Shiprocket did not return a valid shipment ID. ' +
          'Check the Shiprocket dashboard before retrying.'
      });
    }

    /*
      Persist Shipment ID immediately,
      before requesting AWB assignment.
    */

    trackingRecord.shipmentId =
      String(shipmentId);

    trackingRecord.shipmentCreatedAt =
      new Date();

    trackingRecord.shipmentStatus =
      'SHIPMENT_CREATED';

    await trackingRecord.save();

    /*
      External call 2:
      Assign selected courier and AWB.
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
          'Shipment was created, but AWB could not ' +
          'be confirmed. Check Shiprocket dashboard.'
      });
    }

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
      Preserve response fields expected
      by the existing Admin Orders page.
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

        shipmentStatus:
          trackingRecord.shipmentStatus
      }

    });

  } catch (error) {

    console.error(
      'Shiprocket shipment creation error:',
      error.message
    );

    /*
      The external API might already have
      created a shipment.

      Keep the database lock, so an admin
      can investigate instead of risking
      duplicate shipment creation.
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
          'Shipment review state save failed:',
          saveError.message
        );
      }
    }

    return res.status(500).json({
      success: false,

      message: trackingRecord
        ? 'Shipment request needs manual review. ' +
          'Check the Shiprocket dashboard before retrying.'
        : 'Failed to start shipment creation.'
    });
  }
}


module.exports = {
  checkCourierRates,
  createShipment
};
