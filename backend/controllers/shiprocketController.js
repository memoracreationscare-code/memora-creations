const { Order } = require('../models');

const {
  createShiprocketOrder,
  checkCourierServiceability
} = require('../services/shiprocketService');


async function getOrder(req) {

  const order =
    await Order.findById(req.params.id)
      .populate(
        'user',
        'fullName mobile email'
      );

  return order;
}


/* =========================
   CHECK COURIER RATES
========================= */

async function checkCourierRates(req, res) {

  try {

    const order =
      await getOrder(req);


    if (!order) {

      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });

    }


    if (order.orderStatus === 'Cancelled') {

      return res.status(400).json({
        success: false,
        message:
          'Cancelled order cannot be shipped.'
      });

    }


    const weight =
      Number(req.body.weight);

    const length =
      Number(req.body.length);

    const width =
      Number(req.body.width);

    const height =
      Number(req.body.height);


    if (
      !weight ||
      !length ||
      !width ||
      !height ||
      weight <= 0 ||
      length <= 0 ||
      width <= 0 ||
      height <= 0
    ) {

      return res.status(400).json({
        success: false,
        message:
          'Valid package weight and dimensions are required.'
      });

    }


    const deliveryPincode =
      String(
        order.shippingAddress?.pinCode || ''
      );


    const result =
      await checkCourierServiceability({

        pickupLocation:
          req.body.pickupLocation ||
          'Home',

        deliveryPincode,

        weight,
        length,
        width,
        height,

        cod:
          order.paymentMethod === 'COD',

        declaredValue:
          Number(order.grandTotal || 0)

      });


    const couriers =
      (result.couriers || [])
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
            item.rating,

          cod:
            item.cod,

          pickupAvailability:
            item.pickup_availability,

          deliveryPerformance:
            item.delivery_performance

        }));


    return res.json({

      success: true,

      message:
        couriers.length
          ? 'Courier options found.'
          : 'No courier available for this route.',

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
      error
    );


    return res.status(500).json({

      success: false,

      message:
        error.message ||
        'Failed to check courier rates.'

    });

  }

}


/* =========================
   CREATE SHIPMENT
========================= */

async function createShipment(req, res) {

  try {

    const order =
      await getOrder(req);


    if (!order) {

      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });

    }


    if (order.orderStatus === 'Cancelled') {

      return res.status(400).json({
        success: false,
        message:
          'Cancelled order cannot be shipped.'
      });

    }


    const weight =
      Number(req.body.weight);

    const length =
      Number(req.body.length);

    const width =
      Number(req.body.width);

    const height =
      Number(req.body.height);


    if (
      !weight ||
      !length ||
      !width ||
      !height ||
      weight <= 0 ||
      length <= 0 ||
      width <= 0 ||
      height <= 0
    ) {

      return res.status(400).json({
        success: false,
        message:
          'Valid package weight and dimensions are required.'
      });

    }


    const shiprocket =
      await createShiprocketOrder(
        order,
        {
          weight,
          length,
          width,
          height,

          pickupLocation:
            req.body.pickupLocation ||
            'Home'
        }
      );


    return res.json({

      success: true,

      message:
        'Shipment created successfully in Shiprocket.',

      shiprocket

    });


  } catch (error) {

    console.error(
      'Create Shiprocket shipment error:',
      error
    );


    return res.status(500).json({

      success: false,

      message:
        error.message ||
        'Failed to create shipment.'

    });

  }

}


module.exports = {
  checkCourierRates,
  createShipment
};
