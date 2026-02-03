const mongoose = require("mongoose");
const { Schema } = mongoose;

const noticeSchema = new Schema({
  school: { type: Schema.Types.ObjectId, ref: "School", required: true },
  requestedByModel: {
    type: String,
    enum: ['User', 'School'],
    default: 'User'
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  target: {
    type: String,
    enum: ["all_teachers", "selected_teachers", "all_students", "selected_students", "all", "custom", 'class', 'admin'],
    default: "all"
  },
  targetTeacherIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  targetStudentIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  targetAdminIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  classId: { type: Schema.Types.ObjectId, ref: "ClassSection" },
  sectionId: { type: Schema.Types.ObjectId },
  category: { type: String, enum: ["notice", "meeting", "holiday", "general"], default: "notice" },
  startDate: { type: String },
  endDate: { type: String },
  pinned: { type: Boolean, default: false },
  attachments: [{ type: String }],
  readBy: [{
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    readAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

noticeSchema.index({ "readBy.user": 1 });

module.exports = mongoose.model("Notice", noticeSchema);
