const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },

    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    studentName: String,
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection" },
    sectionId: { type: mongoose.Schema.Types.ObjectId },

    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    teacherName: String,

    userType: { type: String, enum: ["student", "teacher"], default: "student" },
    dates: [{
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/ 
    }],
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

leaveSchema.index({ school: 1, userType: 1, status: 1 });
leaveSchema.index({ school: 1, studentId: 1 });
leaveSchema.index({ school: 1, teacherId: 1 });

// Index for checking specific dates
leaveSchema.index({ "dates": 1 });

module.exports = mongoose.model("Leave", leaveSchema);