const mongoose = require("mongoose");

const DailyAttendanceSchema = new mongoose.Schema(
    {
        school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },

        studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        classId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection", required: true },
        sectionId: { type: mongoose.Schema.Types.ObjectId, required: true },

        fajr: { type: Boolean, default: false },
        zuhr: { type: Boolean, default: false },
        asr: { type: Boolean, default: false },
        maghrib: { type: Boolean, default: false },
        isha: { type: Boolean, default: false },
        jumah: { type: Boolean, default: false },

        quranRead: { type: Boolean, default: false },

        note: { type: String },
        date: { type: String, required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

DailyAttendanceSchema.index({ school: 1, studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DailyIslamicAttendance", DailyAttendanceSchema);
