const mongoose = require("mongoose");
const { Schema } = mongoose;

const syllabusSchema = new Schema({
  school: { type: Schema.Types.ObjectId, ref: "School", required: true },
  classId: { type: Schema.Types.ObjectId, ref: "ClassSection", required: true },
  sectionId: { type: Schema.Types.ObjectId, required: true }, 
  subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },

  title: { type: String, required: true },
  description: { type: String },
  detail: { type: String },
//   files: [{ type: String }], 
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

  publishDate: { type: String }, 
  expireDate: { type: String },

  status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
}, { timestamps: true });

module.exports = mongoose.model("Syllabus", syllabusSchema);
