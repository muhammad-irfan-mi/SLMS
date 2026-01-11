const mongoose = require("mongoose");

const ResultSchema = new mongoose.Schema(
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
    year: { 
      type: Number, 
      required: true 
    },
    marksObtained: { 
      type: Number, 
      required: true 
    },
    totalMarks: { 
      type: Number, 
      required: true 
    },
    percentage: {
      type: Number,
      required: true
    },
    position: {
      type: String,
      enum: ["first", "second", "third", "pass", "fail"],
      required: true,
    },
    image: { 
      type: String 
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

ResultSchema.index({ school: 1, studentId: 1 });
ResultSchema.index({ school: 1, classId: 1, sectionId: 1 });
ResultSchema.index({ school: 1, examType: 1, year: 1 });
ResultSchema.index({ school: 1, position: 1 });

module.exports = mongoose.model("Result", ResultSchema);