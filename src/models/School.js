const { boolean } = require("joi");
const mongoose = require("mongoose");
const { Schema } = mongoose;

const SchoolSchema = new Schema({
  name: { type: String, required: true, unique: true },
  address: String,
  email: { type: String, required: true, unique: true },
  phone: String,
  cnic: String,
  password: String,
  images: {
    cnicFront: String,
    cnicBack: String,
    nocDoc: String,
  },
  schoolId: { type: String, required: true, unique: true },
  verified: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  location: {
    lat: Number,
    lon: Number,
  },
  noOfStudents: { type: Number, default: 0 },
  otp: {
    code: String,
    expiresAt: Date,
    attempts: { type: Number, default: 0 },
    lastAttempt: Date
  },
  tempData: {
    name: String,
    email: String,
    phone: String,
    address: String,
    cnic: String,
    images: {
      cnicFront: String,
      cnicBack: String,
      nocDoc: String,
    },
    location: {
      lat: Number,
      lon: Number,
    },
    noOfStudents: Number,
  },
  createdAt: { type: Date, default: Date.now },
});

SchoolSchema.index({ createdAt: 1 }, {
  expireAfterSeconds: 24 * 60 * 60,
  partialFilterExpression: { verified: false }
});

SchoolSchema.index({ "otp.expiresAt": 1 }, {
  expireAfterSeconds: 0,
  partialFilterExpression: {
    "otp.expiresAt": { $exists: true },
    verified: false
  }
});

module.exports = mongoose.model("School", SchoolSchema);