const mongoose = require("mongoose");
const Leave = require("../models/Leave");
const AttendanceImported = require("../models/Attendance");
const User = require("../models/User");
const ClassSection = require("../models/ClassSection");
const School = require("../models/School");
const { sendStudentLeaveNotification, sendTeacherLeaveNotification } = require("../utils/notificationService");
const Attendance = AttendanceImported.default || AttendanceImported;

const formatDate = (date) => {
    if (!date) return null;

    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) {
        throw new Error("Invalid date");
    }

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

// Check if student belongs to the class/section
const validateStudentClassSection = async (studentId, classId, sectionId, school) => {
    try {
        console.log("DEBUG - validateStudentClassSection called with:");
        console.log("studentId:", studentId);
        console.log("classId:", classId);
        console.log("sectionId:", sectionId);
        console.log("school:", school);

        // First, check if the user exists at all
        const student = await User.findOne({
            _id: new mongoose.Types.ObjectId(String(studentId)),
            school: new mongoose.Types.ObjectId(String(school)),
            role: 'student'
        }).select('classInfo sectionInfo verified').lean();

        console.log("DEBUG - Found student (no status filter):", student);

        if (!student) {
            return {
                valid: false,
                message: "Student not found in database"
            };
        }

        // Check if student is verified (if that's your "status" equivalent)
        if (!student.verified) {
            return {
                valid: false,
                message: "Student account is not verified"
            };
        }

        // Check if student has classInfo and sectionInfo
        if (!student.classInfo || !student.sectionInfo) {
            return {
                valid: false,
                message: "Student is not assigned to any class or section"
            };
        }

        // Compare IDs
        const storedClassId = String(student.classInfo.id);
        const storedSectionId = String(student.sectionInfo.id);
        const incomingClassId = String(classId);
        const incomingSectionId = String(sectionId);

        console.log("DEBUG - ID Comparison:", {
            storedClassId,
            incomingClassId,
            storedSectionId,
            incomingSectionId,
            classMatch: storedClassId === incomingClassId,
            sectionMatch: storedSectionId === incomingSectionId
        });

        if (storedClassId !== incomingClassId) {
            return {
                valid: false,
                message: `Student is not enrolled in this class`
            };
        }

        if (storedSectionId !== incomingSectionId) {
            return {
                valid: false,
                message: `Student is not enrolled in this section`
            };
        }

        return { valid: true };
    } catch (error) {
        console.error("Error in validateStudentClassSection:", error);
        return { valid: false, message: "Error validating student enrollment: " + error.message };
    }
};

// Check if teacher is assigned to class/section
const validateTeacherClassSection = async (teacherId, school) => {
    try {
        const teacher = await User.findOne({
            _id: teacherId,
            school,
            role: 'teacher',
            isIncharge: true,
        }).select('classInfo sectionInfo').lean();

        if (!teacher) {
            return { valid: false, message: "Teacher not found or not an incharge" };
        }

        return {
            valid: true,
            classId: teacher.classInfo?.id,
            sectionId: teacher.sectionInfo?.id
        };
    } catch (error) {
        return { valid: false, message: "Error validating teacher assignment" };
    }
};

