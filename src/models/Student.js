const mongoose = require('mongoose');
const { Schema } = mongoose;

const StudentSchema = new Schema({
  school: { type: Schema.Types.ObjectId, ref: 'School', required: true },
  studentId: { type: String, required: true },
  name: { type: String, required: true },
  cnic: String,
  email: String,
  phone: String,
  fatherName: String,
  guardianName: String,
  relationshipWithGuardian: String,
  address: String,
  section: String,
  recentPic: String,
  emergencyContact: String,
  location: { lat: Number, lng: Number },
  otp: {
    code: String,
    expiresAt: Date,
  },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

StudentSchema.index({ studentId: 1, school: 1 }, { unique: true });

module.exports = mongoose.model('Student', StudentSchema);