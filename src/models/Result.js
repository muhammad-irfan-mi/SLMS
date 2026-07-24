const mongoose = require("mongoose");

const SubjectResultSchema = new mongoose.Schema(
  {
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true
    },

    totalMarks: {
      type: Number,
      required: true,
      min: 0
    },

    obtainedMarks: {
      type: Number,
      required: true,
      min: 0
    },

    remarks: {
      type: String,
      default: ""
    }
  },
  { _id: false }
);

const ResultSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true
    },

    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassSection",
      required: true,
      index: true
    },

    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },

    examType: {
      type: String,
      enum: ["midterm", "midterm2", "final"],
      required: true,
      index: true
    },

    year: {
      type: Number,
      required: true,
      index: true
    },

    subjects: {
      type: [SubjectResultSchema],
      validate: {
        validator: value => value.length > 0,
        message: "At least one subject is required."
      }
    },

    totalMarks: {
      type: Number,
      required: true,
      default: 0
    },

    obtainedMarks: {
      type: Number,
      required: true,
      default: 0
    },

    percentage: {
      type: Number,
      default: 0
    },

    grade: {
      type: String,
      default: ""
    },

    remarks: {
      type: String,
      default: ""
    },

    image: {
      type: String
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff"
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff"
    }
  },
  {
    timestamps: true
  }
);

ResultSchema.index(
  {
    school: 1,
    studentId: 1,
    examType: 1,
    year: 1
  },
  {
    unique: true
  }
);

ResultSchema.index({
  school: 1,
  classId: 1,
  sectionId: 1,
  year: -1
});

ResultSchema.index({
  school: 1,
  classId: 1,
  sectionId: 1,
  examType: 1
});

ResultSchema.index({
  school: 1,
  year: -1
});

ResultSchema.index({
  school: 1,
  createdAt: -1
});

module.exports = mongoose.model("Result", ResultSchema);