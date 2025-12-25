const mongoose = require("mongoose");
const AttendanceImported = require("../models/Attendance");
const UserImported = require("../models/User");
const ClassSectionImported = require("../models/ClassSection");
const Leave = require("../models/Leave");

const Attendance = AttendanceImported.default || AttendanceImported;
const User = UserImported.default || UserImported;
const ClassSection = ClassSectionImported.default || ClassSectionImported;

const formatDate = (date) => {
    const d = date ? new Date(date) : new Date();
    return d.toISOString().split("T")[0];
};

const normalizePagination = ({ page = 1, limit = 20 }) => {
    page = Number(page);
    limit = Number(limit);
    return {
        page,
        limit,
        skip: (page - 1) * limit
    };
};


const markAttendance = async (req, res) => {
    try {
        const { classId, sectionId, students, date } = req.body;
        const teacherId = req.user._id;
        const school = req.user.school;

        const classDoc = await ClassSection.findById(classId);
        if (!classDoc) return res.status(404).json({ message: "Class not found" });

        const teacher = await User.findById(teacherId);
        if (!teacher?.isIncharge)
            return res.status(403).json({ message: "Only incharge teacher can mark attendance" });

        if (
            String(teacher.classInfo?.id) !== String(classId) ||
            String(teacher.sectionInfo?.id) !== String(sectionId)
        )
            return res.status(403).json({ message: "Teacher not assigned to this section" });

        const attendanceDate = formatDate(date);

        const exists = await Attendance.findOne({
            school,
            classId,
            sectionId,
            date: attendanceDate
        });

        if (exists)
            return res.status(409).json({ message: "Attendance already marked for this date" });

        const studentIds = students.map(s => s.studentId);

        const [users, leaves] = await Promise.all([
            User.find({ _id: { $in: studentIds } })
                .select("name email")
                .lean(),

            Leave.find({
                school,
                studentId: { $in: studentIds },
                date: attendanceDate,
                status: "approved"
            }).lean()
        ]);

        const leaveSet = new Set(leaves.map(l => String(l.studentId)));

        const finalStudents = students.map(s => {
            const u = users.find(x => String(x._id) === String(s.studentId));

            return {
                studentId: s.studentId,
                name: u?.name || "Unknown",
                email: u?.email || "N/A",

                // AUTO leave if approved leave exists
                status: leaveSet.has(String(s.studentId))
                    ? "leave"
                    : (s.status || "present")
            };
        });

        const attendance = await Attendance.create({
            school,
            classId,
            sectionId,
            teacherId,
            date: attendanceDate,
            students: finalStudents
        });

        return res.status(201).json({
            message: "Attendance marked successfully",
            attendance
        });

    } catch (err) {
        console.error("markAttendance error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

const updateAttendance = async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const { students } = req.body;
        const school = req.user.school;

        const attendance = await Attendance.findById(attendanceId);
        if (!attendance)
            return res.status(404).json({ message: "Attendance not found" });

        if (String(attendance.school) !== String(school))
            return res.status(403).json({ message: "Access denied" });

        const studentMap = new Map(
            attendance.students.map(s => [String(s.studentId), s])
        );

        const updatedStudents = [];

        const incomingIds = students.map(s => s.studentId);

        const missingIds = incomingIds.filter(
            id => !studentMap.has(String(id))
        );

        let missingUsers = [];
        if (missingIds.length) {
            missingUsers = await User.find({
                _id: { $in: missingIds },
                school
            }).select("name email").lean();
        }

        const missingUserMap = new Map(
            missingUsers.map(u => [String(u._id), u])
        );

        for (const s of students) {
            const key = String(s.studentId);

            if (studentMap.has(key)) {
                const student = studentMap.get(key);
                student.status = s.status;

                updatedStudents.push({
                    studentId: student.studentId,
                    name: student.name,
                    email: student.email,
                    status: student.status
                });

            } else {
                const u = missingUserMap.get(key);

                const newStudent = {
                    studentId: s.studentId,
                    name: u?.name || "Unknown",
                    email: u?.email || "N/A",
                    status: s.status
                };

                studentMap.set(key, newStudent);
                updatedStudents.push(newStudent);
            }
        }

        attendance.students = [...studentMap.values()];
        await attendance.save();

        return res.status(200).json({
            message: "Attendance updated successfully",
            updatedStudents
        });

    } catch (err) {
        console.error("updateAttendance error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

const getAttendanceBySection = async (req, res) => {
    try {
        const { sectionId } = req.params;
        const { date, startDate, endDate, status } = req.query;
        const school = req.user.school;

        const { page, limit, skip } = normalizePagination(req.query);

        const filter = {
            school,
            sectionId
        };

        if (date) {
            filter.date = date;
        } else if (startDate && endDate) {
            filter.date = { $gte: startDate, $lte: endDate };
        }

        const [total, records] = await Promise.all([
            Attendance.countDocuments(filter),

            Attendance.find(filter)
                .populate("classId", "class sections")
                .populate("teacherId", "name email")
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const attendance = records.map(att => {
            const section =
                att.classId?.sections?.find(
                    s => String(s._id) === String(sectionId)
                ) || null;

            let students = att.students;
            if (status) {
                students = students.filter(s => s.status === status);
            }

            return {
                _id: att._id,
                date: att.date,

                class: att.classId
                    ? { _id: att.classId._id, name: att.classId.class }
                    : null,

                section: section
                    ? { _id: section._id, name: section.name }
                    : null,

                teacher: att.teacherId
                    ? { _id: att.teacherId._id, name: att.teacherId.name }
                    : null,

                students: students.map(s => ({
                    studentId: s.studentId,
                    name: s.name,
                    email: s.email,
                    status: s.status
                })),

                totalStudents: students.length,
                present: students.filter(s => s.status === "present").length,
                absent: students.filter(s => s.status === "absent").length,
                leave: students.filter(s => s.status === "leave").length,

                createdAt: att.createdAt
            };
        });

        return res.status(200).json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            attendance
        });

    } catch (err) {
        console.error("getAttendanceBySection error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

const getAttendanceByStudent = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { date, startDate, endDate, status } = req.query;
        const school = req.user.school;
        const { page, limit, skip } = normalizePagination(req.query);

        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({ message: "Invalid studentId" });
        }

        const filter = {
            school,
            "students.studentId": new mongoose.Types.ObjectId(studentId)
        };

        if (date) {
            filter.date = date;
        } else if (startDate && endDate) {
            filter.date = { $gte: startDate, $lte: endDate };
        }

        const total = await Attendance.countDocuments(filter);

        const records = await Attendance.find(filter)
            .populate("classId", "class sections")
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const attendance = records
            .map(r => {
                const st = r.students.find(
                    s => String(s.studentId) === String(studentId)
                );

                if (!st) return null;

                if (status && st.status !== status) return null;

                const section =
                    r.classId?.sections?.find(
                        sec => String(sec._id) === String(r.sectionId)
                    ) || null;

                return {
                    date: r.date,
                    class: r.classId
                        ? { _id: r.classId._id, name: r.classId.class }
                        : null,
                    section: section
                        ? { _id: section._id, name: section.name }
                        : null,
                    status: st.status
                };
            })
            .filter(Boolean);

        return res.status(200).json({
            page,
            limit,
            total,
            attendance
        });

    } catch (err) {
        console.error("getAttendanceByStudent error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

// const getAttendanceByDateOrRange = async (req, res) => {
//     try {
//         const { sectionId } = req.params;
//         const { date, startDate, endDate } = req.query;
//         const school = req.user.school;

//         const { page, limit, skip } = normalizePagination(req.query);

//         const filter = { school, sectionId };

//         if (date) {
//             filter.date = date;
//         } else {
//             filter.date = { $gte: startDate, $lte: endDate };
//         }

//         const [total, records] = await Promise.all([
//             Attendance.countDocuments(filter),
//             Attendance.find(filter)
//                 .sort({ date: 1 })
//                 .skip(skip)
//                 .limit(limit)
//                 .lean()
//         ]);

//         return res.status(200).json({
//             total,
//             page,
//             limit,
//             totalPages: Math.ceil(total / limit),
//             from: date || startDate,
//             to: date || endDate,
//             records
//         });

//     } catch (err) {
//         console.error("getAttendanceByDateOrRange:", err);
//         return res.status(500).json({ message: "Server error" });
//     }
// };

// const getStudentAttendanceByDateOrRange = async (req, res) => {
//     try {
//         const { studentId } = req.params;
//         const { date, startDate, endDate } = req.query;
//         const school = req.user.school;

//         const { page, limit, skip } = normalizePagination(req.query);

//         const filter = {
//             school,
//             "students.studentId": studentId
//         };

//         if (date) {
//             filter.date = date;
//         } else {
//             filter.date = { $gte: startDate, $lte: endDate };
//         }

//         const [total, records] = await Promise.all([
//             Attendance.countDocuments(filter),
//             Attendance.find(filter)
//                 .select("date classId sectionId students")
//                 .sort({ date: 1 })
//                 .skip(skip)
//                 .limit(limit)
//                 .lean()
//         ]);

//         const result = records.map(r => {
//             const st = r.students.find(s => String(s.studentId) === String(studentId));
//             return {
//                 date: r.date,
//                 classId: r.classId,
//                 sectionId: r.sectionId,
//                 status: st?.status || "N/A"
//             };
//         });

//         return res.status(200).json({
//             total,
//             page,
//             limit,
//             totalPages: Math.ceil(total / limit),
//             from: date || startDate,
//             to: date || endDate,
//             records: result
//         });

//     } catch (err) {
//         console.error("getStudentAttendanceByDateOrRange:", err);
//         return res.status(500).json({ message: "Server error" });
//     }
// };


module.exports = {
    markAttendance,
    updateAttendance,
    getAttendanceBySection,
    getAttendanceByStudent,
    // getAttendanceByDateOrRange,
    // getStudentAttendanceByDateOrRange
};