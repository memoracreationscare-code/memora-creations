const crypto =
  require('crypto');

const bcrypt =
  require('bcryptjs');

const {
  User
} =
  require('../models');

const {
  asyncHandler,
  error,
  ok
} =
  require('../utils/http');

const {
  cleanString,
  validMobile,
  validPin,
  validEmail
} =
  require('../utils/validation');

const {
  setAuthCookie,
  clearAuthCookie
} =
  require('../middleware/auth');


/* =========================
   PUBLIC USER
========================= */

function publicUser(
  user
) {

  return {

    id:
      user._id,

    fullName:
      user.fullName,

    mobile:
      user.mobile,

    email:
      user.email || '',

    avatar:
      user.avatar || '',

    addresses:
      user.addresses,

    isActive:
      user.isActive

  };

}


/* =========================
   REGISTER
========================= */

const register =
  asyncHandler(
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
        ) ||
        undefined;


      const password =
        String(
          req.body.password ||
          ''
        );


      const address =
        req.body.address ||
        {};


      if (
        fullName.length < 2 ||
        !validMobile(
          mobile
        ) ||
        !validEmail(
          email
        ) ||
        password.length < 8
      ) {

        throw error(
          400,
          'Name, valid mobile, optional valid email and password of at least 8 characters are required.'
        );

      }


      /* Delivery address is optional at sign-up (it is asked again at checkout).
         If any of it is filled in, address line and a 6-digit PIN must both be right. */
      const hasAddress = Boolean(
        cleanString(address.addressLine, 300) ||
        cleanString(String(address.pinCode || ''), 10)
      );

      if (
        hasAddress &&
        (
          !cleanString(address.addressLine, 300) ||
          !validPin(address.pinCode)
        )
      ) {

        throw error(
          400,
          'Address bharein to poora address aur 6 digit PIN code dono sahi hone chahiye.'
        );

      }


      /* Date of birth; under 18 needs a parent / guardian's yes. */
      const consentRules = require('../utils/parentConsent');
      const dateOfBirth = consentRules.parseDob(req.body.dateOfBirth);

      if (!dateOfBirth) {
        throw error(400, 'Apni sahi date of birth chunein.');
      }

      const minor = consentRules.isMinor(dateOfBirth);
      const parentName = cleanString(req.body.parentName, 100);
      const parentEmail = cleanString(req.body.parentEmail, 150).toLowerCase();

      if (minor) {
        if (
          parentName.length < 2 ||
          !parentEmail ||
          !validEmail(parentEmail) ||
          parentEmail === String(email || '').toLowerCase()
        ) {
          throw error(
            400,
            '18 saal se kam umar me parent / guardian ka naam aur unka alag email zaroori hai (aapke apne email se alag).'
          );
        }

        const declared = req.body.parentConsentDeclared;

        if (declared !== true && declared !== 'on' && declared !== 'true') {
          throw error(400, 'Parent / guardian ki sahmati ka box tick karna zaroori hai.');
        }
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


      const consent = minor ? consentRules.newToken() : null;

      const user =
        await User.create({

          fullName,

          mobile,

          email,

          passwordHash,

          dateOfBirth,

          ...(minor
            ? {
                parentConsent: {
                  required: true,
                  status: 'PENDING',
                  parentName,
                  parentEmail,
                  tokenHash: consent.hash,
                  tokenExpiresAt: new Date(Date.now() + consentRules.LINK_DAYS * 86400000),
                  requestedAt: new Date()
                }
              }
            : {}),

          addresses: !hasAddress ? [] : [

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


      /* Under 18: locked until the parent approves. No login cookie yet. */
      if (minor) {
        const sent = await require('./parentConsentController')
          .sendConsentEmail(user, consent.token);

        return ok(
          res,
          {
            pendingParentConsent: true,
            emailSent: sent,
            message: sent
              ? 'Account ban gaya hai, par chalu tab hoga jab aapke parent / guardian email par bheje link se haan karenge.'
              : 'Account ban gaya hai, par parent ko email nahi ja paya. Login page par "Parent ko link dobara bhejein" use karein.'
          },
          201
        );
      }

      // Refer & Earn: never blocks sign-up.
      await require('../services/referralService')
        .applyReferralAtSignup(
          user,
          req.body.referralCode,
          require('../services/settingsService').peek()
        );


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

const login =
  asyncHandler(
    async (req, res) => {

      const mobile =
        cleanString(
          req.body.mobile,
          20
        );


      const password =
        String(
          req.body.password ||
          ''
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

        require('../utils/securityLog').logSecurity('LOGIN_FAILED', req, mobile);

        throw error(
          401,
          'Invalid mobile number or password.'
        );

      }


      if (user.parentConsent && user.parentConsent.status === 'PENDING') {
        throw error(
          403,
          'Aapke parent / guardian ki sahmati baaki hai. Unke email par bheje link se haan karna hoga. Link nahi mila to niche "Parent ko link dobara bhejein" dabayein.'
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

const logout =
  asyncHandler(
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

const me =
  asyncHandler(
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


      const user =
        await User.findOne({
          mobile
        });


      const MESSAGE =
        'Password change karne ka link aapke email par bhej diya gaya hai. Mail na mile (ya account me email na ho) to Customer Support se contact karein.';

      if (user) {
        const now = Date.now();
        const last = user.passwordResetRequestedAt
          ? new Date(user.passwordResetRequestedAt).getTime()
          : 0;
        const locked =
          !user.isActive ||
          Boolean(
            user.parentConsent &&
            ['PENDING', 'DENIED'].includes(user.parentConsent.status)
          );

        // Still shows in Admin -> Customers as "password reset requested".
        user.passwordResetRequestedAt = new Date(now);

        // Emails the link at once; at most one mail every 2 minutes per customer.
        if (!locked && user.email && now - last > 2 * 60 * 1000) {
          const pm = require('../services/passwordMail');
          const link = pm.newLink();

          user.passwordResetTokenHash = link.hash;
          user.passwordResetExpiresAt = new Date(now + 60 * 60 * 1000); // 1 hour
          await user.save();
          await pm.sendResetLink(user, link.token, 'self');
        } else {
          await user.save();
        }
      }

      // Same answer for everyone: a stranger cannot learn which numbers are customers.
      return ok(res, { message: MESSAGE });

    }
  );


/* =========================
   RESET PASSWORD
   OLD TOKEN FLOW
========================= */

const resetPassword =
  asyncHandler(
    async (req, res) => {

      const token =
        String(
          req.body.token ||
          ''
        );


      const password =
        String(
          req.body.password ||
          ''
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


      user.passwordChangedAt = new Date();
      user.passwordResetTokenHash =
        undefined;

      user.passwordResetExpiresAt =
        undefined;

      user.passwordResetRequestedAt =
        null;


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


/* =========================
   EXPORTS
========================= */

module.exports = {

  register,

  login,

  logout,

  me,

  forgotPassword,

  resetPassword

};
