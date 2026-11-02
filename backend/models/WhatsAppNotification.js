
'use strict';

/*
==========================================
 MEMORA CREATIONS
 WHATSAPP NOTIFICATION MODEL

 Tracks order notification attempts.

 Events:
 - ORDER_PLACED
 - SHIPPED
 - DELIVERED

 One notification record per
 order + event.
==========================================
*/

const mongoose = require('mongoose');

const whatsappNotificationSchema =
  new mongoose.Schema({

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true
    },

    event: {
      type: String,
      enum: [
        'ORDER_PLACED',
        'SHIPPED',
        'DELIVERED'
      ],
      required: true
    },

    /*
      Snapshot of customer consent.
      Must come from the saved,
      verified order opt-in.
    */

    customerOptedIn: {
      type: Boolean,
      required: true,
      default: false
    },

    /*
      Notification processing states.

      PENDING  = Not attempted yet
      SENDING  = Send attempt claimed
      ACCEPTED = Accepted by Meta API
      FAILED   = Confirmed failure
      UNKNOWN  = Outcome uncertain

      UNKNOWN must not be
      automatically retried.
    */

    status: {
      type: String,
      enum: [
        'PENDING',
        'SENDING',
        'ACCEPTED',
        'FAILED',
        'UNKNOWN'
      ],
      default: 'PENDING',
      required: true,
      index: true
    },

    attemptCount: {
      type: Number,
      default: 0,
      min: 0
    },

    lastAttemptAt: {
      type: Date,
      default: null
    },

    acceptedAt: {
      type: Date,
      default: null
    },

    /*
      Meta WhatsApp message ID.
    */

    providerMessageId: {
      type: String,
      trim: true,
      default: null
    },

    /*
      Store a short diagnostic code,
      not access tokens, customer
      phone numbers or credentials.
    */

    lastErrorCode: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null
    },

    /*
      Delivery confirmation is separate
      from Meta API acceptance.
      These fields can later be updated
      from verified WhatsApp webhooks.
    */

    deliveryStatus: {
      type: String,
      enum: [
        'NOT_CONFIRMED',
        'SENT',
        'DELIVERED',
        'READ',
        'FAILED'
      ],
      default: 'NOT_CONFIRMED'
    },

    deliveredAt: {
      type: Date,
      default: null
    },

    readAt: {
      type: Date,
      default: null
    }

  }, {
    timestamps: true
  });


/*
==========================================
 DUPLICATE PROTECTION

 A single order must have only
 one notification record for
 each notification event.
==========================================
*/

whatsappNotificationSchema.index(
  {
    order: 1,
    event: 1
  },
  {
    unique: true,
    name: 'unique_whatsapp_order_event'
  }
);


/*
==========================================
 LOOKUP INDEXES
==========================================
*/

whatsappNotificationSchema.index({
  status: 1,
  createdAt: -1
});

whatsappNotificationSchema.index({
  providerMessageId: 1
});


/*
==========================================
 EXPORT
==========================================
*/

module.exports = mongoose.model(
  'WhatsAppNotification',
  whatsappNotificationSchema
);
