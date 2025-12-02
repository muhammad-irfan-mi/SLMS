const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema({
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    comment: { type: String },
    action: { type: String }, 
    reviewedAt: { type: Date },
});

const ComplaintFeedbackSchema = new mongoose.Schema(
    {
        school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },

        studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        classId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection", required: true },
        sectionId: { type: mongoose.Schema.Types.ObjectId, required: true },

        type: { type: String, enum: ["complaint", "feedback"], required: true },

        title: { type: String, required: true },
        detail: { type: String, required: true },

        status: {
            type: String,
            enum: ["pending", "reviewed", "resolved", "submitted", "addressed"],
            required: true,
        },
        review: ReviewSchema,
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    },
    { timestamps: true }
);

module.exports = mongoose.model("ComplaintFeedback", ComplaintFeedbackSchema);
