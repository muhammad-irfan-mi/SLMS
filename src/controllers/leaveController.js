// controllers/leaveController.js
const mongoose = require("mongoose");
const Leave = require("../models/Leave");
const AttendanceImported = require("../models/Attendance");
const Attendance = AttendanceImported.default || AttendanceImported;

// reuse your date formatter (copy from attendance file)
const formatDate = (date) => {
    const d = date ? new Date(date) : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};


// Student applies for leave for a given date.
const applyLeave = async (req, res) => {
    try {
        const school = req.user.school;
        const studentId = req.user._id;
        const studentName = req.user.name;
        const { classId, sectionId, dates, subject, reason } = req.body;

        if (!classId || !sectionId || !dates || !Array.isArray(dates) || dates.length === 0 || !reason || !subject) {
            return res.status(400).json({ message: "classId, sectionId, dates[], subject and reason are required" });
        }

        const formattedDates = dates.map(d => formatDate(d));

        // === CHECK 1: Prevent applying for past dates ===
        const today = formatDate(new Date());
        const pastDates = formattedDates.filter(d => d < today);

        if (pastDates.length > 0) {
            return res.status(400).json({
                message: "Cannot apply leave for past dates",
                pastDates
            });
        }

        const existing = await Leave.find({
            school,
            studentId,
            date: { $in: formattedDates },
            status: { $in: ["pending", "approved"] }
        }).lean();

        if (existing.length > 0) {
            const conflictDates = existing.map(e => e.date);
            return res.status(400).json({
                message: "Leave already applied for some dates",
                conflictDates
            });
        }

        const leaveDocs = formattedDates.map(date => ({
            school,
            studentId,
            studentName,
            classId,
            sectionId,
            date,
            subject,
            reason,
            status: "pending"
        }));

        const createdLeaves = await Leave.insertMany(leaveDocs);

        return res.status(201).json({
            message: "Leave applied successfully",
            total: createdLeaves.length,
            leaves: createdLeaves
        });

    } catch (err) {
        console.error("applyLeave error:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};


// Student can cancel their leave (if pending or approved).
const cancelLeave = async (req, res) => {
    try {
        const school = req.user.school;
        const studentId = req.user._id;
        const { id } = req.params;

        const leave = await Leave.findById(id);
        if (!leave) return res.status(404).json({ message: "Leave not found" });
        if (String(leave.school) !== String(school)) return res.status(403).json({ message: "Access denied" });
        if (String(leave.studentId) !== String(studentId)) return res.status(403).json({ message: "You can cancel only your leave" });

        if (leave.status === "cancelled") return res.status(400).json({ message: "Leave already cancelled" });

        leave.status = "cancelled";
        leave.reviewedAt = new Date();
        await leave.save();

        return res.status(200).json({ message: "Leave cancelled", leave });
    } catch (err) {
        console.error("cancelLeave error:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Teacher (incharge) fetches pending leaves for their class/section
const getLeaves = async (req, res) => {
    try {
        const school = req.user.school;
        const { classId, sectionId, status, studentId, date } = req.query;

        // Pagination
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 10;
        let skip = (page - 1) * limit;

        // Filters
        const filter = { school };

        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;
        if (status) filter.status = status;
        if (studentId) filter.studentId = studentId;
        if (date) filter.date = formatDate(date);

        // Count total results (before pagination)
        const total = await Leave.countDocuments(filter);

        // Fetch paginated results
        const leaves = await Leave.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        return res.status(200).json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            leaves
        });

    } catch (err) {
        console.error("getLeaves error:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};

//  Approve leave (teacher).
const approveLeave = async (req, res) => {
    try {
        const reviewerId = req.user._id;
        console.log(req.user)
        const school = req.user.school;
        const { id } = req.params;
        const { remark } = req.body;

        const leave = await Leave.findById(id);
        if (!leave) return res.status(404).json({ message: "Leave not found" });
        if (String(leave.school) !== String(school)) return res.status(403).json({ message: "Access denied" });
        if (leave.status === "approved") return res.status(400).json({ message: "Leave already approved" });

        leave.status = "approved";
        leave.reviewedBy = reviewerId;
        leave.reviewedAt = new Date();
        if (remark) leave.remark = remark;
        await leave.save();

        // Update attendance if exists for that date/class/section
        const attendance = await Attendance.findOne({
            school,
            classId: leave.classId,
            sectionId: leave.sectionId,
            date: leave.date,
        });

        if (attendance) {
            const student = attendance.students.find((s) => String(s.studentId) === String(leave.studentId));
            if (student) {
                student.status = "leave";
                await attendance.save();
            }
        }

        return res.status(200).json({ message: "Leave approved", leave });
    } catch (err) {
        console.error("approveLeave error:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Reject leave (teacher).
const rejectLeave = async (req, res) => {
    try {
        const reviewerId = req.user._id;
        const school = req.user.school;
        const { id } = req.params;
        const { remark } = req.body;

        const leave = await Leave.findById(id);
        if (!leave) return res.status(404).json({ message: "Leave not found" });
        if (String(leave.school) !== String(school)) return res.status(403).json({ message: "Access denied" });
        if (leave.status === "rejected") return res.status(400).json({ message: "Leave already rejected" });

        leave.status = "rejected";
        leave.reviewedBy = reviewerId;
        leave.reviewedAt = new Date();
        if (remark) leave.remark = remark;
        await leave.save();

        // Do not change attendance (teacher may update attendance separately)
        return res.status(200).json({ message: "Leave rejected", leave });
    } catch (err) {
        console.error("rejectLeave error:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Admin/teacher can get leaves for a specific student
const getLeavesByStudent = async (req, res) => {
    try {
        const school = req.user.school;
        const { studentId } = req.params;
        if (!studentId) return res.status(400).json({ message: "studentId required" });

        // Pagination
        let { page = 1, limit = 20 } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);

        const skip = (page - 1) * limit;

        // Count total leaves for this student
        const total = await Leave.countDocuments({ school, studentId });

        const leaves = await Leave.find({ school, studentId })
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        return res.status(200).json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            leaves
        });

    } catch (err) {
        console.error("getLeavesByStudent error:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};





// TEACHER APPLY LEAVE
const applyTeacherLeave = async (req, res) => {
    try {
        const school = req.user.school;
        const teacherId = req.user._id;
        const teacherName = req.user.name;
        const { dates, subject, reason } = req.body;

        if (!dates || !Array.isArray(dates) || dates.length === 0 || !subject || !reason) {
            return res.status(400).json({ message: "dates[], subject, reason required" });
        }

        const formattedDates = dates.map(d => formatDate(d));
        const today = formatDate(new Date());

        const pastDates = formattedDates.filter(d => d < today);
        if (pastDates.length > 0)
            return res.status(400).json({ message: "Cannot apply leave for past dates", pastDates });

        const existing = await Leave.find({
            school,
            teacherId,
            date: { $in: formattedDates },
            status: { $in: ["pending", "approved"] },
        });

        if (existing.length > 0) {
            return res.status(400).json({
                message: "Leave already applied for some dates",
                conflictDates: existing.map(e => e.date),
            });
        }

        const newLeaves = formattedDates.map(date => ({
            school,
            userType: "teacher",
            teacherId,
            teacherName,
            date,
            subject,
            reason,
            status: "pending",
        }));

        const created = await Leave.insertMany(newLeaves);

        res.status(201).json({ message: "Leave applied", leaves: created });
    } catch (err) {
        console.error("applyTeacherLeave error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// TEACHER VIEW OWN LEAVES
const getTeacherLeaves = async (req, res) => {
    try {
        const school = req.user.school;
        const teacherId = req.user._id;

        // Pagination
        let { page = 1, limit = 20 } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);

        const skip = (page - 1) * limit;

        // Total leave count
        const total = await Leave.countDocuments({
            school,
            teacherId,
            userType: "teacher",
        });

        const leaves = await Leave.find({
            school,
            teacherId,
            userType: "teacher",
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            leaves,
        });

    } catch (err) {
        console.error("getTeacherLeaves error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// TEACHER CAN UPDATE OWN PENDING FUTURE LEAVE
const updateTeacherLeave = async (req, res) => {
    try {
        const school = req.user.school;
        const teacherId = req.user._id;
        const { id } = req.params;
        const { subject, reason } = req.body;

        const leave = await Leave.findById(id);
        if (!leave) return res.status(404).json({ message: "Leave not found" });

        if (leave.teacherId?.toString() !== teacherId.toString())
            return res.status(403).json({ message: "Not your leave" });

        if (leave.status !== "pending")
            return res.status(400).json({ message: "Only pending leave can be updated" });

        const today = formatDate(new Date());
        if (leave.date < today)
            return res.status(400).json({ message: "Cannot update past leave" });

        if (subject) leave.subject = subject;
        if (reason) leave.reason = reason;

        await leave.save();

        res.status(200).json({ message: "Leave updated", leave });
    } catch (err) {
        console.error("updateTeacherLeave error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// TEACHER CANCEL LEAVE
const cancelTeacherLeave = async (req, res) => {
    try {
        const school = req.user.school;
        const teacherId = req.user._id;
        const { id } = req.params;

        const leave = await Leave.findById(id);

        if (!leave) return res.status(404).json({ message: "Leave not found" });

        if (leave.teacherId?.toString() !== teacherId.toString())
            return res.status(403).json({ message: "Not your leave" });

        leave.status = "cancelled";
        leave.reviewedAt = new Date();

        await leave.save();

        res.status(200).json({ message: "Leave cancelled", leave });
    } catch (err) {
        console.error("cancelTeacherLeave error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ADMIN APPROVE TEACHER LEAVE
const approveTeacherLeave = async (req, res) => {
    try {
        const school = req.user.school;
        const reviewer = req.user._id;
        const { id } = req.params;

        const leave = await Leave.findById(id);
        if (!leave) return res.status(404).json({ message: "Leave not found" });
        if (leave.userType !== "teacher") return res.status(400).json({ message: "Not a teacher leave" });

        leave.status = "approved";
        leave.reviewedAt = new Date();
        leave.reviewedBy = reviewer;

        await leave.save();

        res.status(200).json({ message: "Teacher leave approved", leave });
    } catch (err) {
        console.error("adminApproveTeacherLeave error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ADMIN REJECT TEACHER LEAVE
const rejectTeacherLeave = async (req, res) => {
    try {
        const school = req.user.school;
        const reviewer = req.user._id;
        const { id } = req.params;
        const { remark } = req.body;

        const leave = await Leave.findById(id);
        if (!leave) return res.status(404).json({ message: "Leave not found" });

        leave.status = "rejected";
        leave.reviewedBy = reviewer;
        leave.reviewedAt = new Date();
        if (remark) leave.remark = remark;

        await leave.save();

        res.status(200).json({ message: "Teacher leave rejected", leave });
    } catch (err) {
        console.error("adminRejectTeacherLeave error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};


module.exports = {
    applyLeave,
    cancelLeave,
    getLeaves,
    approveLeave,
    rejectLeave,
    getLeavesByStudent,
    applyTeacherLeave,
    getTeacherLeaves,
    updateTeacherLeave,
    cancelTeacherLeave,
    approveTeacherLeave,
    rejectTeacherLeave,
};
