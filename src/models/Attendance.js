import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "School", required: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ClassSection", required: true
    },
    sectionId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", required: true
    },
    teacherName: String,
    date: {
        type: String,
        required: true
    },
    students: [
        {
            studentId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User", required: true
            },
            name: String,
            email: String,
            status: {
                type: String,
                enum: ["present", "absent"],
                default: "present"
            },
        },
    ],
}, { timestamps: true });

attendanceSchema.index({ school: 1, classId: 1, sectionId: 1, date: 1 }, { unique: true });
export default mongoose.model("Attendance", attendanceSchema);
