const mongoose = require("mongoose");
const { Schema } = mongoose;

const SubjectSchema = new Schema(
  {
    name: { type: String, required: true },
    code: String,
    description: String,

    school: { type: Schema.Types.ObjectId, ref: "School", required: true },
    classId: { type: Schema.Types.ObjectId, ref: "ClassSection", required: true },
    sectionId: { type: Schema.Types.ObjectId },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subject", SubjectSchema);
