const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const { User } = require('../models');

const {
  asyncHandler,
  error,
  ok
} = require('../utils/http');

const {
  cleanString,
  validMobile,
  validPin,
  validEmail
} = require('../utils/validation');

const {
  setAuthCookie,
  clearAuthCookie
} = require('../middleware/auth');


function publicUser(user) {

  return {
    id: user._id,
    fullName: user.fullName,
    mobile: user.mobile,
    email: user.email || '',
    addresses: user.addresses,
    isActive: user.isActive
  };

}


/* =========================
   REGISTER
========================= */

const register = asyncHandler(
  async (req, res) => {

    const fullName =
      cleanString(
        req.body.fullName,
        100
      );

    const mobile =
      cleanString(
        req.body.mobile,
        20
      );

    const email =
      cleanString(
        req.body.email,
        150
      ) || undefined;

    const password =
      String(
        req.body.password || ''
      );

    const address =
      req.body.address || {};


    if (
      fullName.length < 2 ||
      !validMobile(mobile) ||
      !validEmail(email) ||
      password.length < 8
    ) {

      throw error(
        400,
        'Name, valid mobile, optional valid email and password of at least 8 characters are required.'
      );

    }


    if (
      !cleanString(
        address.addressLine,
        300
      ) ||
      !validPin(
        address.pinCode
      )
    ) {

      throw error(
        400,
        'A valid address and 6-digit PIN code are required.'
      );

    }


    if (
      await User.findOne({
        mobile
      })
    ) {

      throw error(
        409,
        'Mobile number is already registered.'
      );

    }


    if (
      email &&
      await User.findOne({
        email
      })
    ) {

      throw error(
        409,
        'Email is already registered.'
      );

    }


    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );


    const user =
      await User.create({

        fullName,

        mobile,

        email,

        passwordHash,

        addresses: [

          {

            label:
              'Home',

            fullName,

            mobile,

            addressLine:
              cleanString(
                address.addressLine,
                300
              ),

            pinCode:
              String(
                address.pinCode
              ),

            city:
              cleanString(
                address.city,
                80
              ),

            state:
              cleanString(
                address.state,
                80
              ),

            isDefault:
              true

          }

        ]

      });


    setAuthCookie(
      res,
      {
        sub:
          String(
            user._id
          ),

        type:
          'user'
      }
    );


    return ok(
      res,
      {
        message:
          'Registration successful.',

        user:
          publicUser(
            user
          )
      },
      201
    );

  }
);


/* =========================
   LOGIN
========================= */

const login = asyncHandler(
  async (req, res) => {

    const mobile =
      cleanString(
        req.body.mobile,
        20
      );

    const password =
      String(
        req.body.password || ''
      );


    if (
      !validMobile(
        mobile
      ) ||
      !password
    ) {

      throw error(
        400,
        'Valid mobile number and password are required.'
      );

    }


    const user =
      await User
        .findOne({
          mobile
        })
        .select(
          '+passwordHash'
        );


    if (
      !user ||
      !user.isActive ||
      !(
        await bcrypt.compare(
          password,
          user.passwordHash
        )
      )
    ) {

      throw error(
        401,
        'Invalid mobile number or password.'
      );

    }


    user.lastLoginAt =
      new Date();


    await user.save();


    setAuthCookie(
      res,
      {
        sub:
          String(
            user._id
          ),

        type:
          'user'
      }
    );


    return ok(
      res,
      {

        message:
          'Login successful.',

        user:
          publicUser(
            user
          )

      }
    );

  }
);


/* =========================
   LOGOUT
========================= */

const logout = asyncHandler(
  async (_req, res) => {

    clearAuthCookie(
      res
    );


    return ok(
      res,
      {
        message:
          'Logged out successfully.'
      }
    );

  }
);


/* =========================
   CURRENT USER
========================= */

const me = asyncHandler(
  async (req, res) => {

    return ok(
      res,
      {
        user:
          publicUser(
            req.user
          )
      }
    );

  }
);


/* =========================
   FORGOT PASSWORD
========================= */

const forgotPassword =
  asyncHandler(
    async (req, res) => {

      const mobile =
        cleanString(
          req.body.mobile,
          20
        );


      if (
        !validMobile(
          mobile
        )
      ) {

        throw error(
          400,
          'Valid mobile number is required.'
        );

      }


      return ok(
        res,
        {
          message:
            'Password reset ke liye support se contact karein.'
        }
      );

    }
  );


/* =========================
   RESET PASSWORD
========================= */

const resetPassword =
  asyncHandler(
    async (req, res) => {

      const token =
        String(
          req.body.token || ''
        );

      const password =
        String(
          req.body.password || ''
        );


      if (
        token.length < 20 ||
        password.length < 8
      ) {

        throw error(
          400,
          'Invalid reset request.'
        );

      }


      const hash =
        crypto
          .createHash(
            'sha256'
          )
          .update(
            token
          )
          .digest(
            'hex'
          );


      const user =
        await User
          .findOne({

            passwordResetTokenHash:
              hash,

            passwordResetExpiresAt: {
              $gt:
                new Date()
            }

          })
          .select(
            '+passwordHash +passwordResetTokenHash +passwordResetExpiresAt'
          );


      if (!user) {

        throw error(
          400,
          'Reset link is invalid or expired.'
        );

      }


      user.passwordHash =
        await bcrypt.hash(
          password,
          12
        );


      user.passwordResetTokenHash =
        undefined;

      user.passwordResetExpiresAt =
        undefined;


      await user.save();


      return ok(
        res,
        {
          message:
            'Password reset successful. Please login.'
        }
      );

    }
  );


module.exports = {

  register,

  login,

  logout,

  me,

  forgotPassword,

  resetPassword

};
