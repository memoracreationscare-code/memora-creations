
'use strict';

/*
=========================================
 MEMORA CREATIONS
 SHIPROCKET SHIPMENT TRACKING MODEL

 Stores shipment and AWB information.
 Does not change payments or orders.
=========================================
*/

const mongoose = require('mongoose');

const shipmentTrackingSchema = new mongoose.Schema({

  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true,
    index: true
  },

  shiprocketOrderId: {
    type: String,
    trim: true,
    default: ''
  },

  shipmentId: {
    type: String,
    trim: true,
    default: ''
  },

  awbCode: {
    type: String,
    trim: true,
    default: ''
  },

  courierCompanyId: {
    type: Number,
    default: null
  },

  courierName: {
    type: String,
    trim: true,
    maxlength: 150,
    default: ''
  },

  trackingUrl: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },

  shipmentCreatedAt: {
    type: Date,
    default: null
  },

  awbAssignedAt: {
    type: Date,
    default: null
  },

  pickedUpAt: {
    type: Date,
    default: null
  },

  deliveredAt: {
    type: Date,
    default: null
  },

  estimatedDeliveryDate: {
    type: Date,
    default: null
  },

  shipmentStatus: {
    type: String,
    trim: true,
    maxlength: 100,
    default: 'NOT_CREATED'
  },

  lastTrackedAt: {
    type: Date,
    default: null
  }

}, {
  timestamps: true
});


/* =====================================
   INDEXES
===================================== */

shipmentTrackingSchema.index({
  shipmentId: 1
});

shipmentTrackingSchema.index({
  awbCode: 1
});


/* =====================================
   EXPORT MODEL
===================================== */

module.exports = mongoose.model(
  'ShipmentTracking',
  shipmentTrackingSchema
);
