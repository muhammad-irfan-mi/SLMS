// models/ExamSchedule.js
const mongoose = require("mongoose");

const examScheduleSchema = new mongoose.Schema(
    {
        school: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "School",
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
        subjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Subject",
            required: true,
        },
        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        day: {
            type: String,
            enum: [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
            ],
            required: true,
        },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },

        type: {
            type: String,
            enum: ["midterm", "midterm2", "final"],
            required: true,
        },

        year: {
            type: Number,
            required: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("ExamSchedule", examScheduleSchema);
