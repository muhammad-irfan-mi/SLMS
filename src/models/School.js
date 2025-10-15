const mongoose = require("mongoose");
const { Schema } = mongoose;

const SchoolSchema = new Schema({
  name: { type: String, required: true },
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
  location: {
    lat: Number,
    lon: Number,
  },
  noOfStudents: { type: Number, default: 0 },
  otp: {
    code: String,
    expiresAt: Date,
  },

  createdAt: { type: Date, default: Date.now },
});

SchoolSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60, partialFilterExpression: { verified: false } });

module.exports = mongoose.model("School", SchoolSchema);
