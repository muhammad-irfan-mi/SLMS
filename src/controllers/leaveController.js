// controllers/leaveController.js
const mongoose = require("mongoose");
const Leave = require("../models/Leave");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const ClassSection = require("../models/ClassSection");

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
        const { classId, sectionId, dates, reason } = req.body;

        if (!classId || !sectionId || !dates || !Array.isArray(dates) || dates.length === 0 || !reason) {
            return res.status(400).json({ message: "classId, sectionId, dates[] and reason are required" });
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

        const filter = { school };
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;
        if (status) filter.status = status;
        if (studentId) filter.studentId = studentId;
        if (date) filter.date = formatDate(date);

        const leaves = await Leave.find(filter).sort({ createdAt: -1 }).lean();
        return res.status(200).json({ total: leaves.length, leaves });
    } catch (err) {
        console.error("getLeaves error:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};

//  Approve leave (teacher).
const approveLeave = async (req, res) => {
    try {
        const reviewerId = req.user._id;
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
                student.status = "leave"; // special status
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

        const leaves = await Leave.find({ school, studentId }).sort({ date: -1 }).lean();
        return res.status(200).json({ total: leaves.length, leaves });
    } catch (err) {
        console.error("getLeavesByStudent error:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};

module.exports = {
    applyLeave,
    cancelLeave,
    getLeaves,
    approveLeave,
    rejectLeave,
    getLeavesByStudent,
};
