
/*
=========================================
 MEMORA CREATIONS
 AUTHENTICATION MIDDLEWARE

 SEPARATE CUSTOMER + ADMIN SESSIONS
=========================================
*/

const jwt = require('jsonwebtoken');

const {
  User,
  Admin
} = require('../models');


/* =====================================
   COOKIE NAMES
===================================== */

const USER_COOKIE = 'memora_user_token';

const ADMIN_COOKIE = 'memora_admin_token';


/* =====================================
   TOKEN
===================================== */

function signToken(payload) {

  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {
      expiresIn:
        process.env.JWT_EXPIRES_IN || '7d'
    }
  );

}


/* =====================================
   COOKIE OPTIONS
===================================== */

function cookieOptions() {

  const production =
    process.env.NODE_ENV === 'production';

  return {

    httpOnly: true,

    secure: production,

    sameSite:
      process.env.COOKIE_SAMESITE ||
      (production ? 'none' : 'lax'),

    maxAge:
      7 * 24 * 60 * 60 * 1000,

    path: '/'

  };

}


/* =====================================
   SELECT COOKIE BY ACCOUNT TYPE
===================================== */

function cookieName(type) {

  return type === 'admin'
    ? ADMIN_COOKIE
    : USER_COOKIE;

}


/* =====================================
   SET LOGIN COOKIE
===================================== */

function setAuthCookie(res, payload) {

  if (
    !payload ||
    !['user', 'admin'].includes(payload.type)
  ) {
    throw new Error(
      'Invalid authentication type.'
    );
  }

  res.cookie(

    cookieName(payload.type),

    signToken(payload),

    cookieOptions()

  );

}


/* =====================================
   CLEAR LOGIN COOKIE

   Existing controllers call this
   without passing an account type.

   Clear both only when explicitly
   requested; default is customer.

===================================== */

function clearAuthCookie(res, type = 'user') {

  const options = cookieOptions();

  delete options.maxAge;

  res.clearCookie(
    cookieName(type),
    options
  );

}


/* =====================================
   CUSTOMER AUTH
===================================== */

async function requireUser(req, res, next) {

  try {

    const token =
      req.cookies?.[USER_COOKIE];

    if (!token) {

      return res.status(401).json({

        success: false,

        message:
          'Customer login required.'

      });

    }

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (payload.type !== 'user') {

      return res.status(401).json({

        success: false,

        message:
          'Invalid customer session.'

      });

    }

    const user = await User.findById(
      payload.sub
    );

    if (!user || !user.isActive) {

      return res.status(401).json({

        success: false,

        message:
          'Customer account unavailable.'

      });

    }

    req.user = user;

    return next();

  } catch (err) {

    return res.status(401).json({

      success: false,

      message:
        'Customer session expired. Login again.'

    });

  }

}


/* =====================================
   ADMIN AUTH
===================================== */

async function requireAdmin(req, res, next) {

  try {

    const token =
      req.cookies?.[ADMIN_COOKIE];

    if (!token) {

      return res.status(401).json({

        success: false,

        message:
          'Admin login required.'

      });

    }

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (payload.type !== 'admin') {

      return res.status(403).json({

        success: false,

        message:
          'Admin access required.'

      });

    }

    const admin = await Admin.findById(
      payload.sub
    );

    if (!admin || !admin.isActive) {

      return res.status(403).json({

        success: false,

        message:
          'Admin account unavailable.'

      });

    }

    req.admin = admin;

    return next();

  } catch (err) {

    return res.status(401).json({

      success: false,

      message:
        'Admin session expired. Login again.'

    });

  }

}


/* =====================================
   EXPORTS
===================================== */

module.exports = {

  signToken,

  setAuthCookie,

  clearAuthCookie,

  requireUser,

  requireAdmin

};
