const mongoose = require("mongoose");
const { Schema } = mongoose;

const noticeSchema = new Schema({
  school: { type: Schema.Types.ObjectId, ref: "School", required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  target: { 
    type: String,
    enum: ["all_teachers", "selected_teachers", "all_students", "selected_students", "all", "custom",'class'],
    default: "all"
  },
  targetTeacherIds: [{ type: Schema.Types.ObjectId, ref: "User" }], 
  targetStudentIds: [{ type: Schema.Types.ObjectId, ref: "User" }], 
  classId: { type: Schema.Types.ObjectId, ref: "ClassSection" }, 
  sectionId: { type: Schema.Types.ObjectId },
  category: { type: String, enum: ["notice","meeting","holiday","general"], default: "notice" },
  startDate: { type: String }, 
  endDate: { type: String }, 
  pinned: { type: Boolean, default: false },
  attachments: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model("Notice", noticeSchema);
