const ComplaintFeedback = require("../models/ComplaintFeedback");
const User = require("../models/User");

//  Helper: verify student exists and class/section match
async function verifyStudentClassSection(studentId, classId, sectionId, schoolId) {
    const student = await User.findById(studentId).lean();
    if (!student) throw new Error("Student not found");

    if (student.school && student.school.toString() !== schoolId.toString()) {
        throw new Error("Student does not belong to this school");
    }

    if (!student.classInfo?.id || !student.sectionInfo?.id) {
        throw new Error("Student missing classInfo or sectionInfo");
    }

    if (student.classInfo.id.toString() !== classId.toString()) {
        throw new Error("Student not in this class");
    }

    if (student.sectionInfo.id.toString() !== sectionId.toString()) {
        throw new Error("Student not in this section");
    }

    return student;
}

// Create complaint or feedback (student)
const createEntry = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const createdBy = req.user._id;

        const { studentId, classId, sectionId, type, title, detail } = req.body;

        if (!studentId || !classId || !sectionId || !type || !title || !detail) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        if (!["complaint", "feedback"].includes(type)) {
            return res.status(400).json({ message: "Invalid type. Must be 'complaint' or 'feedback'." });
        }

        try {
            await verifyStudentClassSection(studentId, classId, sectionId, schoolId);
        } catch (err) {
            return res.status(400).json({ message: err.message });
        }

        const status = type === "complaint" ? "pending" : "submitted";

        const entry = await ComplaintFeedback.create({
            school: schoolId,
            studentId,
            classId,
            sectionId,
            type,
            title,
            detail,
            status,
            createdBy,
        });

        return res.status(201).json({ message: `${type} created`, entry });
    } catch (err) {
        console.error("Create entry error:", err);
        return res.status(500).json({ message: err.message });
    }
};

//  Update entry (student can update their own entry)
//  Complaints: can be edited only when NOT reviewed (review == null)
//  Feedback: can be edited anytime
const updateEntry = async (req, res) => {
    try {
        const entryId = req.params.id;
        const userId = req.user._id;

        const entry = await ComplaintFeedback.findById(entryId);
        if (!entry) return res.status(404).json({ message: "Entry not found" });

        if (entry.studentId.toString() !== userId.toString() && req.user.role !== "admin_office" && req.user.role !== "superadmin") {
            return res.status(403).json({ message: "Not authorized to update this entry" });
        }

        if (entry.type === "complaint" && entry.review && entry.review.reviewedAt) {
            return res.status(400).json({ message: "Complaint already reviewed and cannot be edited" });
        }

        const { title, detail } = req.body;
        if (title) entry.title = title;
        if (detail) entry.detail = detail;

        await entry.save();

        return res.status(200).json({ message: "Entry updated", entry });
    } catch (err) {
        console.error("Update entry error:", err);
        return res.status(500).json({ message: err.message });
    }
};

// Delete
const deleteEntry = async (req, res) => {
    try {
        const entryId = req.params.id;
        const userId = req.user._id;

        const entry = await ComplaintFeedback.findById(entryId);
        if (!entry) return res.status(404).json({ message: "Entry not found" });

        // owner or admin
        const isOwner = entry.studentId.toString() === userId.toString();
        const isAdmin = req.user.role === "admin_office" || req.user.role === "superadmin";

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: "Not authorized to delete this entry" });
        }

        // If owner and complaint reviewed -> disallow deletion
        if (isOwner && entry.type === "complaint" && entry.review && entry.review.reviewedAt) {
            return res.status(400).json({ message: "Cannot delete a reviewed complaint" });
        }

        await entry.deleteOne();

        return res.status(200).json({ message: "Entry deleted" });
    } catch (err) {
        console.error("Delete entry error:", err);
        return res.status(500).json({ message: err.message });
    }
};

// Admin review  complain
const reviewComplaint = async (req, res) => {
    try {
        const entryId = req.params.id;
        const reviewerId = req.user._id;

        const entry = await ComplaintFeedback.findById(entryId);
        if (!entry) return res.status(404).json({ message: "Entry not found" });

        if (entry.type !== "complaint") {
            return res.status(400).json({ message: "Only complaints can be reviewed" });
        }

        const { comment, action, status } = req.body;

        // If already reviewed, you may decide to allow update of review — we'll allow admin to update review
        entry.review = {
            reviewerId,
            comment: comment || "",
            action: action || "",
            reviewedAt: new Date(),
        };

        // set status: default to "reviewed" unless admin passes "resolved"
        if (status && ["reviewed", "resolved"].includes(status)) {
            entry.status = status;
        } else {
            entry.status = "reviewed";
        }

        await entry.save();

        return res.status(200).json({ message: "Complaint reviewed", entry });
    } catch (err) {
        console.error("Review complaint error:", err);
        return res.status(500).json({ message: err.message });
    }
};

// Get compllain by (admin/teacher)
const getComplain = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const {
            studentId,
            classId,
            sectionId,
            type,
            status,
            search,
            page = 1,
            limit = 10,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = req.query;

        const filter = { school: schoolId };

        if (studentId) filter.studentId = studentId;
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;
        if (type) filter.type = type;
        if (status) filter.status = status;

        if (search) {
            // text search on title/detail
            filter.$or = [
                { title: new RegExp(search, "i") },
                { detail: new RegExp(search, "i") },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [total, entries] = await Promise.all([
            ComplaintFeedback.countDocuments(filter),
            ComplaintFeedback.find(filter)
                .populate("studentId", "name email rollNo")
                .populate("classId", "class")
                .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
        ]);

        return res.status(200).json({
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
            entries,
        });
    } catch (err) {
        console.error("Get entries error:", err);
        return res.status(500).json({ message: err.message });
    }
};

//  Student get own complain
const getComplainByStudent = async (req, res) => {
    try {
        const studentId = req.user._id;
        const { page = 1, limit = 10, type, status, search } = req.query;

        const filter = { studentId };

        if (type) filter.type = type;
        if (status) filter.status = status;

        if (search) {
            filter.$or = [
                { title: new RegExp(search, "i") },
                { detail: new RegExp(search, "i") },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [total, entries] = await Promise.all([
            ComplaintFeedback.countDocuments(filter),
            ComplaintFeedback.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
        ]);

        return res.status(200).json({
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
            entries,
        });
    } catch (err) {
        console.error("Get student entries error:", err);
        return res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createEntry,
    updateEntry,
    deleteEntry,
    reviewComplaint,
    getComplain,
    getComplainByStudent,
};
