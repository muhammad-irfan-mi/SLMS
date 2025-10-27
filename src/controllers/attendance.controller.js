const SubjectImported = require('../models/Subject');
const AttendanceImported = require('../models/Attendance');
const ScheduleImported = require('../models/Schedule');
const UserImported = require('../models/User');
const mongoose = require('mongoose');


const isValidId = (id) => mongoose.Types.ObjectId.isValid(String(id));
const getModel = (m) => (m && m.default) ? m.default : m;

const Subject = getModel(SubjectImported);
const Attendance = getModel(AttendanceImported);
const Schedule = getModel(ScheduleImported);
const User = getModel(UserImported);

const formatDate = (d) => {
    const date = d ? new Date(d) : new Date();
    if (Number.isNaN(date.getTime())) return null;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    return { iso, weekday };
};

const markAttendance = async (req, res) => {
    try {
        const { subjectId, teacherId, students, date } = req.body;

        if (!subjectId || !teacherId || !Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ message: "subjectId, teacherId and students[] are required" });
        }

        const fd = formatDate(date);
        if (!fd) {
            return res.status(400).json({ message: "Invalid date format" });
        }

        const attendanceDate = fd.iso;
        const attendanceWeekday = fd.weekday;

        // === Step 1: Find subject ===
        const subject = await Subject.findById(subjectId).lean();
        if (!subject) return res.status(404).json({ message: "Subject not found" });

        const { school, class: classId, sectionId } = subject;
        if (!school || !classId || !sectionId) {
            return res.status(400).json({ message: "Subject missing school/class/section linkage" });
        }

        if (subject.teacherId && String(subject.teacherId) !== String(teacherId)) {
            return res.status(403).json({ message: "This teacher is not assigned to this subject" });
        }

        // === Step 2: Fetch teacher ===
        const teacher = await User.findById(teacherId).select('name email role').lean();
        if (!teacher) return res.status(404).json({ message: "Teacher not found" });

        // === Step 3: Enrich student data ===
        const studentIds = students.map(s => s.studentId);
        const studentDocs = await User.find({ _id: { $in: studentIds } })
            .select('name email role')
            .lean();

        const enrichedStudents = students.map(s => {
            const info = studentDocs.find(u => String(u._id) === String(s.studentId));
            return {
                ...s,
                name: info?.name || 'Unknown',
                email: info?.email || 'N/A',
                role: info?.role || 'student',
            };
        });

        // === Step 4: Mark attendance for current subject ===
        let primaryAttendance;
        try {
            primaryAttendance = await Attendance.findOneAndUpdate(
                { school, classId, sectionId, subjectId, date: attendanceDate },
                {
                    $set: {
                        teacherId,
                        teacherName: teacher.name,
                        teacherEmail: teacher.email,
                        students: enrichedStudents,
                    },
                },
                { upsert: true, new: true }
            );
        } catch (err) {
            console.error('Error saving main attendance:', err);
            return res.status(500).json({ message: 'Error saving primary attendance', error: err.message });
        }

        // === Step 5: Find other same-teacher subjects for same class/day ===
        let otherSubjects = [];
        try {
            otherSubjects = await Subject.find({
                school,
                class: classId,
                sectionId,
                teacherId,
                _id: { $ne: subjectId },
            }).lean();
        } catch (err) {
            console.error('Error fetching other subjects:', err);
        }

        const subjectsToSync = [];
        if (otherSubjects.length > 0) {
            const schedules = await Schedule.find({
                subjectId: { $in: otherSubjects.map(s => s._id) },
                classId,
                sectionId,
                day: attendanceWeekday,
                school,
            }).lean();

            const scheduledIds = new Set(schedules.map(s => String(s.subjectId)));
            for (const subj of otherSubjects) {
                if (scheduledIds.has(String(subj._id))) subjectsToSync.push(subj);
            }
        }

        const syncResults = await Promise.all(subjectsToSync.map(async (subj) => {
            try {
                const doc = await Attendance.findOneAndUpdate(
                    { school, classId, sectionId, subjectId: subj._id, date: attendanceDate },
                    {
                        $set: {
                            teacherId,
                            teacherName: teacher.name,
                            teacherEmail: teacher.email,
                            students: enrichedStudents,
                        },
                    },
                    { upsert: true, new: true }
                );
                return { subjectId: subj._id, name: subj.name, status: 'synced', id: doc?._id };
            } catch (err) {
                console.error(`Error syncing subject ${subj._id}:`, err);
                return { subjectId: subj._id, name: subj.name, status: 'error', error: err.message };
            }
        }));

        return res.status(201).json({
            message: 'Attendance marked successfully and synced for other same-day subjects',
            date: attendanceDate,
            weekday: attendanceWeekday,
            teacher: {
                id: teacherId,
                name: teacher.name,
                email: teacher.email,
            },
            subject: {
                id: subjectId,
                name: subject.name,
            },
            summary: {
                primary: { id: primaryAttendance?._id },
                synced: syncResults,
            },
        });

    } catch (err) {
        console.error('Unhandled markAttendance error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};


const toISODate = (d) => {
    if (!d) return null;
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10); // YYYY-MM-DD
};

const buildDateFilter = (from, to) => {
    const filter = {};
    const f = toISODate(from);
    const t = toISODate(to);
    if (f && t) {
        filter.$gte = f;
        filter.$lte = t;
    } else if (f) filter.$gte = f;
    else if (t) filter.$lte = t;
    return Object.keys(filter).length ? filter : null;
};

const getAttendanceBySection = async (req, res) => {
    try {
        const { sectionId } = req.params;
        const { from, to } = req.query;
        const schoolId = req.user.school;

        if (!isValidId(sectionId)) return res.status(400).json({ message: 'Invalid sectionId' });

        const dateFilter = buildDateFilter(from, to);

        const match = { sectionId: new mongoose.Types.ObjectId(sectionId), school: new mongoose.Types.ObjectId(schoolId) };
        if (dateFilter) match.date = dateFilter;

        // fetch minimal fields and use lean for performance
        const docs = await Attendance.find(match)
            .select('date subjectId teacherId students')
            .lean();

        // Group by date
        const grouped = docs.reduce((acc, doc) => {
            const d = doc.date;
            if (!acc[d]) acc[d] = [];
            acc[d].push(doc);
            return acc;
        }, {});

        // Sort dates descending
        const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
        const result = {};
        for (const d of sortedDates) result[d] = grouped[d];

        return res.status(200).json({ totalDates: sortedDates.length, attendanceByDate: result });
    } catch (err) {
        console.error('getAttendanceBySection error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// GET Attendance by Subject
const getAttendanceBySubject = async (req, res) => {
    try {
        const { subjectId } = req.params;
        const { from, to } = req.query;
        const schoolId = req.user.school;

        if (!isValidId(subjectId)) return res.status(400).json({ message: 'Invalid subjectId' });

        const dateFilter = buildDateFilter(from, to);
        const match = { subjectId: new mongoose.Types.ObjectId(subjectId), school: new mongoose.Types.ObjectId(schoolId) };
        if (dateFilter) match.date = dateFilter;

        const docs = await Attendance.find(match)
            .select('date classId sectionId teacherId students')
            .lean();

        // Map date -> doc (if duplicates for same date there shouldn't be, but handle multiple)
        const grouped = docs.reduce((acc, doc) => {
            const d = doc.date;
            if (!acc[d]) acc[d] = [];
            acc[d].push(doc);
            return acc;
        }, {});

        // Provide sorted dates
        const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
        return res.status(200).json({ totalDates: sortedDates.length, attendanceByDate: grouped });
    } catch (err) {
        console.error('getAttendanceBySubject error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// GET Student Attendance
const getStudentAttendance = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { subjectId, from, to } = req.query;
        const schoolId = req.user.school;

        if (!isValidId(studentId)) return res.status(400).json({ message: 'Invalid studentId' });
        const student = await User.findById(studentId)
        if (!student) {
            return res.status(404).json({ message: "Student Not Found" })
        }

        const match = { school: new mongoose.Types.ObjectId(schoolId) };
        if (subjectId) {
            if (!isValidId(subjectId)) return res.status(400).json({ message: 'Invalid subjectId' });
            match.subjectId = mongoose.Types.ObjectId(subjectId);
        }

        const dateFilter = buildDateFilter(from, to);
        if (dateFilter) match.date = dateFilter;

        // Find all attendances matching filter, but only where student exists in students array
        const docs = await Attendance.find({
            ...match,
            'students.studentId': new mongoose.Types.ObjectId(studentId)
        })
            .select('date subjectId teacherId students')
            .lean();

        // For each doc, pick the student entry
        const result = docs.map(doc => {
            const studentEntry = (doc.students || []).find(s => String(s.studentId) === String(studentId));
            return {
                attendanceId: doc._id,
                date: doc.date,
                subjectId: doc.subjectId,
                teacherId: doc.teacherId,
                status: studentEntry ? studentEntry.status : null,
                studentEntry,
            };
        }).sort((a, b) => b.date.localeCompare(a.date));

        return res.status(200).json({ total: result.length, attendance: result });
    } catch (err) {
        console.error('getStudentAttendance error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Edit single student's attendance inside a specific attendance document
const editSingleStudentAttendance = async (req, res) => {
    try {
        const { attendanceId, studentId } = req.params;
        const { status, name, email } = req.body;
        const schoolId = req.user.school;

        if (!isValidId(attendanceId) || !isValidId(studentId)) return res.status(400).json({ message: 'Invalid id(s)' });
        if (!status) return res.status(400).json({ message: 'status is required' });

        // Ensure attendance exists and belongs to same school
        const attendance = await Attendance.findById(attendanceId);
        if (!attendance) return res.status(404).json({ message: 'Attendance record not found' });
        if (String(attendance.school) !== String(schoolId)) return res.status(403).json({ message: 'Not allowed' });

        // Try to update existing student entry using arrayFilters for atomic update
        const filter = { _id: attendanceId, 'students.studentId': mongoose.Types.ObjectId(studentId) };
        const update = {
            $set: { 'students.$.status': status }
        };
        if (name) update.$set['students.$.name'] = name;
        if (email) update.$set['students.$.email'] = email;

        const updated = await Attendance.findOneAndUpdate(filter, update, { new: true });
        if (updated) {
            return res.status(200).json({ message: 'Student attendance updated', attendance: updated });
        }

        // If not found inside array, push new student object
        const pushObj = { studentId: mongoose.Types.ObjectId(studentId), status };
        if (name) pushObj.name = name;
        if (email) pushObj.email = email;

        const pushed = await Attendance.findByIdAndUpdate(attendanceId, { $push: { students: pushObj } }, { new: true });
        return res.status(200).json({ message: 'Student attendance added', attendance: pushed });
    } catch (err) {
        console.error('editSingleStudentAttendance error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

//  Edit multiple students inside a single attendance doc
const editMultipleStudentsAttendance = async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const { students } = req.body;
        const schoolId = req.user.school;

        if (!isValidId(attendanceId)) return res.status(400).json({ message: 'Invalid attendanceId' });
        if (!Array.isArray(students) || students.length === 0) return res.status(400).json({ message: 'students[] required' });

        const attendance = await Attendance.findById(attendanceId).lean();
        if (!attendance) return res.status(404).json({ message: 'Attendance record not found' });
        if (String(attendance.school) !== String(schoolId)) return res.status(403).json({ message: 'Not allowed' });

        // Build map of existing students
        const existing = attendance.students || [];
        const existingMap = new Map(existing.map(s => [String(s.studentId), s]));

        // Merge: for each incoming student, update or add
        for (const s of students) {
            if (!s.studentId || !s.status) continue;
            const sid = String(s.studentId);
            const base = existingMap.get(sid) || { studentId: mongoose.Types.ObjectId(s.studentId) };
            base.status = s.status;
            if (s.name) base.name = s.name;
            if (s.email) base.email = s.email;
            existingMap.set(sid, base);
        }

        // Convert back to array
        const mergedArray = Array.from(existingMap.values());

        // Atomic replacement of students array
        const updated = await Attendance.findByIdAndUpdate(attendanceId, { $set: { students: mergedArray } }, { new: true });
        return res.status(200).json({ message: 'Students updated', attendance: updated });
    } catch (err) {
        console.error('editMultipleStudentsAttendance error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

//  Remove a student from attendance
const removeStudentFromAttendance = async (req, res) => {
    try {
        const { attendanceId, studentId } = req.params;
        const schoolId = req.user.school;

        if (!isValidId(attendanceId) || !isValidId(studentId)) return res.status(400).json({ message: 'Invalid id(s)' });

        const attendance = await Attendance.findById(attendanceId);
        if (!attendance) return res.status(404).json({ message: 'Attendance record not found' });
        if (String(attendance.school) !== String(schoolId)) return res.status(403).json({ message: 'Not allowed' });

        const updated = await Attendance.findByIdAndUpdate(attendanceId, { $pull: { students: { studentId: mongoose.Types.ObjectId(studentId) } } }, { new: true });
        return res.status(200).json({ message: 'Student removed from attendance', attendance: updated });
    } catch (err) {
        console.error('removeStudentFromAttendance error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

//  Delete an attendance record
const deleteAttendanceRecord = async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const schoolId = req.user.school;

        if (!isValidId(attendanceId)) return res.status(400).json({ message: 'Invalid attendanceId' });

        const attendance = await Attendance.findById(attendanceId);
        if (!attendance) return res.status(404).json({ message: 'Attendance not found' });
        if (String(attendance.school) !== String(schoolId)) return res.status(403).json({ message: 'Not allowed' });

        await Attendance.findByIdAndDelete(attendanceId);
        return res.status(200).json({ message: 'Attendance deleted' });
    } catch (err) {
        console.error('deleteAttendanceRecord error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};


module.exports = {
    markAttendance,
    getAttendanceBySection,
    getAttendanceBySubject,
    getStudentAttendance,
    editSingleStudentAttendance,
    editMultipleStudentsAttendance,
    removeStudentFromAttendance,
    deleteAttendanceRecord,
};
