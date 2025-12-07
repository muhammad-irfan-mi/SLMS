const mongoose = require("mongoose");
const AttendanceImported = require("../models/Attendance");
const UserImported = require("../models/User");
const ClassSectionImported = require("../models/ClassSection");

const Attendance = AttendanceImported.default || AttendanceImported;
const User = UserImported.default || UserImported;
const ClassSection = ClassSectionImported.default || ClassSectionImported;

const formatDate = (date) => {
    const d = date ? new Date(date) : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const markAttendance = async (req, res) => {
    try {
        const { classId, sectionId, students, date } = req.body;
        const teacherId = req.user._id;
        const school = req.user.school;

        if (!classId || !sectionId || !Array.isArray(students) || students.length === 0)
            return res.status(400).json({ message: "classId, sectionId and students[] are required" });

        const classDoc = await ClassSection.findById(classId);
        if (!classDoc) return res.status(404).json({ message: "Class not found" });

        const teacher = await User.findById(teacherId);
        if (!teacher || !teacher.isIncharge)
            return res.status(403).json({ message: "Only incharge teacher can mark attendance" });

        if (String(teacher.classInfo?.id) !== String(classId) || String(teacher.sectionInfo?.id) !== String(sectionId))
            return res.status(403).json({ message: "Teacher not assigned to this section" });

        const attendanceDate = formatDate(date);
        const exists = await Attendance.findOne({ school, classId, sectionId, date: attendanceDate });
        if (exists)
            return res.status(400).json({ message: "Attendance already marked for today" });

        const studentIds = students.map((s) => s.studentId);
        const userDocs = await User.find({ _id: { $in: studentIds } }).select("name email").lean();
        const finalStudents = students.map((s) => {
            const u = userDocs.find((x) => String(x._id) === String(s.studentId));
            return { studentId: s.studentId, name: u?.name || "Unknown", email: u?.email || "N/A", status: s.status || "present" };
        });

        const attendance = await Attendance.create({
            school,
            classId,
            sectionId,
            teacherId,
            teacherName: teacher.name,
            date: attendanceDate,
            students: finalStudents,
        });

        return res.status(201).json({ message: "Attendance marked successfully", attendance });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Server error" });
    }
};

const updateAttendance = async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const { students } = req.body;
        const teacherId = req.user._id;
        const school = req.user.school;

        if (!Array.isArray(students)) {
            return res.status(400).json({ message: "students must be an array" });
        }

        const attendance = await Attendance.findById(attendanceId);
        if (!attendance) return res.status(404).json({ message: "Attendance not found" });
        if (String(attendance.school) !== String(school)) return res.status(403).json({ message: "Access denied" });
        if (String(attendance.teacherId) !== String(teacherId)) return res.status(403).json({ message: "Only incharge can update" });

        const existingMap = new Map(attendance.students.map((s) => [String(s.studentId), s]));
        for (const s of students) {
            if (!s.studentId || !s.status) continue;
            const sid = String(s.studentId);
            const base = existingMap.get(sid);
            if (base) base.status = s.status;
        }

        attendance.students = Array.from(existingMap.values());
        await attendance.save();

        return res.status(200).json({ message: "Attendance updated successfully", attendance });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Server error" });
    }
};

const getAttendanceBySection = async (req, res) => {
    try {
        const { sectionId } = req.params;
        const school = req.user.school;

        let { page = 1, limit = 20 } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;

        const total = await Attendance.countDocuments({ school, sectionId });

        const records = await Attendance.find({ school, sectionId })
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        return res.status(200).json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            attendance: records
        });

    } catch (err) {
        return res.status(500).json({ message: err.message || "Server error" });
    }
};

const getAttendanceByStudent = async (req, res) => {
    try {
        const { studentId } = req.params;
        const school = req.user.school;

        let { page = 1, limit = 20 } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;

        const filter = {
            school,
            "students.studentId": new mongoose.Types.ObjectId(studentId),
        };

        const total = await Attendance.countDocuments(filter);

        const records = await Attendance.find(filter)
            .select("date classId sectionId students")
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const result = records.map((r) => {
            const st = r.students.find(
                (s) => String(s.studentId) === String(studentId)
            );
            return {
                date: r.date,
                classId: r.classId,
                sectionId: r.sectionId,
                status: st?.status || "N/A",
            };
        });

        return res.status(200).json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            attendance: result
        });

    } catch (err) {
        return res.status(500).json({ message: err.message || "Server error" });
    }
};

const getAttendanceByDateOrRange = async (req, res) => {
    try {
        const { sectionId } = req.params;
        const { date, startDate, endDate } = req.query;
        const school = req.user.school;

        let { page = 1, limit = 20 } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;

        if (!sectionId)
            return res.status(400).json({ message: "sectionId is required" });

        if (!date && (!startDate || !endDate))
            return res.status(400).json({
                message: "Provide either a date or startDate & endDate",
            });

        let filter = { school, sectionId };

        if (date) {
            filter.date = date;
        } else {
            filter.date = { $gte: startDate, $lte: endDate };
        }

        const total = await Attendance.countDocuments(filter);

        const attendance = await Attendance.find(filter)
            .sort({ date: 1 })
            .skip(skip)
            .limit(limit)
            .lean();

        return res.status(200).json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            from: startDate || date,
            to: endDate || date,
            records: attendance
        });

    } catch (err) {
        return res.status(500).json({ message: err.message || "Server error" });
    }
};

const getStudentAttendanceByDateOrRange = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { date, startDate, endDate } = req.query;
        const school = req.user.school;

        let { page = 1, limit = 20 } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;

        if (!studentId)
            return res.status(400).json({ message: "studentId is required" });

        if (!date && (!startDate || !endDate))
            return res.status(400).json({
                message: "Provide either a date or startDate & endDate",
            });

        let filter = {
            school,
            "students.studentId": new mongoose.Types.ObjectId(studentId),
        };

        if (date) {
            filter.date = date;
        } else {
            filter.date = { $gte: startDate, $lte: endDate };
        }

        const total = await Attendance.countDocuments(filter);

        const records = await Attendance.find(filter)
            .select("date classId sectionId students")
            .sort({ date: 1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const result = records.map((r) => {
            const st = r.students.find(
                (s) => String(s.studentId) === String(studentId)
            );
            return {
                date: r.date,
                classId: r.classId,
                sectionId: r.sectionId,
                status: st?.status || "N/A",
            };
        });

        return res.status(200).json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            from: startDate || date,
            to: endDate || date,
            records: result,
        });

    } catch (err) {
        console.error("Error fetching student attendance by range:", err);
        return res.status(500).json({ message: err.message || "Server error" });
    }
};


module.exports = {
    markAttendance,
    updateAttendance,
    getAttendanceBySection,
    getAttendanceByStudent,
    getAttendanceByDateOrRange,
    getStudentAttendanceByDateOrRange
};
