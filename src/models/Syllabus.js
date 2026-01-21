const mongoose = require("mongoose");
const { Schema } = mongoose;

const syllabusSchema = new Schema(
  {
    school: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "ClassSection",
      required: true,
    },
    sectionId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    detail: {
      type: String,
      trim: true,
      maxlength: 5000,
    },

    uploadedBy: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'uploadedByModel'
    },
    uploadedByModel: {
      type: String,
      required: true,
      enum: ['User', 'School']
    },

    publishDate: {
      type: String,
    },
    expireDate: {
      type: String,
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
  },
  { timestamps: true }
);

syllabusSchema.index({ school: 1, classId: 1, sectionId: 1 });
syllabusSchema.index({ school: 1, subjectId: 1 });
syllabusSchema.index({ school: 1, status: 1, publishDate: -1 });
syllabusSchema.index({ school: 1, sectionId: 1, status: 1 });
syllabusSchema.index({ uploadedBy: 1, uploadedByModel: 1 });

module.exports = mongoose.model("Syllabus", syllabusSchema);