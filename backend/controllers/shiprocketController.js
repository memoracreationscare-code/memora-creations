const { Order } = require('../models');

const {
  createShiprocketOrder,
  checkCourierServiceability,
  assignCourierAwb
} = require('../services/shiprocketService');


async function getOrder(req) {

  return Order.findById(req.params.id)
    .populate(
      'user',
      'fullName mobile email'
    );

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


    const result =
      await checkCourierServiceability({

        pickupLocation:
          req.body.pickupLocation ||
          'Home',

        deliveryPincode:
          String(
            order.shippingAddress?.pinCode ||
            ''
          ),

        weight,
        length,
        width,
        height,

        cod:
          order.paymentMethod === 'COD',

        declaredValue:
          Number(
            order.grandTotal || 0
          )

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
            item.rating

        }));


    return res.json({

      success: true,

      message:
        couriers.length
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
   CREATE SHIPMENT + AWB
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

    const courierCompanyId =
      Number(req.body.courierCompanyId);


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


    if (
      !courierCompanyId ||
      courierCompanyId <= 0
    ) {

      return res.status(400).json({
        success: false,
        message:
          'Please select a courier first.'
      });

    }


    const shiprocketOrder =
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


    const shipmentId =
      Number(
        shiprocketOrder.shipment_id
      );


    if (
      !shipmentId ||
      shipmentId <= 0
    ) {

      return res.status(500).json({
        success: false,
        message:
          'Shiprocket shipment ID not received.'
      });

    }


    const awb =
      await assignCourierAwb({

        shipmentId,

        courierCompanyId

      });


    return res.json({

      success: true,

      message:
        'Shipment created and AWB generated successfully.',

      shiprocketOrder,

      awb

    });


  } catch (error) {

    console.error(
      'Create shipment/AWB error:',
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
