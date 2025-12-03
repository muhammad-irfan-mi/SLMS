const DailyIslamicAttendance = require("../models/DailyIslamicAttendance");
const User = require("../models/User");

// Helpers
function formatDateToYMD(d) {
    const D = d ? new Date(d) : new Date();
    const y = D.getFullYear();
    const m = String(D.getMonth() + 1).padStart(2, "0");
    const day = String(D.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

async function verifyStudentClassSection(studentId, classId, sectionId, schoolId) {
    const student = await User.findById(studentId).lean();
    if (!student) throw { status: 404, message: "Student not found" };
    if (student.role !== "student") throw { status: 400, message: "User is not a student" };

    if (student.school && String(student.school) !== String(schoolId)) {
        throw { status: 400, message: "Student does not belong to this school" };
    }

    if (!student.classInfo?.id || !student.sectionInfo?.id) {
        throw { status: 400, message: "Student missing class or section assignment" };
    }

    if (String(student.classInfo.id) !== String(classId))
        throw { status: 400, message: "Student not in this class" };

    if (String(student.sectionInfo.id) !== String(sectionId))
        throw { status: 400, message: "Student not in this section" };

    return student;
}

// Create or update daily record
const createDialyRecord = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const actorId = req.user._id;

        const {
            studentId,
            classId,
            sectionId,
            date,
            fajr, zuhr, asr, maghrib, isha, jumah,
            quranRead,
            note
        } = req.body;

        if (!studentId || !classId || !sectionId) {
            return res.status(400).json({ message: "studentId, classId and sectionId are required" });
        }

        const ymd = date ? formatDateToYMD(date) : formatDateToYMD();
        await verifyStudentClassSection(studentId, classId, sectionId, schoolId);

        let record = await DailyIslamicAttendance.findOne({ school: schoolId, studentId, date: ymd });

        if (!record) {
            record = new DailyIslamicAttendance({
                school: schoolId,
                studentId,
                classId,
                sectionId,
                date: ymd,
                fajr: !!fajr,
                zuhr: !!zuhr,
                asr: !!asr,
                maghrib: !!maghrib,
                isha: !!isha,
                jumah: !!jumah,
                quranRead: !!quranRead,
                note: note || undefined,
                createdBy: actorId
            });

            await record.save();
            return res.status(201).json({ message: "Daily record created", record });
        } else {
            const updates = {};
            if (typeof fajr !== "undefined") updates.fajr = !!fajr;
            if (typeof zuhr !== "undefined") updates.zuhr = !!zuhr;
            if (typeof asr !== "undefined") updates.asr = !!asr;
            if (typeof maghrib !== "undefined") updates.maghrib = !!maghrib;
            if (typeof isha !== "undefined") updates.isha = !!isha;
            if (typeof jumah !== "undefined") updates.jumah = !!jumah;
            if (typeof quranRead !== "undefined") updates.quranRead = !!quranRead;
            if (typeof note !== "undefined") updates.note = note;
            updates.createdBy = actorId;

            const updated = await DailyIslamicAttendance.findByIdAndUpdate(record._id, { $set: updates }, { new: true });
            return res.status(200).json({ message: "Daily record updated", record: updated });
        }

    } catch (err) {
        console.error("upsertDailyRecord error:", err);
        if (err && err.status) return res.status(err.status).json({ message: err.message });
        return res.status(500).json({ message: "Server error", error: err.message || err });
    }
};

// Get records (Admin/Teacher)
const getRecords = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const {
            classId,
            sectionId,
            studentId,
            date, dateFrom, dateTo,
            page = 1, limit = 10,
            sortBy = "date", sortOrder = "desc"
        } = req.query;

        const filter = { school: schoolId };

        if (studentId) filter.studentId = studentId;
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;

        if (date) {
            filter.date = date;
        } else if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) filter.date.$gte = dateFrom;
            if (dateTo) filter.date.$lte = dateTo;
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [total, records] = await Promise.all([
            DailyIslamicAttendance.countDocuments(filter),
            DailyIslamicAttendance.find(filter)
                .populate("studentId", "name rollNo email")
                .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean()
        ]);

        return res.status(200).json({
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
            records
        });

    } catch (err) {
        console.error("getRecords error:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get records for student
const getStudentRecords = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const studentId = req.user._id;

        const { date, dateFrom, dateTo, page = 1, limit = 10 } = req.query;

        const filter = { school: schoolId, studentId };

        if (date) filter.date = date;
        else if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) filter.date.$gte = dateFrom;
            if (dateTo) filter.date.$lte = dateTo;
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [total, records] = await Promise.all([
            DailyIslamicAttendance.countDocuments(filter),
            DailyIslamicAttendance.find(filter)
                .sort({ date: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean()
        ]);

        return res.status(200).json({
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
            records
        });
    } catch (err) {
        console.error("getStudentRecords error:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Delete record
const deleteRecord = async (req, res) => {
    try {
        if (req.user.role !== "admin_office" && req.user.role !== "superadmin") {
            return res.status(403).json({ message: "Access denied: Admin only" });
        }

        const { id } = req.params;
        const record = await DailyIslamicAttendance.findById(id);
        if (!record) return res.status(404).json({ message: "Record not found" });

        await record.deleteOne();
        return res.status(200).json({ message: "Record deleted" });
    } catch (err) {
        console.error("deleteRecord error:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};

module.exports = {
    createDialyRecord,
    getRecords,
    getStudentRecords,
    deleteRecord
};