// Student applies for leave for a given date.
const applyLeave = async (req, res) => {
    try {
        const school = req.user.school;
        const studentId = req.user._id;
        const studentName = req.user.name;
        const { classId, sectionId, dates, subject, reason } = req.body;

        console.log("DEBUG - Leave application request:", {
            studentId,
            studentName,
            dates,
            classId,
            sectionId,
            subject,
            reason
        });

        // Validate student enrollment
        const enrollmentCheck = await validateStudentClassSection(studentId, classId, sectionId, school);
        if (!enrollmentCheck.valid) {
            return res.status(403).json({
                message: enrollmentCheck.message
            });
        }

        // Format and validate all dates
        const formattedDates = [];
        const validationErrors = [];

        for (const date of dates) {
            try {
                // Ensure we get a consistent format
                let formattedDate;
                if (date instanceof Date) {
                    formattedDate = formatDate(date);
                } else if (typeof date === 'string') {
                    // Parse the date string
                    const parsedDate = new Date(date);
                    if (isNaN(parsedDate.getTime())) {
                        throw new Error("Invalid date string");
                    }
                    formattedDate = formatDate(parsedDate);
                } else {
                    throw new Error("Invalid date type");
                }

                // Check for past dates
                const today = formatDate(new Date());
                if (formattedDate < today) {
                    validationErrors.push({
                        date: date,
                        error: `Cannot apply leave for past date: ${formattedDate}`
                    });
                    continue;
                }

                formattedDates.push(formattedDate);
            } catch (error) {
                validationErrors.push({
                    date: date,
                    error: `Invalid date format: ${error.message}`
                });
            }
        }

        // Return validation errors if any
        if (validationErrors.length > 0) {
            return res.status(400).json({
                message: "Some dates have validation errors",
                errors: validationErrors,
                validDatesCount: formattedDates.length
            });
        }

        if (formattedDates.length === 0) {
            return res.status(400).json({
                message: "No valid dates provided for leave application"
            });
        }

        // Check for duplicate dates in the request - using a Set for proper deduplication
        const uniqueDatesSet = new Set(formattedDates);
        if (uniqueDatesSet.size !== formattedDates.length) {
            // Find the duplicates
            const seen = new Set();
            const duplicates = [];

            for (const date of formattedDates) {
                if (seen.has(date)) {
                    duplicates.push(date);
                } else {
                    seen.add(date);
                }
            }

            return res.status(400).json({
                message: "Duplicate dates found in request",
                duplicates: duplicates,
                uniqueDates: Array.from(uniqueDatesSet)
            });
        }

        console.log("DEBUG - Valid formatted dates:", formattedDates);

        // Check for existing leaves that overlap with any of the requested dates
        // Since you're using an array of dates, we need to check if any existing leave
        // has dates that overlap with our requested dates
        const existingLeaves = await Leave.find({
            school,
            studentId,
            dates: { $in: formattedDates },
            status: { $in: ["pending", "approved"] }
        }).select('dates status').lean();

        if (existingLeaves.length > 0) {
            // Find overlapping dates
            const overlappingDates = [];
            existingLeaves.forEach(leave => {
                leave.dates.forEach(date => {
                    if (formattedDates.includes(date) && !overlappingDates.includes(date)) {
                        overlappingDates.push(date);
                    }
                });
            });

            if (overlappingDates.length > 0) {
                return res.status(409).json({
                    message: "Leave already exists for some dates",
                    overlappingDates: overlappingDates,
                    availableDates: formattedDates.filter(date => !overlappingDates.includes(date))
                });
            }
        }

        // Create single leave object with all dates
        const leaveData = {
            school,
            studentId,
            studentName,
            classId,
            sectionId,
            dates: formattedDates,
            subject,
            reason,
            status: "pending",
            appliedAt: new Date(),
            userType: "student"
        };

        console.log("DEBUG - Creating leave with dates:", formattedDates);

        // Create the leave document
        const createdLeave = await Leave.create(leaveData);

        // Send notification
        await sendStudentLeaveNotification({
            leave: createdLeave,
            actor: req.user,
            action: 'create'
        });

        return res.status(201).json({
            success: true,
            message: `Leave applied successfully for ${createdLeave.dates.length} date(s)`,
            leave: {
                _id: createdLeave._id,
                dates: createdLeave.dates,
                subject: createdLeave.subject,
                reason: createdLeave.reason,
                status: createdLeave.status,
                appliedAt: createdLeave.appliedAt
            }
        });

    } catch (err) {
        console.error("applyLeave error:", err);

        // Check if it's a validation error
        if (err.name === 'ValidationError') {
            const validationErrors = Object.values(err.errors).map(error => ({
                field: error.path,
                message: error.message
            }));

            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: validationErrors
            });
        }

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Student updates an existing leave
const updateLeave = async (req, res) => {
    try {
        const school = req.user.school;
        const studentId = req.user._id;
        const { id } = req.params;
        const { dates, subject, reason } = req.body; // Changed from 'date' to 'dates'

        const leave = await Leave.findOne({
            _id: id,
            school,
            studentId
        });

        if (!leave) {
            return res.status(404).json({
                message: "Leave not found"
            });
        }

        if (leave.status !== "pending") {
            return res.status(400).json({
                message: `Cannot update a ${leave.status} leave`
            });
        }

        let updatedDates = leave.dates; // Keep existing dates by default
        let dateUpdates = {};

        // If new dates are provided, process them
        if (dates && Array.isArray(dates) && dates.length > 0) {
            // Format and validate all new dates
            const formattedDates = [];
            const validationErrors = [];

            for (const date of dates) {
                try {
                    const formattedDate = formatDate(date);
                    const today = formatDate(new Date());

                    // Check for past dates
                    if (formattedDate < today) {
                        validationErrors.push({
                            date: date,
                            error: `Cannot update leave to include past date: ${formattedDate}`
                        });
                        continue;
                    }

                    formattedDates.push(formattedDate);
                } catch (error) {
                    validationErrors.push({
                        date: date,
                        error: `Invalid date format: ${error.message}`
                    });
                }
            }

            // Return validation errors if any
            if (validationErrors.length > 0) {
                return res.status(400).json({
                    message: "Some dates have validation errors",
                    errors: validationErrors
                });
            }

            // Remove duplicates from new dates
            const uniqueNewDates = [...new Set(formattedDates)];

            // Check for date conflicts (excluding the current leave)
            const existingLeaves = await Leave.find({
                _id: { $ne: id },
                school,
                studentId,
                dates: { $in: uniqueNewDates },
                status: { $in: ["pending", "approved"] }
            }).select('dates').lean();

            if (existingLeaves.length > 0) {
                // Find overlapping dates
                const overlappingDates = [];
                existingLeaves.forEach(existingLeave => {
                    existingLeave.dates.forEach(date => {
                        if (uniqueNewDates.includes(date) && !overlappingDates.includes(date)) {
                            overlappingDates.push(date);
                        }
                    });
                });

                if (overlappingDates.length > 0) {
                    return res.status(409).json({
                        message: "Leave already exists for some dates",
                        conflictDates: overlappingDates,
                        availableDates: uniqueNewDates.filter(date => !overlappingDates.includes(date))
                    });
                }
            }

            updatedDates = uniqueNewDates.sort(); // Update with new sorted dates
            dateUpdates = { dates: updatedDates };
        }

        // Prepare update object
        const updateData = {
            ...(subject !== undefined && { subject }),
            ...(reason !== undefined && { reason }),
            ...dateUpdates,
            updatedAt: new Date()
        };

        // Check if at least one field is being updated
        if (Object.keys(updateData).length === 1 && updateData.updatedAt) {
            return res.status(400).json({
                message: "No fields to update provided"
            });
        }

        // Update the leave
        const updatedLeave = await Leave.findOneAndUpdate(
            { _id: id, school, studentId },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        // Send notification
        await sendStudentLeaveNotification({
            leave: updatedLeave,
            actor: req.user,
            action: 'update'
        });

        return res.status(200).json({
            message: "Leave updated successfully",
            leave: {
                _id: updatedLeave._id,
                dates: updatedLeave.dates,
                subject: updatedLeave.subject,
                reason: updatedLeave.reason,
                status: updatedLeave.status,
                updatedAt: updatedLeave.updatedAt
            }
        });

    } catch (err) {
        console.error("updateLeave error:", err);

        if (err.name === 'ValidationError') {
            const validationErrors = Object.values(err.errors).map(error => ({
                field: error.path,
                message: error.message
            }));

            return res.status(400).json({
                message: "Validation failed",
                errors: validationErrors
            });
        }

        return res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
}

// Student can cancel their leave (if pending or approved).
const cancelLeave = async (req, res) => {
    try {
        const school = req.user.school;
        const studentId = req.user._id;
        const { id } = req.params;

        const leave = await Leave.findById(id);
        if (!leave) {
            return res.status(404).json({ message: "Leave not found" });
        }

        if (String(leave.school) !== String(school)) {
            return res.status(403).json({ message: "Access denied" });
        }

        if (String(leave.studentId) !== String(studentId)) {
            return res.status(403).json({ message: "You can only cancel your own leave" });
        }

        const enrollmentCheck = await validateStudentClassSection(
            studentId,
            leave.classId,
            leave.sectionId,
            school
        );
        if (!enrollmentCheck.valid) {
            return res.status(403).json({
                message: "You are no longer enrolled in this class/section"
            });
        }

        if (leave.status === "cancelled") {
            return res.status(400).json({ message: "Leave already cancelled" });
        }

        if (leave.status === "rejected") {
            return res.status(400).json({ message: "Cannot cancel a rejected leave" });
        }

        // Check if any dates are in the past
        const today = formatDate(new Date());
        const pastDates = leave.dates.filter(d => d < today);
        if (pastDates.length > 0) {
            return res.status(400).json({
                message: "Cannot cancel leave for past dates",
                pastDates: pastDates
            });
        }

        leave.status = "cancelled";
        leave.reviewedAt = new Date();
        await leave.save();

        await sendStudentLeaveNotification({
            leave: leave,
            actor: req.user,
            action: 'cancel'
        });

        // If leave was approved, update attendance status for all dates
        if (leave.status === "approved") {
            const updatePromises = leave.dates.map(async (date) => {
                const attendance = await Attendance.findOne({
                    school,
                    classId: leave.classId,
                    sectionId: leave.sectionId,
                    date: date,
                });

                if (attendance) {
                    const student = attendance.students.find(
                        (s) => String(s.studentId) === String(leave.studentId)
                    );

                    if (student && student.status === "leave") {
                        // Change status back to present (or as per your policy)
                        student.status = "present";
                        student.hasApprovedLeave = false;
                        await attendance.save();
                    }
                }
            });

            await Promise.all(updatePromises);
        }

        return res.status(200).json({
            message: "Leave cancelled successfully",
            leave: {
                _id: leave._id,
                dates: leave.dates,
                status: leave.status,
                cancelledAt: leave.reviewedAt
            }
        });
    } catch (err) {
        console.error("cancelLeave error:", err);
        return res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
};

// Teacher (incharge) fetches pending leaves for their class/section
const getLeaves = async (req, res) => {
    try {
        const user = req.user;

        const role = user.role || "school";
        const isSchool = role === "school";
        const isAdminOffice = role === "admin_office";
        const isTeacher = role === "teacher";

        const schoolId = isSchool ? user._id : user.school;
        const userId = user._id;

        const {
            userType,
            classId,
            sectionId,
            studentId,
            teacherId,
            status,
            date,
            startDate,
            endDate,
            page = 1,
            limit = 10
        } = req.query;


        if (!userType || !["student", "teacher"].includes(userType)) {
            return res.status(400).json({
                message: "userType is required and must be 'student' or 'teacher'"
            });
        }

        if (isTeacher && userType === "teacher") {
            return res.status(403).json({
                message: "Teachers are not allowed to view teacher leaves"
            });
        }


        const filter = { school: schoolId, userType };

        if (isTeacher) {
            const teacherCheck = await validateTeacherClassSection(userId, schoolId);
            if (!teacherCheck.valid) {
                return res.status(403).json({
                    message: "You are not assigned as an incharge teacher"
                });
            }
            filter.classId = teacherCheck.classId;
            filter.sectionId = teacherCheck.sectionId;
        }

        if (isSchool || isAdminOffice) {
            if (userType === "student") {
                if (classId) filter.classId = classId;
                if (sectionId) filter.sectionId = sectionId;
                if (studentId) filter.studentId = studentId;
            }
            if (userType === "teacher" && teacherId) {
                filter.teacherId = teacherId;
            }
        }

        if (status) filter.status = status;

        if (date) {
            filter.date = formatDate(date);
        } else if (startDate && endDate) {
            filter.date = {
                $gte: formatDate(startDate),
                $lte: formatDate(endDate)
            };
        }


        const skip = (page - 1) * limit;
        const total = await Leave.countDocuments(filter);

        let leaves = await Leave.find(filter)
            .populate("studentId", "name email")
            .populate("teacherId", "name email")
            .populate("classId", "class sections")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();


        for (const leave of leaves) {
            if (!leave.reviewedBy) continue;

            let reviewer = await User.findById(leave.reviewedBy)
                .select("name email role")
                .lean();

            if (!reviewer) {
                reviewer = await School.findById(leave.reviewedBy)
                    .select("name email")
                    .lean();

                if (reviewer) reviewer.role = "school";
            }

            leave.reviewedBy = reviewer
                ? {
                    _id: reviewer._id,
                    name: reviewer.name,
                    email: reviewer.email,
                    role: reviewer.role
                }
                : null;
        }

        const formattedLeaves = leaves.map(leave => {
            let sectionInfo = null;

            if (leave.classId?.sections && leave.sectionId) {
                const sec = leave.classId.sections.find(
                    s => String(s._id) === String(leave.sectionId)
                );
                if (sec) sectionInfo = { _id: sec._id, name: sec.name };
            }

            return {
                _id: leave._id,
                school: leave.school,
                studentId: leave.studentId,
                studentName: leave.studentName || null,
                teacherId: leave.teacherId,
                classId: leave.classId
                    ? { _id: leave.classId._id, class: leave.classId.class }
                    : null,
                sectionId: sectionInfo,
                userType: leave.userType,
                date: leave.date,
                subject: leave.subject,
                reason: leave.reason,
                appliedAt: leave.appliedAt,
                status: leave.status,
                reviewedAt: leave.reviewedAt,
                reviewedBy: leave.reviewedBy,
                createdAt: leave.createdAt,
                updatedAt: leave.updatedAt
            };
        });

        return res.status(200).json({
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / limit),
            leaves: formattedLeaves
        });

    } catch (err) {
        console.error("getLeaves error:", err);
        return res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
};

// Approve leave (teacher).
const approveLeave = async (req, res) => {
    try {
        const user = req.user
        const reviewerId = req.user._id;
        const reviewerRole = user.role || "school";
        const schoolId = user.role ? user.school : user._id;
        const { id } = req.params;
        const { remark } = req.body;

        const leave = await Leave.findById(id);
        if (!leave) {
            return res.status(404).json({ message: "Leave not found" });
        }

        if (String(leave.school) !== String(schoolId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        if (leave.userType === "teacher") {
            return approveTeacherLeave(req, res);
        }

        if (reviewerRole === 'teacher') {
            const teacherCheck = await validateTeacherClassSection(reviewerId, schoolId);
            if (!teacherCheck.valid) {
                return res.status(403).json({
                    message: "You are not authorized to approve leaves"
                });
            }

            if (leave.userType !== "student") {
                return res.status(403).json({
                    message: "Teachers cannot approve teacher leaves"
                });
            }
            if (String(leave.classId) !== String(teacherCheck.classId) ||
                String(leave.sectionId) !== String(teacherCheck.sectionId)) {
                return res.status(403).json({
                    message: "You can only approve leaves from your assigned class/section"
                });
            }
        }

        if (leave.status === "approved") {
            return res.status(400).json({ message: "Leave already approved" });
        }

        if (leave.status === "cancelled") {
            return res.status(400).json({ message: "Cannot approve a cancelled leave" });
        }

        if (leave.status === "rejected") {
            return res.status(400).json({ message: "Cannot approve a rejected leave" });
        }

        // Check if any dates are in the past
        const today = formatDate(new Date());
        const pastDates = leave.dates.filter(d => d < today);
        if (pastDates.length > 0) {
            return res.status(400).json({
                message: "Cannot approve leave for past dates",
                pastDates: pastDates
            });
        }

        leave.status = "approved";
        leave.reviewedBy = reviewerId;
        leave.reviewedAt = new Date();

        if (remark !== undefined) {
            leave.remark = remark;
        }

        await leave.save();

        // Update attendance for all approved dates if exists
        const updatePromises = leave.dates.map(async (date) => {
            const attendance = await Attendance.findOne({
                school: schoolId,
                classId: leave.classId,
                sectionId: leave.sectionId,
                date: date,
            });

            if (attendance) {
                const student = attendance.students.find(
                    (s) => String(s.studentId) === String(leave.studentId)
                );

                if (student) {
                    student.status = "leave";
                    student.hasApprovedLeave = true;
                    await attendance.save();
                }
            }
        });

        await Promise.all(updatePromises);

        await sendStudentLeaveNotification({
            leave: leave,
            actor: req.user,
            action: 'approve'
        });

        return res.status(200).json({
            message: "Leave approved successfully",
            leave: {
                _id: leave._id,
                dates: leave.dates,
                subject: leave.subject,
                reason: leave.reason,
                status: leave.status,
                reviewedAt: leave.reviewedAt,
                remark: leave.remark
            }
        });
    } catch (err) {
        console.error("approveLeave error:", err);
        return res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
};

// Reject leave (teacher).
const rejectLeave = async (req, res) => {
    try {
        const reviewerId = req.user._id;
        const reviewerRole = req.user.role;
        const school = req.user.school;
        const { id } = req.params;
        const { remark } = req.body;

        const leave = await Leave.findById(id);

        if (!leave) {
            return res.status(404).json({ message: "Leave not found" });
        }

        if (String(leave.school) !== String(school)) {
            return res.status(403).json({ message: "Access denied" });
        }

        if (reviewerRole === 'teacher') {
            const teacherCheck = await validateTeacherClassSection(reviewerId, school);
            if (!teacherCheck.valid) {
                return res.status(403).json({
                    message: "You are not authorized to reject leaves"
                });
            }

            if (String(leave.classId) !== String(teacherCheck.classId) ||
                String(leave.sectionId) !== String(teacherCheck.sectionId)) {
                return res.status(403).json({
                    message: "You can only reject leaves from your assigned class/section"
                });
            }
        }

        if (leave.status === "rejected") {
            return res.status(400).json({ message: "Leave already rejected" });
        }

        if (leave.status === "cancelled") {
            return res.status(400).json({ message: "Cannot reject a cancelled leave" });
        }

        const today = formatDate(new Date());
        if (leave.date < today) {
            return res.status(400).json({ message: "Cannot reject leave for past date" });
        }

        leave.status = "rejected";
        leave.reviewedBy = reviewerId;
        leave.reviewedAt = new Date();

        if (remark !== undefined) {
            leave.remark = remark;
        }

        await leave.save();

        await sendStudentLeaveNotification({
            leave: leave,
            actor: req.user,
            action: 'reject'
        });

        return res.status(200).json({
            message: "Leave rejected successfully",
            leave: {
                _id: leave._id,
                date: leave.date,
                status: leave.status,
                reviewedAt: leave.reviewedAt,
                remark: leave.remark
            }
        });
    } catch (err) {
        console.error("rejectLeave error:", err);
        return res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
};

// Admin/teacher can get leaves for a specific student
const getLeavesByStudent = async (req, res) => {
    try {
        const school = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;
        const { studentId } = req.params;
        const { page = 1, limit = 20, status, startDate, endDate } = req.query;


        if (userRole === 'student' && String(studentId) !== String(userId)) {
            return res.status(403).json({
                message: "You can only view your own leaves"
            });
        }

        if (userRole === 'teacher') {

            const teacherCheck = await validateTeacherClassSection(userId, school);

            if (!teacherCheck.valid) {
                return res.status(403).json({
                    message: teacherCheck.message
                });
            }

            const student = await User.findOne({
                _id: studentId,
                school,
                role: 'student'
            }).select('name email rollNumber fatherName phone classInfo sectionInfo verified').lean();

            console.log("DEBUG - Student found:", student);

            if (!student) {
                return res.status(404).json({
                    message: "Student not found"
                });
            }

            if (!student.verified) {
                return res.status(403).json({
                    message: "Student account is not verified"
                });
            }

            const studentClassId = student.classInfo?.id ? String(student.classInfo.id) : null;
            const studentSectionId = student.sectionInfo?.id ? String(student.sectionInfo.id) : null;
            const teacherClassId = teacherCheck.classId ? String(teacherCheck.classId) : null;
            const teacherSectionId = teacherCheck.sectionId ? String(teacherCheck.sectionId) : null;


            if (!student.classInfo || !student.sectionInfo) {
                return res.status(403).json({
                    message: "Student is not assigned to any class or section"
                });
            }

            if (studentClassId !== teacherClassId) {
                return res.status(403).json({
                    message: `Student is not in your class. Student's class: ${studentClassId}, Your class: ${teacherClassId}`
                });
            }

            if (studentSectionId !== teacherSectionId) {
                return res.status(403).json({
                    message: `Student is not in your section. Student's section: ${studentSectionId}, Your section: ${teacherSectionId}`
                });
            }
        }

        const skip = (page - 1) * limit;

        const filter = { school, studentId };

        if (status) {
            filter.status = status;
        }

        if (startDate && endDate) {
            try {
                const formattedStartDate = formatDate(startDate);
                const formattedEndDate = formatDate(endDate);

                filter.dates = {
                    $elemMatch: {
                        $gte: formattedStartDate,
                        $lte: formattedEndDate
                    }
                };
            } catch (error) {
                return res.status(400).json({
                    message: "Invalid date range format",
                    error: error.message
                });
            }
        }

        const total = await Leave.countDocuments(filter);

        const studentInfo = await User.findOne({
            _id: studentId,
            school,
            role: 'student'
        }).select('name email rollNumber fatherName phone classInfo sectionInfo').lean();

        if (!studentInfo) {
            return res.status(404).json({
                message: "Student not found"
            });
        }

        // Get leaves with populated data
        const leaves = await Leave.find(filter)
            .populate("classId", "class")
            .populate("sectionId", "name")
            .populate("reviewedBy", "name email")
            .sort({ appliedAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Format student information
        const formattedStudent = {
            _id: studentInfo._id,
            name: studentInfo.name,
            email: studentInfo.email,
            rollNumber: studentInfo.rollNumber,
            fatherName: studentInfo.fatherName,
            phone: studentInfo.phone,
        };

        // Format leaves response
        const formattedLeaves = leaves.map(leave => ({
            _id: leave._id,
            dates: leave.dates || [],
            subject: leave.subject,
            reason: leave.reason,
            status: leave.status,
            appliedAt: leave.appliedAt,
            reviewedBy: leave.reviewedBy ? {
                _id: leave.reviewedBy._id,
                name: leave.reviewedBy.name,
                email: leave.reviewedBy.email
            } : null,
            reviewedAt: leave.reviewedAt,
            remark: leave.remark,
            class: leave.classId ? {
                _id: leave.classId._id,
                name: leave.classId.class
            } : null,
            section: leave.sectionId ? {
                _id: leave.sectionId._id,
                name: leave.sectionId.name
            } : null
        }));

        return res.status(200).json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit),
            student: formattedStudent,
            leaves: formattedLeaves
        });

    } catch (err) {
        console.error("getLeavesByStudent error:", err);
        return res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
};


// TEACHER APPLY LEAVE 
const applyTeacherLeave = async (req, res) => {
    try {
        const school = req.user.school;
        const teacherId = req.user._id;
        const teacherName = req.user.name;
        const { dates, subject, reason } = req.body;

        console.log("DEBUG - Teacher leave application:", {
            teacherId,
            teacherName,
            dates,
            subject,
            reason
        });

        // Format and validate all dates
        const formattedDates = [];
        const validationErrors = [];

        for (const date of dates) {
            try {
                const formattedDate = formatDate(date);

                // Check for past dates
                const today = formatDate(new Date());
                if (formattedDate < today) {
                    validationErrors.push({
                        date: date,
                        error: `Cannot apply leave for past date: ${formattedDate}`
                    });
                    continue;
                }

                formattedDates.push(formattedDate);
            } catch (error) {
                validationErrors.push({
                    date: date,
                    error: `Invalid date format: ${error.message}`
                });
            }
        }

        // Return validation errors if any
        if (validationErrors.length > 0) {
            return res.status(400).json({
                message: "Some dates have validation errors",
                errors: validationErrors,
                validDatesCount: formattedDates.length
            });
        }

        if (formattedDates.length === 0) {
            return res.status(400).json({
                message: "No valid dates provided for leave application"
            });
        }

        // Check for duplicate dates in the request
        const uniqueDates = [...new Set(formattedDates)];
        if (uniqueDates.length !== formattedDates.length) {
            return res.status(400).json({
                message: "Duplicate dates found in request",
                duplicates: formattedDates.filter((date, index) => formattedDates.indexOf(date) !== index)
            });
        }

        // Check for existing leaves that overlap with any of the requested dates
        const existingLeaves = await Leave.find({
            school,
            teacherId,
            userType: "teacher",
            dates: { $in: formattedDates },
            status: { $in: ["pending", "approved"] }
        }).select('dates status').lean();

        if (existingLeaves.length > 0) {
            // Find overlapping dates
            const allExistingDates = existingLeaves.flatMap(leave => leave.dates);
            const overlappingDates = formattedDates.filter(date => allExistingDates.includes(date));

            if (overlappingDates.length > 0) {
                return res.status(409).json({
                    message: "Leave already applied for some dates",
                    overlappingDates: overlappingDates.map(date => ({
                        date,
                        existingStatus: existingLeaves.find(l => l.dates.includes(date))?.status
                    })),
                    availableDates: formattedDates.filter(date => !overlappingDates.includes(date))
                });
            }
        }

        // Create single leave object with all dates
        const leaveData = {
            school,
            userType: "teacher",
            teacherId,
            teacherName,
            dates: formattedDates,
            subject,
            reason,
            status: "pending",
            appliedAt: new Date()
        };

        const createdLeave = await Leave.create(leaveData);

        // Send notification
        await sendTeacherLeaveNotification({
            leave: createdLeave,
            actor: req.user,
            action: 'create'
        });

        res.status(201).json({
            success: true,
            message: `Teacher leave applied successfully for ${createdLeave.dates.length} date(s)`,
            leave: {
                _id: createdLeave._id,
                dates: createdLeave.dates,
                subject: createdLeave.subject,
                reason: createdLeave.reason,
                status: createdLeave.status,
                appliedAt: createdLeave.appliedAt
            }
        });
    } catch (err) {
        console.error("applyTeacherLeave error:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// TEACHER VIEW OWN LEAVES
const getTeacherLeaves = async (req, res) => {
    try {
        const user = req.user;

        const schoolId = user.school;
        const teacherId = user._id;

        const { page = 1, limit = 20, status, startDate, endDate } = req.query;
        const skip = (page - 1) * limit;

        const filter = {
            school: schoolId,
            teacherId,
            userType: "teacher"
        };

        if (status) filter.status = status;

        if (startDate && endDate) {
            const formattedStartDate = formatDate(startDate);
            const formattedEndDate = formatDate(endDate);

            filter.dates = {
                $elemMatch: {
                    $gte: formattedStartDate,
                    $lte: formattedEndDate
                }
            };
        }

        const total = await Leave.countDocuments(filter);

        const leaves = await Leave.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        const reviewerIds = leaves
            .filter(l => l.reviewedBy)
            .map(l => l.reviewedBy.toString());

        const users = await User.find({ _id: { $in: reviewerIds } })
            .select("name email role")
            .lean();

        const schools = await School.find({ _id: { $in: reviewerIds } })
            .select("name email")
            .lean();

        const userMap = Object.fromEntries(
            users.map(u => [u._id.toString(), u])
        );

        const schoolMap = Object.fromEntries(
            schools.map(s => [s._id.toString(), s])
        );

        const formattedLeaves = leaves.map(leave => {
            let reviewer = null;

            if (leave.reviewedBy) {
                reviewer =
                    userMap[leave.reviewedBy.toString()] ||
                    schoolMap[leave.reviewedBy.toString()] ||
                    null;
            }

            return {
                _id: leave._id,
                date: leave.dates || [],
                subject: leave.subject,
                reason: leave.reason,
                status: leave.status,
                appliedAt: leave.appliedAt,
                reviewedAt: leave.reviewedAt,
                remark: leave.remark,
                reviewedBy: reviewer
                    ? {
                        _id: reviewer._id,
                        name: reviewer.name,
                        email: reviewer.email,
                        role: reviewer.role || "school"
                    }
                    : null
            };
        });


        return res.status(200).json({
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / limit),
            leaves: formattedLeaves
        });

    } catch (err) {
        console.error("getTeacherLeaves error:", err);
        return res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
};

// TEACHER CAN UPDATE OWN PENDING FUTURE LEAVE
const updateTeacherLeave = async (req, res) => {
    try {
        const school = req.user.school;
        const teacherId = req.user._id;
        const { id } = req.params;
        const { subject, reason } = req.body;

        if (!subject && !reason) {
            return res.status(400).json({
                message: "At least one field (subject or reason) is required to update"
            });
        }

        const leave = await Leave.findById(id);

        if (!leave) {
            return res.status(404).json({ message: "Leave not found" });
        }

        if (leave.userType !== "teacher") {
            return res.status(400).json({ message: "Not a teacher leave record" });
        }

        if (String(leave.teacherId) !== String(teacherId)) {
            return res.status(403).json({ message: "You can only update your own leave" });
        }

        if (String(leave.school) !== String(school)) {
            return res.status(403).json({ message: "Access denied" });
        }

        if (leave.status !== "pending") {
            return res.status(400).json({ message: "Only pending leaves can be updated" });
        }

        const today = formatDate(new Date());
        if (leave.date < today) {
            return res.status(400).json({ message: "Cannot update past leave" });
        }

        if (subject !== undefined) leave.subject = subject;
        if (reason !== undefined) leave.reason = reason;

        await leave.save();

        await sendTeacherLeaveNotification({
            leave: leave,
            actor: req.user,
            action: 'update'
        });

        res.status(200).json({
            message: "Leave updated successfully",
            leave: {
                _id: leave._id,
                date: leave.date,
                subject: leave.subject,
                reason: leave.reason,
                status: leave.status
            }
        });
    } catch (err) {
        console.error("updateTeacherLeave error:", err);
        res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
};

// TEACHER CANCEL LEAVE
const cancelTeacherLeave = async (req, res) => {
    try {
        const school = req.user.school;
        const teacherId = req.user._id;
        const { id } = req.params;

        const leave = await Leave.findById(id);

        if (!leave) {
            return res.status(404).json({ message: "Leave not found" });
        }

        if (leave.userType !== "teacher") {
            return res.status(400).json({ message: "Not a teacher leave record" });
        }

        if (String(leave.teacherId) !== String(teacherId)) {
            return res.status(403).json({ message: "You can only cancel your own leave" });
        }

        if (String(leave.school) !== String(school)) {
            return res.status(403).json({ message: "Access denied" });
        }

        if (leave.status === "cancelled") {
            return res.status(400).json({ message: "Leave already cancelled" });
        }

        if (leave.status === "approved") {
            return res.status(400).json({ message: "Cannot cancel an approved leave" });
        }

        if (leave.status === "rejected") {
            return res.status(400).json({ message: "Cannot cancel a rejected leave" });
        }

        const today = formatDate(new Date());
        if (leave.date < today) {
            return res.status(400).json({ message: "Cannot cancel leave for past date" });
        }

        leave.status = "cancelled";
        leave.reviewedAt = new Date();

        await leave.save();

        await sendTeacherLeaveNotification({
            leave: leave,
            actor: req.user,
            action: 'update'
        });

        res.status(200).json({
            message: "Leave cancelled successfully",
            leave: {
                _id: leave._id,
                date: leave.date,
                status: leave.status,
                cancelledAt: leave.reviewedAt
            }
        });
    } catch (err) {
        console.error("cancelTeacherLeave error:", err);
        res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
};

// ADMIN APPROVE TEACHER LEAVE
const approveTeacherLeave = async (req, res) => {
    try {
        const user = req.user;

        const reviewerId = user._id;
        const role = user.role || 'school';
        const isTeacher = role === 'teacher';
        const isAdminOffice = role === 'admin_office';
        const isSchool = role === 'school';

        if (isTeacher) {
            return res.status(403).json({
                message: "Teachers are not allowed to approve teacher leaves"
            });
        }

        const schoolId = isSchool ? user._id : user.school;
        const { id } = req.params;

        const leave = await Leave.findById(id);

        if (!leave) {
            return res.status(404).json({ message: "Leave not found" });
        }

        if (leave.userType !== "teacher") {
            return res.status(400).json({
                message: "This is not a teacher leave record"
            });
        }

        if (String(leave.school) !== String(schoolId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        if (leave.status === "approved") {
            return res.status(400).json({ message: "Leave already approved" });
        }

        if (leave.status === "cancelled") {
            return res.status(400).json({ message: "Cannot approve cancelled leave" });
        }

        if (leave.status === "rejected") {
            return res.status(400).json({ message: "Cannot approve rejected leave" });
        }

        const today = formatDate(new Date());
        if (leave.date < today) {
            return res.status(400).json({
                message: "Cannot approve leave for past date"
            });
        }

        leave.status = "approved";
        leave.reviewedAt = new Date();
        leave.reviewedBy = reviewerId;

        await leave.save();

        await sendTeacherLeaveNotification({
            leave: leave,
            actor: req.user,
            action: 'approve'
        });

        return res.status(200).json({
            message: "Teacher leave approved successfully",
            leave: {
                _id: leave._id,
                date: leave.date,
                status: leave.status,
                reviewedAt: leave.reviewedAt
            }
        });

    } catch (err) {
        console.error("approveTeacherLeave error:", err);
        return res.status(500).json({
            message: "Server error",
            error: err.message
        });
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

        if (!leave) {
            return res.status(404).json({ message: "Leave not found" });
        }

        if (leave.userType !== "teacher") {
            return res.status(400).json({ message: "Not a teacher leave record" });
        }

        if (String(leave.school) !== String(school)) {
            return res.status(403).json({ message: "Access denied" });
        }

        if (leave.status === "rejected") {
            return res.status(400).json({ message: "Leave already rejected" });
        }

        if (leave.status === "cancelled") {
            return res.status(400).json({ message: "Cannot reject cancelled leave" });
        }

        if (leave.status === "approved") {
            return res.status(400).json({ message: "Cannot reject approved leave" });
        }

        const today = formatDate(new Date());
        if (leave.date < today) {
            return res.status(400).json({ message: "Cannot reject leave for past date" });
        }

        leave.status = "rejected";
        leave.reviewedBy = reviewer;
        leave.reviewedAt = new Date();

        if (remark !== undefined) {
            leave.remark = remark;
        }

        await leave.save();

        await sendTeacherLeaveNotification({
            leave: leave,
            actor: req.user,
            action: 'reject'
        });

        res.status(200).json({
            message: "Teacher leave rejected successfully",
            leave: {
                _id: leave._id,
                date: leave.date,
                status: leave.status,
                reviewedAt: leave.reviewedAt,
                remark: leave.remark
            }
        });
    } catch (err) {
        console.error("adminRejectTeacherLeave error:", err);
        res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
};

module.exports = {
    applyLeave,
    updateLeave,
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