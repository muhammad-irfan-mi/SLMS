const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },

    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User"},
    studentName: String,
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection" },
    sectionId: { type: mongoose.Schema.Types.ObjectId },

    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User"},
    teacherName: String,

    userType: { type: String, enum: ["student", "teacher"], default: "student" },
    date: { type: String, required: true },
    subject: { type: String, required: true },
    reason: { type: String, required: true },
    appliedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    remark: String,
  },
  { timestamps: true }
);

leaveSchema.index({ school: 1, studentId: 1, date: 1 }, { unique: false });

module.exports = mongoose.model("Leave", leaveSchema);
