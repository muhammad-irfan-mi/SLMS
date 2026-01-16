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
        examDate: {  
            type: Date,
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
        status: {  
            type: String,
            enum: ["scheduled", "ongoing", "completed", "cancelled"],
            default: "scheduled"
        }
    },
    { timestamps: true }
);

examScheduleSchema.index({ school: 1, classId: 1, sectionId: 1, examDate: 1, startTime: 1 });
examScheduleSchema.index({ teacherId: 1, examDate: 1 });
examScheduleSchema.index({ school: 1, classId: 1, sectionId: 1, subjectId: 1, type: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("ExamSchedule", examScheduleSchema);