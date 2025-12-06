const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Question (embedded in QuizGroup)
 */
const QuestionSchema = new Schema({
  type: { type: String, enum: ["mcq", "fill"], required: true },
  title: { type: String, required: true },
  options: [{ type: String }], // MCQ only
  correctOptionIndex: { type: Number }, // MCQ only
  correctAnswer: { type: String }, // Fill only
  marks: { type: Number, default: 1 },
  order: { type: Number, default: 0 }
});

/**
 * Quiz Group
 */
const QuizGroupSchema = new Schema(
  {
    school: { type: Schema.Types.ObjectId, ref: "School", required: true },
    title: { type: String, required: true },
    description: { type: String },
    classIds: [{ type: Schema.Types.ObjectId, ref: "ClassSection" }],
    sectionIds: [{ type: Schema.Types.ObjectId }],
    status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
    questions: [QuestionSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startTime: { type: Date },
    endTime: { type: Date }
  },
  { timestamps: true }
);

/**
 * Submission
 */
const QuizSubmissionSchema = new Schema(
  {
    school: { type: Schema.Types.ObjectId, ref: "School", required: true },
    groupId: { type: Schema.Types.ObjectId, ref: "QuizGroup", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    answers: [
      {
        questionId: { type: Schema.Types.ObjectId },
        type: { type: String, enum: ["mcq", "fill"] },
        chosenIndex: { type: Number },
        answerText: { type: String },
        obtainedMarks: { type: Number, default: 0 }
      }
    ],
    totalMarksObtained: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    submittedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Prevent duplicate submission
QuizSubmissionSchema.index({ groupId: 1, studentId: 1 }, { unique: true });

const QuizGroup = mongoose.model("QuizGroup", QuizGroupSchema);
const QuizSubmission = mongoose.model("QuizSubmission", QuizSubmissionSchema);

module.exports = { QuizGroup, QuizSubmission };
