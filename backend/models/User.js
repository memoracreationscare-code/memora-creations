const mongoose =
  require('mongoose');

const validator =
  require('validator');


/* =========================
   ADDRESS SCHEMA
========================= */

const addressSchema =
  new mongoose.Schema(
    {

      label: {
        type: String,
        trim: true,
        maxlength: 40,
        default: 'Home'
      },

      fullName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100
      },

      mobile: {
        type: String,
        required: true,
        trim: true,
        match: /^[6-9]\d{9}$/
      },

      addressLine: {
        type: String,
        required: true,
        trim: true,
        minlength: 5,
        maxlength: 300
      },

      pinCode: {
        type: String,
        required: true,
        trim: true,
        match: /^\d{6}$/
      },

      city: {
        type: String,
        trim: true,
        maxlength: 80
      },

      state: {
        type: String,
        trim: true,
        maxlength: 80
      },

      isDefault: {
        type: Boolean,
        default: false
      }

    },
    {
      _id: true,
      timestamps: true
    }
  );


/* =========================
   USER SCHEMA
========================= */

const userSchema =
  new mongoose.Schema(
    {

      fullName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100
      },


      mobile: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
        match: /^[6-9]\d{9}$/
      },


      email: {

        type: String,

        trim: true,

        lowercase: true,

        sparse: true,

        unique: true,

        validate: {

          validator:
            value =>
              !value ||
              validator.isEmail(
                value
              ),

          message:
            'Invalid email address.'

        }

      },


      passwordHash: {
        type: String,
        required: true,
        select: false
      },

      // Logins issued before this moment stop working (set on every password change).
      passwordChangedAt: {
        type: Date,
        default: null
      },


      // Small profile photo stored as an image data URL
      // (resized in the browser to about 256px).
      avatar: {
        type: String,
        default: '',
        maxlength: 120000
      },


      addresses: {
        type: [
          addressSchema
        ],
        default: []
      },


      // Refer & Earn
      referralCode: {
        type: String,
        unique: true,
        sparse: true,
        uppercase: true,
        trim: true
      },

      referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: undefined
      },

      referredAt: {
        type: Date,
        default: undefined
      },

      // Coupon codes given because of this referral (for the history view).
      referralFriendCode: {
        type: String,
        default: undefined
      },

      referralRewardCode: {
        type: String,
        default: undefined
      },

      referralRewardedAt: {
        type: Date,
        default: undefined
      },

      referralRewarded: {
        type: Boolean,
        default: undefined
      },

      /* Date of birth (asked at sign-up). Old accounts have none. */
      dateOfBirth: {
        type: Date,
        default: undefined
      },

      /* Parent / guardian consent for sign-ups under 18 (see utils/parentConsent.js). */
      parentConsent: {
        required: { type: Boolean, default: undefined },
        status: { type: String, enum: ['PENDING', 'GRANTED', 'DENIED'], default: undefined },
        parentName: { type: String, maxlength: 100 },
        parentEmail: { type: String, maxlength: 150 },
        tokenHash: { type: String, select: false },
        tokenExpiresAt: { type: Date, select: false },
        requestedAt: Date,
        decidedAt: Date
      },

      /* Birthday as "MM-DD" (no year). Used for one birthday notification a year. */
      birthday: {
        type: String,
        match: /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
        default: undefined
      },

      birthdayPushYear: {
        type: Number,
        default: undefined
      },

      /* "Khaas din" the customer saved (Maa ka birthday, anniversary...). One reminder email a year per entry. */
      specialDates: {
        type: [new mongoose.Schema({
          name: { type: String, trim: true, maxlength: 60, required: true },
          occasion: { type: String, enum: ['Birthday', 'Anniversary', 'Other'], default: 'Birthday' },
          date: { type: String, match: /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, required: true },
          remindYear: { type: Number, default: undefined }
        })],
        default: undefined
      },

      /* Year the birthday email was last sent (one per year). */
      birthdayEmailYear: {
        type: Number,
        default: undefined
      },

      isActive: {
        type: Boolean,
        default: true,
        index: true
      },


      /* =========================
         PASSWORD RESET REQUEST
      ========================= */

      passwordResetRequestedAt: {
        type: Date,
        default: null,
        index: true
      },


      passwordResetTokenHash: {
        type: String,
        select: false
      },


      passwordResetExpiresAt: {
        type: Date,
        select: false
      },


      lastLoginAt: {
        type: Date
      }

    },
    {
      timestamps: true
    }
  );


/* =========================
   INDEXES
========================= */

userSchema.index(
  {
    email: 1
  },
  {
    unique: true,
    sparse: true
  }
);


userSchema.index(
  {
    mobile: 1
  },
  {
    unique: true
  }
);


/* =========================
   EXPORT
========================= */

module.exports =
  mongoose.model(
    'User',
    userSchema
  );
