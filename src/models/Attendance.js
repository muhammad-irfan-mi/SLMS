import mongoose from "mongoose";

// const studentStatusSchema = new mongoose.Schema({
//     studentId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "Student",
//         required: true,
//     },
//     status: {
//         type: String,
//         enum: ["present", "absent", "leave"],
//         default: "absent",
//     },
// });

const attendanceSchema = new mongoose.Schema({
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "School",
        required: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ClassSection",
        required: true
    },
    sectionId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject",
        required: true
    },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    teacherName: String,
    teacherEmail: String,
    date: { type: String, required: true },
    students: [
        {
            studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            name: String,
            email: String,
            role: String,
            status: { type: String, enum: ['present', 'absent', 'leave'], default: 'present' },
        },
    ],
});

attendanceSchema.index({ subjectId: 1, date: 1, teacherId: 1 });
attendanceSchema.index({ school: 1, classId: 1, sectionId: 1, date: 1 });
attendanceSchema.index({ 'students.studentId': 1 });

export default mongoose.model("Attendance", attendanceSchema);
