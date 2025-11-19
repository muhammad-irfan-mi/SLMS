const mongoose = require("mongoose");
const { Schema } = mongoose;

const projectSchema = new Schema({
  school: { type: Schema.Types.ObjectId, ref: "School", required: true },
  title: { type: String, required: true },
  description: String,
  classId: { type: Schema.Types.ObjectId, ref: "ClassSection", required: true },
  sectionId: { type: Schema.Types.ObjectId, required: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, 
  assignedAt: { type: Date, default: Date.now },

  targetType: { type: String, enum: ["section", "students"], default: "section" },
  studentIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  attachments: [{ type: String }],
  deadline: { type: String },
  maxMarks: Number,
  status: { type: String, enum: ["draft", "assigned", "completed", "graded"], default: "assigned" }
}, { timestamps: true });

module.exports = mongoose.model("Project", projectSchema);
