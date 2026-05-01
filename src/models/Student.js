const mongoose = require("mongoose");
const { baseUserSchema } = require("./BaseUser");

const StudentSchema = new mongoose.Schema({
  ...baseUserSchema,
  username: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  role: {
    type: String,
    enum: ["student"],
    default: "student",
    required: true
  },
  classInfo: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection" },
    // name: String
  },
  sectionInfo: {
    id: { type: mongoose.Schema.Types.ObjectId },
    // name: String
  },
  rollNo: {
    type: String,
    index: true
  },
  // parentEmail: {
  //   type: String,
  //   lowercase: true,
  //   index: true
  // },
  // siblingGroupId: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: "Student",
  //   index: true,
  //   default: null
  // },
  deviceLocation: {
    lat: Number,
    lng: Number,
  },
  isFixed: {
    type: Boolean,
    default: false
  },
  discount: {
    type: Number,
    min: 0,
    // max: 100,
    default: 0
  },
  isDefaulter: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'passout', 'left'],
    default: 'active'
  },
  historyInfo: {
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection" },
    sectionId: { type: mongoose.Schema.Types.ObjectId },
    date: { type: Date },
  }
  // enrollmentDate: {
  //   type: Date,
  //   default: Date.now,
  //   index: true
  // }
}, {
  timestamps: true,
  collection: 'students'
});

StudentSchema.index({ school: 1, username: 1 }, { unique: true });
StudentSchema.index({ school: 1, email: 1 });
StudentSchema.index({ school: 1, "classInfo.id": 1, "sectionInfo.id": 1, rollNo: 1 }, { unique: true, sparse: true });
// StudentSchema.index({ school: 1, parentEmail: 1 });
// StudentSchema.index({ siblingGroupId: 1 });
// StudentSchema.index({ school: 1, enrollmentDate: 1 });
StudentSchema.index({ school: 1, status: 1 });
StudentSchema.index({ school: 1, "leftInfo.date": 1 });
StudentSchema.index({ "otp.expiresAt": 1 }, {
  expireAfterSeconds: 0,
  partialFilterExpression: { "otp.expiresAt": { $exists: true }, verified: false }
});
StudentSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { verified: false } }
);

module.exports = mongoose.model("Student", StudentSchema);