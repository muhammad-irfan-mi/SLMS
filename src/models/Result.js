const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassSection",
      required: true,
    },

    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    examType: {
      type: String,
      enum: ["midterm", "midterm2", "final"],
      required: true,
    },

    year: { type: Number, required: true },

    marksObtained: { type: Number, required: true },
    totalMarks: { type: Number, required: true },

    position: {
      type: String,
      enum: ["first", "second", "third", "pass", "fail"],
      required: true,
    },

    image: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Result", resultSchema);
