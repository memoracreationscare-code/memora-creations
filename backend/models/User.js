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


      addresses: {
        type: [
          addressSchema
        ],
        default: []
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
