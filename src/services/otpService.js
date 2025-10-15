const OTP = require('../models/OTP');
const crypto = require('crypto');

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const createOtp = async ({ email, type }) => {
  const code = generateCode();
  const minutes = parseInt(process.env.OTP_EXPIRATION_MIN || '10');
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

  const otp = new OTP({ email, code, type, expiresAt });
  await otp.save();
  return code;
};

const verifyOtp = async ({ email, code, type }) => {
  const doc = await OTP.findOne({ email, code, type });
  if (!doc) return false;
  if (doc.expiresAt < new Date()) return false;
  await OTP.deleteMany({ email, type });
  return true;
};

module.exports = { createOtp, verifyOtp };