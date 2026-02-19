const mongoose = require("mongoose");
const { Schema } = mongoose;

const UserSchema = new Schema({
  username: {
    type: String,
    lowercase: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    index: true
  },
  cnic: { type: String },
  name: { type: String, required: true },
  fatherName: String,
  phone: String,
  address: String,
  role: {
    type: String,
    enum: ["superadmin", "admin_office", "teacher", "student"],
    required: true,
  },
  school: {
    type: Schema.Types.ObjectId,
    ref: "School",
    required: function () {
      return this.role !== "superadmin";
    },
  },
  password: String,
  salary: Number,
  joiningDate: Date,
  isIncharge: { type: Boolean, default: false },
  classInfo: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection" },
  },
  sectionInfo: {
    id: { type: mongoose.Schema.Types.ObjectId },
  },
  rollNo: String,
  images: {
    cnicFront: String,
    cnicBack: String,
    recentPic: String,
  },
  deviceLocation: {
    lat: Number,
    lng: Number,
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

  verificationExpiresAt: {
    type: Date
  },

  verified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  deactivatedAt: {
    type: Date,
    default: null
  },
  tokenVersion: { type: Number, default: 0 },
  parentEmail: { type: String },
  siblingGroupId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

// UserSchema.index({ "otp.expiresAt": 1 }, {
//   expireAfterSeconds: 0,
//   partialFilterExpression: {
//     "otp.expiresAt": { $exists: true },
//     verified: false
//   }
// });

UserSchema.index(
  { verificationExpiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { verified: false }
  }
);

UserSchema.index(
  { email: 1, school: 1, role: 1 },
  {
    unique: true,
    sparse: true,
    name: "unique_email_per_school_role",
    partialFilterExpression: {
      role: { $in: ["superadmin", "admin_office", "teacher"] }
    }
  }
);

UserSchema.index(
  { username: 1, email: 1, school: 1 },
  {
    unique: true,
    sparse: true,
    name: "unique_username_per_email_school",
    partialFilterExpression: {
      role: "student",
      username: { $exists: true, $ne: null }
    }
  }
);
// UserSchema.index(
//   { email: 1, role: 1 },
//   {
//     unique: true,
//     partialFilterExpression: {
//       role: { $in: ["superadmin", "admin_office", "teacher"] }
//     }
//   }
// );

UserSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 7 * 24 * 60 * 60,
    partialFilterExpression: { verified: false },
  }
);
UserSchema.index({ school: 1, role: 1 });
UserSchema.index({ school: 1, "classInfo.id": 1 });
UserSchema.index({ school: 1, "sectionInfo.id": 1 });
UserSchema.index({ school: 1, rollNo: 1 });


module.exports = mongoose.model("User", UserSchema);