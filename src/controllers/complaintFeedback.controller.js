const ComplaintFeedback = require("../models/ComplaintFeedback");
const User = require("../models/User");
const School = require("../models/School");

// Helper: verify student exists and class/section match
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

        if (studentId !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only create entries for yourself"
            });
        }

        try {
            await verifyStudentClassSection(studentId, classId, sectionId, schoolId);
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
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

        return res.status(201).json({
            success: true,
            message: `${type} created successfully`,
            data: {
                ...entry.toObject(),
                daysUntilAutoDelete: entry.daysUntilAutoDelete,
                autoDeleteAt: entry.autoDeleteAt
            }
        });
    } catch (err) {
        console.error("Create entry error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Update entry (student can update their own entry)
const updateEntry = async (req, res) => {
    try {
        const entryId = req.params.id;
        const userId = req.user._id;
        const { title, detail } = req.body;

        const entry = await ComplaintFeedback.findById(entryId);
        if (!entry) {
            return res.status(404).json({
                success: false,
                message: "Entry not found"
            });
        }

        const isOwner = entry.studentId.toString() === userId.toString();
        const isAdmin = req.user.role === "admin_office" || req.user.role === "superadmin";

        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to update this entry"
            });
        }

        if (entry.type === "complaint" && isOwner) {
            const hasAdminReview = entry.reviews.some(review => review.reviewerRole === 'admin');
            if (hasAdminReview) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot update complaint after admin review"
                });
            }
        }

        // Update fields
        if (title) entry.title = title;
        if (detail) entry.detail = detail;

        await entry.save();

        return res.status(200).json({
            success: true,
            message: "Entry updated successfully",
            data: {
                ...entry.toObject(),
                daysUntilAutoDelete: entry.daysUntilAutoDelete
            }
        });
    } catch (err) {
        console.error("Update entry error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Delete entry
const deleteEntry = async (req, res) => {
    try {
        const entryId = req.params.id;
        const userId = req.user._id;
        const userRole = req.user.role || "school";

        const entry = await ComplaintFeedback.findById(entryId);
        if (!entry) {
            return res.status(404).json({
                success: false,
                message: "Entry not found"
            });
        }

        const isOwner = entry.studentId.toString() === userId.toString();
        const isAdmin = userRole === "admin_office" || userRole === "school";

        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to delete this entry"
            });
        }

        if (isOwner && entry.type === "complaint") {
            const hasAdminReview = entry.reviews.some(review => review.reviewerRole === 'admin');
            if (hasAdminReview) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot delete a complaint that has been reviewed by admin"
                });
            }
        }

        await entry.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Entry deleted successfully"
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Add review to complaint
const reviewComplaint = async (req, res) => {
    try {
        console.log("req.user:", req.user);
        console.log("req.user.role:", req.user.role);
        console.log("req.user._id:", req.user._id);

        const entryId = req.params.id;
        const reviewerId = req.user._id;
        const { comment, action } = req.body;

        const entry = await ComplaintFeedback.findById(entryId);
        if (!entry) {
            return res.status(404).json({
                success: false,
                message: "Entry not found"
            });
        }

        if (entry.type !== "complaint") {
            return res.status(400).json({
                success: false,
                message: "Only complaints can be reviewed"
            });
        }

        let isAdminOrSchool = false;
        let userRole = req.user.role;

        if (!userRole) {
            if (req.user.schoolId || req.user.name?.includes("School")) {
                isAdminOrSchool = true;
                userRole = "school";
            }
        } else {
            isAdminOrSchool = ["superadmin", "school"].includes(userRole);
        }

        const reviewerRole = isAdminOrSchool ? "admin" : "user";

        console.log("isAdminOrSchool:", isAdminOrSchool);
        console.log("userRole:", userRole);
        console.log("reviewerRole:", reviewerRole);

        // Authorization check
        if (isAdminOrSchool) {
            // Admin/school can only review complaints from their school
            // For school users: req.user._id is the school ID
            // For admin users: req.user.school is the school ID
            const schoolId = userRole === "school" ? req.user._id : req.user.school;

            console.log("schoolId from user:", schoolId);
            console.log("entry.school:", entry.school);

            if (entry.school.toString() !== schoolId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: "You can only review complaints from your school"
                });
            }
        } else {
            // Students can only review their own complaints
            if (entry.studentId.toString() !== reviewerId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: "You can only review your own complaints"
                });
            }
        }

        // Create new review
        const newReview = {
            reviewerId,
            reviewerRole,
            comment,
            action: action || "",
            reviewedAt: new Date(),
            // Store reviewer info directly
            reviewerName: req.user.name || "School Admin",
            reviewerEmail: req.user.email || "",
            reviewerType: userRole || "unknown" // Store the actual role
        };

        console.log("New review:", newReview);

        // Add review to array
        entry.reviews.push(newReview);

        // Update status if admin/school reviews for the first time
        if (isAdminOrSchool && entry.status === "pending") {
            entry.status = "reviewed";
        }

        await entry.save();

        return res.status(200).json({
            success: true,
            message: "Review added successfully",
            data: {
                entry,
                review: newReview,
                daysUntilAutoDelete: entry.daysUntilAutoDelete
            }
        });
    } catch (err) {
        console.error("Review complaint error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Get entries (admin/teacher) - Enhanced with advanced filtering
const getComplain = async (req, res) => {
    try {
        const schoolId = req.user.school || req.user._id;
        const {
            studentId,
            classId,
            sectionId,
            type,
            status,
            search,
            page = 1,
            limit = 10
        } = req.query;

        const filter = { school: schoolId };

        if (studentId) filter.studentId = studentId;
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;
        if (type) filter.type = type;
        if (status) filter.status = status;

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: "i" } },
                { detail: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const query = ComplaintFeedback.find(filter)
            .populate("studentId", "name email rollNo profileImage")
            .populate({
                path: "classId",
                select: "class sections"
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const [total, entries] = await Promise.all([
            ComplaintFeedback.countDocuments(filter),
            query.lean()
        ]);



        const formattedEntries = await Promise.all(
            entries.map(async (entry) => {
                const now = new Date();
                const deleteDate = new Date(entry.autoDeleteAt);
                const diffTime = deleteDate - now;
                const daysUntilAutoDelete = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

                let classInfo = null;
                if (entry.classId) {
                    classInfo = {
                        id: entry.classId._id,
                        name: entry.classId.class
                    };
                }

                let sectionInfo = null;
                if (
                    entry.classId &&
                    entry.sectionId &&
                    entry.classId.sections
                ) {
                    const foundSection = entry.classId.sections.find(
                        section =>
                            section._id.toString() ===
                            entry.sectionId.toString()
                    );

                    if (foundSection) {
                        sectionInfo = {
                            id: foundSection._id,
                            name: foundSection.name
                        };
                    }
                }

                const processedReviews = await Promise.all(
                    entry.reviews.map(async (review) => {
                        let reviewerInfo = null;

                        if (review.reviewerId) {
                            const user = await User.findById(review.reviewerId)
                                .select("name email role profileImage")
                                .lean();

                            if (user) {
                                reviewerInfo = {
                                    name: user.name,
                                    email: user.email,
                                    role: user.role,
                                    profileImage: user.profileImage
                                };
                            } else {
                                const school = await School.findById(review.reviewerId)
                                    .select("name email schoolId")
                                    .lean();

                                if (school) {
                                    reviewerInfo = {
                                        id: school._id,
                                        name: school.name,
                                        email: school.email,
                                        role: "school",
                                        schoolId: school.schoolId
                                    };
                                }
                            }

                        }

                        return {
                            id: review._id,
                            comment: review.comment,
                            action: review.action,
                            reviewerRole: review.reviewerRole,
                            reviewedAt: review.reviewedAt,
                            reviewer: reviewerInfo
                        };
                    })
                );

                return {
                    id: entry._id,
                    type: entry.type,
                    title: entry.title,
                    detail: entry.detail,
                    status: entry.status,
                    studentInfo: entry.studentId ? {
                        id: entry.studentId._id,
                        name: entry.studentId.name,
                        email: entry.studentId.email,
                        rollNo: entry.studentId.rollNo,
                        profileImage: entry.studentId.profileImage
                    } : null,
                    classInfo,
                    sectionInfo,
                    reviews: processedReviews,
                    autoDeleteAt: entry.autoDeleteAt,
                    createdAt: entry.createdAt,
                    updatedAt: entry.updatedAt,
                    daysUntilAutoDelete,
                    isExpired: now > deleteDate
                };
            })
        );

        const totalPages = Math.ceil(total / Number(limit));

        return res.status(200).json({
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages,
            data: formattedEntries,
        });
    } catch (err) {
        console.error("Get entries error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Student get own entries
const getComplainByStudent = async (req, res) => {
    try {
        const studentId = req.user._id;
        const { page = 1, limit = 10, type, status, search } = req.query;

        const filter = { studentId };

        if (type) filter.type = type;
        if (status) filter.status = status;

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: "i" } },
                { detail: { $regex: search, $options: "i" } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const query = ComplaintFeedback.find(filter)
            .populate({
                path: "classId",
                select: "class sections"
            })
            // .populate("reviews.reviewerId", "name email role profileImage")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const [total, entries] = await Promise.all([
            ComplaintFeedback.countDocuments(filter),
            query.lean()
        ]);

        const student = await User.findById(studentId)
            .select("name email rollNo phone address profileImage")
            .lean();

        const formattedEntries = await Promise.all(
            entries.map(async (entry) => {
                const now = new Date();
                const deleteDate = new Date(entry.autoDeleteAt);
                const diffTime = deleteDate - now;
                const daysUntilAutoDelete = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

                let classInfo = {};
                let sectionInfo = {};

                if (entry.classId) {
                    classInfo = {
                        id: entry.classId._id,
                        name: entry.classId.class,
                    };

                    if (entry.sectionId && entry.classId.sections) {
                        const foundSection = entry.classId.sections.find(
                            section => section._id.toString() === entry.sectionId.toString()
                        );

                        if (foundSection) {
                            sectionInfo = {
                                id: foundSection._id,
                                name: foundSection.name,
                            };
                        }
                    }
                }

                const processedReviews = await Promise.all(
                    entry.reviews.map(async (review) => {
                        let reviewerInfo = null;

                        if (review.reviewerId) {
                            try {
                                const user = await User.findById(review.reviewerId)
                                    .select("name email role profileImage")
                                    .lean();

                                if (user) {
                                    reviewerInfo = {
                                        id: user._id,
                                        name: user.name,
                                        email: user.email,
                                        role: user.role,
                                        profileImage: user.profileImage
                                    };
                                } else {
                                    const school = await School.findById(review.reviewerId)
                                        .select("name email schoolId")
                                        .lean();

                                    if (school) {
                                        reviewerInfo = {
                                            id: school._id,
                                            name: school.name,
                                            email: school.email,
                                            role: "school",
                                            schoolId: school.schoolId
                                        };
                                    }
                                }
                            } catch (err) {
                                if (review.reviewerName) {
                                    reviewerInfo = {
                                        name: review.reviewerName,
                                        email: review.reviewerEmail || "",
                                        role: review.reviewerType || "unknown"
                                    };
                                }
                            }
                        } else if (review.reviewerName) {
                            reviewerInfo = {
                                name: review.reviewerName,
                                email: review.reviewerEmail || "",
                                role: review.reviewerType || "unknown"
                            };
                        }

                        return {
                            id: review._id,
                            comment: review.comment,
                            action: review.action,
                            reviewerRole: review.reviewerRole,
                            reviewedAt: review.reviewedAt,
                            reviewer: reviewerInfo
                        };
                    })
                );

                const studentInfo = student ? {
                    id: student._id,
                    name: student.name,
                    email: student.email,
                    rollNo: student.rollNo,
                    phone: student.phone,
                    address: student.address,
                    profileImage: student.profileImage,
                } : null;

                return {
                    id: entry._id,
                    type: entry.type,
                    title: entry.title,
                    detail: entry.detail,
                    status: entry.status,
                    classInfo: classInfo,
                    sectionInfo: sectionInfo,
                    studentInfo: studentInfo,
                    reviews: processedReviews,
                    autoDeleteAt: entry.autoDeleteAt,
                    createdAt: entry.createdAt,
                    updatedAt: entry.updatedAt,
                    daysUntilAutoDelete,
                    isExpired: now > deleteDate,
                };
            })
        );

        // Calculate pagination info
        const totalPages = Math.ceil(total / Number(limit));

        return res.status(200).json({
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages,
            data: formattedEntries,
        });
    } catch (err) {
        console.error("Get student entries error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Update status (admin only)
const updateStatus = async (req, res) => {
    try {
        const entryId = req.params.id;
        const { status } = req.body;

        if (!status || !["pending", "reviewed", "addressed"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Valid status is required"
            });
        }

        const entry = await ComplaintFeedback.findById(entryId);
        if (!entry) {
            return res.status(404).json({
                success: false,
                message: "Entry not found"
            });
        }

        // Only allow status update for complaints
        if (entry.type !== "complaint") {
            return res.status(400).json({
                success: false,
                message: "Status can only be updated for complaints"
            });
        }

        entry.status = status;
        await entry.save();

        return res.status(200).json({
            success: true,
            message: "Status updated successfully",
            data: entry
        });
    } catch (err) {
        console.error("Update status error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Student marks complaint as resolved
const markAsResolvedByStudent = async (req, res) => {
    try {
        const entryId = req.params.id;
        const studentId = req.user._id;

        const entry = await ComplaintFeedback.findById(entryId);
        if (!entry) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found"
            });
        }

        // Check if the complaint belongs to the logged-in student
        if (entry.studentId.toString() !== studentId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only mark your own complaints as resolved"
            });
        }

        // Check if it's a complaint (not feedback)
        if (entry.type !== "complaint") {
            return res.status(400).json({
                success: false,
                message: "Only complaints can be marked as resolved"
            });
        }

        // Check current status - can only mark as resolved from certain statuses
        const allowedStatuses = ["reviewed", "addressed", "pending"];
        if (!allowedStatuses.includes(entry.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot mark complaint as resolved from current status: ${entry.status}. Complaint must be in 'pending', 'reviewed', or 'addressed' status.`
            });
        }

        // Update status to resolved
        entry.status = "resolved";

        // Add an automatic review/comment about the resolution
        const resolutionReview = {
            reviewerId: studentId,
            reviewerRole: "user",
            reviewerName: req.user.name || "Student",
            reviewerEmail: req.user.email || "",
            reviewerType: "student",
            comment: "Student marked this complaint as resolved.",
            action: "marked_resolved",
            reviewedAt: new Date()
        };

        entry.reviews.push(resolutionReview);
        await entry.save();

        return res.status(200).json({
            success: true,
            message: "Complaint marked as resolved successfully",
            data: {
                id: entry._id,
                type: entry.type,
                title: entry.title,
                status: entry.status,
                updatedAt: entry.updatedAt,
                resolutionComment: resolutionReview.comment
            }
        });
    } catch (err) {
        console.error("Mark as resolved error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

module.exports = {
    createEntry,
    updateEntry,
    deleteEntry,
    reviewComplaint,
    getComplain,
    getComplainByStudent,
    updateStatus,
    markAsResolvedByStudent
};