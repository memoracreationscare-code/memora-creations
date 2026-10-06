const { Order } = require('../models');

const {
  createShiprocketOrder
} = require('../services/shiprocketService');


async function createShipment(req, res) {

  try {

    const order =
      await Order.findById(req.params.id)
        .populate(
          'user',
          'fullName mobile email'
        );


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
  createShipment
};
