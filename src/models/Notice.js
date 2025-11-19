const mongoose = require("mongoose");
const { Schema } = mongoose;

const noticeSchema = new Schema({
  school: { type: Schema.Types.ObjectId, ref: "School", required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  target: { // who should see it
    type: String,
    enum: ["all_teachers", "selected_teachers", "all_students", "selected_students", "all", "custom"],
    default: "all"
  },
  targetTeacherIds: [{ type: Schema.Types.ObjectId, ref: "User" }], // when selected_teachers/custom
  targetStudentIds: [{ type: Schema.Types.ObjectId, ref: "User" }], // when selected_students/custom
  classId: { type: Schema.Types.ObjectId, ref: "ClassSection" }, // optional
  sectionId: { type: Schema.Types.ObjectId }, // optional
  category: { type: String, enum: ["notice","meeting","holiday","general"], default: "notice" },
  startDate: { type: String }, // when notice becomes active
  endDate: { type: String }, // optional
  pinned: { type: Boolean, default: false },
  attachments: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model("Notice", noticeSchema);
