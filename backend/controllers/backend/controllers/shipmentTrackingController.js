
'use strict';

/*
=========================================
 MEMORA CREATIONS
 CUSTOMER SHIPMENT TRACKING CONTROLLER

 - Customer ownership verification
 - Read-only MongoDB shipment details
 - No new shipment or AWB creation
 - No payment or stock changes
=========================================
*/

const mongoose = require('mongoose');

const {
  Order,
  ShipmentTracking
} = require('../models');


async function getShipmentTracking(req, res) {

  try {

    if (
      !req.user ||
      !mongoose.isValidObjectId(req.params.id)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order request.'
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    })
      .select('_id orderId orderStatus')
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    const shipment = await ShipmentTracking
      .findOne({
        order: order._id
      })
      .lean();

    if (!shipment) {
      return res.status(200).json({
        success: true,
        trackingAvailable: false,
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        message:
          'Shipment tracking will be available ' +
          'after courier assignment.'
      });
    }

    const trackingUrl =
      typeof shipment.trackingUrl === 'string' &&
      /^https:\/\//i.test(shipment.trackingUrl)
        ? shipment.trackingUrl
        : null;

    return res.status(200).json({

      success: true,
      trackingAvailable: Boolean(
        shipment.awbCode
      ),

      orderId: order.orderId,
      orderStatus: order.orderStatus,

      shipment: {

        courierName:
          shipment.courierName || null,

        awbCode:
          shipment.awbCode || null,

        trackingUrl,

        shipmentCreatedAt:
          shipment.shipmentCreatedAt || null,

        awbAssignedAt:
          shipment.awbAssignedAt || null,

        pickedUpAt:
          shipment.pickedUpAt || null,

        deliveredAt:
          shipment.deliveredAt || null,

        estimatedDeliveryDate:
          shipment.estimatedDeliveryDate || null,

        shipmentStatus:
          shipment.shipmentStatus ||
          'NOT_CREATED',

        lastTrackedAt:
          shipment.lastTrackedAt || null

      }

    });

  } catch (err) {

    console.error(
      '[Shipment Tracking] Read failed:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Shipment tracking is temporarily unavailable.'
    });

  }

}


module.exports = {
  getShipmentTracking
};
