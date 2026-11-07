
'use strict';

/*
=========================================
 MEMORA CREATIONS
 LIVE SHIPROCKET SHIPMENT TRACKING V2

 - Authenticated customer only
 - Order ownership verification
 - Actual Shiprocket AWB tracking
 - 10-minute API refresh interval
 - MongoDB tracking status cache
 - Read-only order/payment operation
 - No fake pickup/delivery dates
=========================================
*/

const mongoose = require('mongoose');

const {
  Order,
  ShipmentTracking
} = require('../models');

const {
  configured,
  shiprocketRequest
} = require('../services/shiprocketService');

const REFRESH_INTERVAL_MS =
  10 * 60 * 1000;


/* =====================================
   HELPERS
===================================== */

function safeString(value, maxLength = 100) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}


function safeAwb(value) {
  const awb = safeString(value, 100);

  return /^[A-Za-z0-9_-]{4,100}$/.test(awb)
    ? awb
    : null;
}


function validDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (
    !Number.isFinite(date.getTime()) ||
    date.getTime() > Date.now() + 86400000
  ) {
    return null;
  }

  return date;
}


/*
  Shiprocket often returns timestamps
  such as YYYY-MM-DD HH:mm:ss.

  Treat these as Indian local time.
*/

function parseTrackingDate(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim();

  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/
  );

  if (match) {
    const [
      ,
      year,
      month,
      day,
      hour,
      minute,
      second
    ] = match.map(Number);

    if (
      month < 1 || month > 12 ||
      day < 1 || day > 31 ||
      hour > 23 ||
      minute > 59 ||
      second > 59
    ) {
      return null;
    }

    const utc = Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second
    ) - (330 * 60 * 1000);

    const date = new Date(utc);

    const indiaParts = new Intl.DateTimeFormat(
      'en-GB',
      {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
      }
    ).formatToParts(date);

    const part = type => Number(
      indiaParts.find(p => p.type === type)?.value
    );

    if (
      part('year') !== year ||
      part('month') !== month ||
      part('day') !== day ||
      part('hour') !== hour ||
      part('minute') !== minute ||
      part('second') !== second
    ) {
      return null;
    }

    return validDate(date);
  }

  /*
    Explicit timezone required for
    other timestamp formats.
  */

  if (
    /^\d{4}-\d{2}-\d{2}T/.test(text) &&
    /(Z|[+-]\d{2}:\d{2})$/i.test(text)
  ) {
    return validDate(text);
  }

  return null;
}


/* =====================================
   CURRENT SHIPMENT STATUS
===================================== */

function readTrackingStatus(data) {

  const tracking = data?.tracking_data;

  if (
    !tracking ||
    typeof tracking !== 'object'
  ) {
    return null;
  }

  const shipmentTrack = Array.isArray(
    tracking.shipment_track
  )
    ? tracking.shipment_track[0]
    : null;

  const status = safeString(
    shipmentTrack?.current_status ||
    tracking.current_status ||
    '',
    100
  );

  const statusCode = Number(
    shipmentTrack?.current_status_id
  );

  return {
    status: status || null,

    statusCode:
      Number.isSafeInteger(statusCode) &&
      statusCode > 0
        ? statusCode
        : null,

    activities: Array.isArray(
      tracking.shipment_track_activities
    )
      ? tracking.shipment_track_activities
      : []
  };
}


/* =====================================
   UPDATE VERIFIED TRACKING DETAILS

   Do not modify the Order status.
===================================== */

async function refreshShipmentTracking(shipment) {

  const awb = safeAwb(shipment.awbCode);

  if (!awb || !configured()) {
    return shipment;
  }

  const recentlyChecked =
    shipment.lastTrackedAt &&
    Date.now() -
      new Date(shipment.lastTrackedAt).getTime()
      < REFRESH_INTERVAL_MS;

  if (recentlyChecked) {
    return shipment;
  }

  try {

    const data = await shiprocketRequest(
      '/courier/track/awb/' +
      encodeURIComponent(awb)
    );

    const tracking = readTrackingStatus(data);

    if (!tracking) {
      return shipment;
    }

    const updates = {
      lastTrackedAt: new Date()
    };

    if (tracking.status) {
      updates.shipmentStatus =
        tracking.status;
    }

    /*
      Identify only explicit courier
      pickup and delivery events.

      Do not infer pickup merely from
      "Shipped" or "In Transit".
    */

    for (const activity of tracking.activities) {

      if (
        !activity ||
        typeof activity !== 'object'
      ) {
        continue;
      }

      const code = Number(
        activity['sr-status'] ??
        activity.sr_status ??
        activity.status_code
      );

      const activityStatus = safeString(
        activity.activity || '',
        100
      ).toUpperCase();

      const date = parseTrackingDate(
        activity.date ||
        activity.timestamp ||
        ''
      );

      if (!date) {
        continue;
      }

      if (
        !shipment.pickedUpAt &&
        !updates.pickedUpAt &&
        (
          code === 42 ||
          activityStatus === 'PICKED UP' ||
          activityStatus === 'PICKED_UP'
        )
      ) {
        updates.pickedUpAt = date;
      }

      if (
        !shipment.deliveredAt &&
        !updates.deliveredAt &&
        (
          code === 7 ||
          activityStatus === 'DELIVERED'
        )
      ) {
        updates.deliveredAt = date;
      }
    }

    /*
      Only set status from Shiprocket.
      Never mark an order as delivered
      through this customer read endpoint.
    */

    const updated =
      await ShipmentTracking.findByIdAndUpdate(
        shipment._id,
        { $set: updates },
        { new: true }
      ).lean();

    return updated || shipment;

  } catch (err) {

    console.warn(
      '[Shipment Tracking] Shiprocket refresh failed:',
      err.message
    );

    /*
      Keep existing cached data.
      A temporary Shiprocket failure
      must not hide tracking records.
    */

    return shipment;
  }
}


/* =====================================
   CUSTOMER TRACKING ENDPOINT
===================================== */

async function getShipmentTracking(req, res) {

  res.set('Cache-Control', 'private, no-store');

  try {

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Customer login required.'
      });
    }

    if (
      !mongoose.isValidObjectId(
        req.params.id
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID.'
      });
    }

    /*
      Customer can only access their
      own order.
    */

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

    let shipment =
      await ShipmentTracking.findOne({
        order: order._id
      }).lean();

    if (!shipment) {
      return res.json({
        success: true,
        trackingAvailable: false,

        orderId: order.orderId,
        orderStatus: order.orderStatus,

        message:
          'Shipment tracking will be available ' +
          'after courier assignment.'
      });
    }

    /*
      Refresh only if a real AWB
      was already assigned.
    */

    if (shipment.awbCode) {
      shipment =
        await refreshShipmentTracking(
          shipment
        );
    }

    let trackingUrl = null;

    if (shipment.trackingUrl) {
      try {
        const url = new URL(
          shipment.trackingUrl
        );

        if (url.protocol === 'https:') {
          trackingUrl = url.href;
        }
      } catch (_) {
        trackingUrl = null;
      }
    }

    return res.json({

      success: true,

      trackingAvailable:
        Boolean(shipment.awbCode),

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
      '[Customer Shipment Tracking]',
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
  getShipmentTracking,
  refreshShipmentTracking
};
