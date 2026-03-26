const mongoose = require("mongoose");

const baseUserSchema = {
    email: {
        type: String,
        required: true,
        lowercase: true,
        index: true
    },
    cnic: { type: String },
    name: { type: String, required: true },
    fatherName: String,
    phone: String,
    address: String,
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "School",
        required: function() {
      if (this.role === 'superadmin') {
        return false;
      }
      return true;
    }
    },
    password: {
        type: String,
        select: false
    },
    images: {
        cnicFront: String,
        cnicBack: String,
        recentPic: String,
    },
    otp: {
        code: String,
        expiresAt: Date,
        attempts: { type: Number, default: 0 },
        lastAttempt: Date
    },
    forgotPasswordOTP: {
        code: String,
        expiresAt: Date,
        attempts: { type: Number, default: 0 },
        lastAttempt: Date,
        verified: { type: Boolean, default: false }
    },
    verificationExpiresAt: Date,
    verified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    deactivatedAt: Date,
    tokenVersion: { type: Number, default: 0 }
};

module.exports = { baseUserSchema };