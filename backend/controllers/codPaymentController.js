
/*
=========================================
 MEMORA CREATIONS
 COD PAYMENT CONTROLLER

 ADMIN PAYMENT CONFIRMATION
=========================================
*/

const mongoose = require('mongoose');

const {
  Order
} = require('../models');

const {
  asyncHandler,
  error,
  ok
} = require('../utils/http');


/* =====================================
   MARK COD PAYMENT AS RECEIVED
===================================== */

const markCodPaid = asyncHandler(
  async (req, res) => {

    const orderId = req.params.id;

    if (!mongoose.isValidObjectId(orderId)) {
      throw error(
        400,
        'Invalid order ID.'
      );
    }

    /*
      Admin must explicitly confirm
      that money has been received.
    */

    if (req.body?.confirmed !== true) {
      throw error(
        400,
        'Please confirm COD payment receipt.'
      );
    }

    /*
      Only delivered COD orders
      with pending payment qualify.

      Atomic condition prevents
      duplicate payment updates.
    */

    const order = await Order.findOneAndUpdate(
      {
        _id: orderId,
        paymentMethod: 'COD',
        paymentStatus: 'COD_PENDING',
        orderStatus: 'Delivered'
      },
      {
        $set: {
          paymentStatus: 'SUCCESS'
        },
        $push: {
          statusHistory: {
            status: 'Delivered',
            note:
              'COD payment received and confirmed by admin.',
            changedAt: new Date()
          }
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!order) {

      const existing = await Order.findById(
        orderId
      );

      if (!existing) {
        throw error(
          404,
          'Order not found.'
        );
      }

      if (
        existing.paymentMethod === 'COD' &&
        existing.paymentStatus === 'SUCCESS' &&
        existing.orderStatus === 'Delivered'
      ) {
        return ok(res, {
          message:
            'COD payment already confirmed.',
          order: existing
        });
      }

      throw error(
        409,
        'Only delivered COD orders with pending payment can be marked Paid.'
      );
    }

    return ok(res, {
      message:
        'COD payment marked as received.',
      order
    });

  }
);


/* =====================================
   EXPORT
===================================== */

module.exports = {
  markCodPaid
};
