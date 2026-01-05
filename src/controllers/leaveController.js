// controllers/leaveController.js
const mongoose = require("mongoose");
const Leave = require("../models/Leave");
const AttendanceImported = require("../models/Attendance");
const User = require("../models/User");
const ClassSection = require("../models/ClassSection");
const Attendance = AttendanceImported.default || AttendanceImported;

// Date formatter
const formatDate = (date) => {
    if (!date) return null;

    // If already in YYYY-MM-DD format, return as is
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }

    // If ISO string or date object
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

        console.log("DEBUG - Original dates from request:", dates);

        // Validate student enrollment
        const enrollmentCheck = await validateStudentClassSection(studentId, classId, sectionId, school);
        if (!enrollmentCheck.valid) {
            return res.status(403).json({
                message: enrollmentCheck.message
            });
        }

        // Format and deduplicate dates
        const formattedDates = [];
        const dateSet = new Set(); // To track duplicates

        for (const date of dates) {
            try {
                const formattedDate = formatDate(date);

                // Check for duplicates
                if (dateSet.has(formattedDate)) {
                    return res.status(400).json({
                        message: `Duplicate date found: ${formattedDate}`,
                        duplicateDate: formattedDate
                    });
                }

                dateSet.add(formattedDate);
                formattedDates.push(formattedDate);
            } catch (error) {
                return res.status(400).json({
                    message: "Invalid date format",
                    error: error.message,
                    invalidDate: date
                });
            }
        }

        console.log("DEBUG - Formatted unique dates:", formattedDates);

        // Prevent applying for past dates
        const today = formatDate(new Date());
        const pastDates = formattedDates.filter(d => d < today);
        if (pastDates.length > 0) {
            return res.status(400).json({
                message: "Cannot apply leave for past dates",
                pastDates
            });
        }

        // Check for existing leaves
        const existing = await Leave.find({
            school,
            studentId,
            date: { $in: formattedDates },
            status: { $in: ["pending", "approved"] }
        }).select('date').lean();

        if (existing.length > 0) {
            const conflictDates = existing.map(e => e.date);
            return res.status(409).json({
                message: "Leave already applied for some dates",
                conflictDates
            });
        }

        // Create leave documents
        const leaveDocs = formattedDates.map(date => ({
            school,
            studentId,
            studentName,
            classId,
            sectionId,
            date,
            subject,
            reason,
            status: "pending",
            appliedAt: new Date()
        }));

        console.log("DEBUG - Creating leaves for dates:", formattedDates);

        const createdLeaves = await Leave.insertMany(leaveDocs);

        return res.status(201).json({
            message: "Leave applied successfully",
            total: createdLeaves.length,
            leaves: createdLeaves.map(leave => ({
                _id: leave._id,
                date: leave.date,
                subject: leave.subject,
                reason: leave.reason,
                status: leave.status,
                appliedAt: leave.appliedAt
            }))
        });

    } catch (err) {
        console.error("applyLeave error:", err);
        return res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
};

// Student can cancel their leave (if pending or approved).
const cancelLeave = async (req, res) => {
    try {
        const school = req.user.school;
        const studentId = req.user._id;
        const { id } = req.params;

        // Find the leave
        const leave = await Leave.findById(id);
        if (!leave) {
            return res.status(404).json({ message: "Leave not found" });
        }

        // Check school access
        if (String(leave.school) !== String(school)) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Check if student owns this leave
        if (String(leave.studentId) !== String(studentId)) {
            return res.status(403).json({ message: "You can only cancel your own leave" });
        }

        // Validate student enrollment (in case class/section changed)
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

        // Check leave status
        if (leave.status === "cancelled") {
            return res.status(400).json({ message: "Leave already cancelled" });
        }

        if (leave.status === "rejected") {
            return res.status(400).json({ message: "Cannot cancel a rejected leave" });
        }

        // Check if it's a past date
        const today = formatDate(new Date());
        if (leave.date < today) {
            return res.status(400).json({ message: "Cannot cancel leave for past date" });
        }

        // Update leave status
        leave.status = "cancelled";
        leave.reviewedAt = new Date();
        await leave.save();

        // If leave was approved, update attendance status
        if (leave.status === "approved") {
            const attendance = await Attendance.findOne({
                school,
                classId: leave.classId,
                sectionId: leave.sectionId,
                date: leave.date,
            });

            if (attendance) {
                const student = attendance.students.find(
                    (s) => String(s.studentId) === String(leave.studentId)
                );

                if (student && student.status === "leave") {
                    // Change status back to present (or as per your policy)
                    student.status = "present";
                    await attendance.save();
                }
            }
        }

        return res.status(200).json({
            message: "Leave cancelled successfully",
            leave: {
                _id: leave._id,
                date: leave.date,
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
        const school = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;
        const { classId, sectionId, status, studentId, date, startDate, endDate, page = 1, limit = 10 } = req.query;

        // For teachers, they can only see leaves from their assigned class/section
        let teacherClassId = classId;
        let teacherSectionId = sectionId;

        if (userRole === 'teacher') {
            const teacherCheck = await validateTeacherClassSection(userId, school);
            if (!teacherCheck.valid) {
                return res.status(403).json({
                    message: "You are not assigned as an incharge teacher"
                });
            }

            // Teachers can only filter by their own class/section
            if (classId && String(classId) !== String(teacherCheck.classId)) {
                return res.status(403).json({
                    message: "You can only view leaves from your assigned class"
                });
            }

            if (sectionId && String(sectionId) !== String(teacherCheck.sectionId)) {
                return res.status(403).json({
                    message: "You can only view leaves from your assigned section"
                });
            }

            teacherClassId = teacherCheck.classId;
            teacherSectionId = teacherCheck.sectionId;
        }

        const skip = (page - 1) * limit;

        // Build filter
        const filter = { school };

        if (teacherClassId) filter.classId = teacherClassId;
        if (teacherSectionId) filter.sectionId = teacherSectionId;
        if (status) filter.status = status;
        if (studentId) filter.studentId = studentId;

        if (date) {
            try {
                filter.date = formatDate(date);
            } catch (error) {
                return res.status(400).json({
                    message: "Invalid date format",
                    error: error.message
                });
            }
        } else if (startDate && endDate) {
            try {
                filter.date = {
                    $gte: formatDate(startDate),
                    $lte: formatDate(endDate)
                };
            } catch (error) {
                return res.status(400).json({
                    message: "Invalid date range format",
                    error: error.message
                });
            }
        }

        // Count total results
        const total = await Leave.countDocuments(filter);

        // Fetch paginated results with population
        const leaves = await Leave.find(filter)
            .populate("studentId", "name email rollNumber")
            .populate("classId", "class sections")
            .populate("reviewedBy", "name email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        console.log("DEBUG - Raw leaves data:", JSON.stringify(leaves, null, 2));

        // Format response with proper section name extraction
        const formattedLeaves = leaves.map(leave => {
            let sectionInfo = null;
            
            // Extract section name from classSections array
            if (leave.classId && leave.classId.sections && leave.sectionId) {
                const section = leave.classId.sections.find(
                    sec => String(sec._id) === String(leave.sectionId)
                );
                
                if (section) {
                    sectionInfo = {
                        _id: section._id,
                        name: section.name
                    };
                }
            }

            return {
                _id: leave._id,
                student: leave.studentId ? {
                    _id: leave.studentId._id,
                    name: leave.studentId.name,
                    email: leave.studentId.email,
                    rollNumber: leave.studentId.rollNumber
                } : null,
                class: leave.classId ? {
                    _id: leave.classId._id,
                    name: leave.classId.class
                } : null,
                section: sectionInfo,
                date: leave.date,
                subject: leave.subject,
                reason: leave.reason,
                status: leave.status,
                appliedAt: leave.appliedAt,
                reviewedAt: leave.reviewedAt,
                remark: leave.remark
            };
        });

        return res.status(200).json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
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
        const reviewerId = req.user._id;
        const reviewerRole = req.user.role;
        const school = req.user.school;
        const { id } = req.params;
        const { remark } = req.body;

        // Find the leave
        const leave = await Leave.findById(id);
        if (!leave) {
            return res.status(404).json({ message: "Leave not found" });
        }

        // Check school access
        if (String(leave.school) !== String(school)) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Check if user has permission to approve this leave
        if (reviewerRole === 'teacher') {
            const teacherCheck = await validateTeacherClassSection(reviewerId, school);
            if (!teacherCheck.valid) {
                return res.status(403).json({
                    message: "You are not authorized to approve leaves"
                });
            }

            // Teacher can only approve leaves from their assigned class/section
            if (String(leave.classId) !== String(teacherCheck.classId) ||
                String(leave.sectionId) !== String(teacherCheck.sectionId)) {
                return res.status(403).json({
                    message: "You can only approve leaves from your assigned class/section"
                });
            }
        }

        // Check leave status
        if (leave.status === "approved") {
            return res.status(400).json({ message: "Leave already approved" });
        }

        if (leave.status === "cancelled") {
            return res.status(400).json({ message: "Cannot approve a cancelled leave" });
        }

        if (leave.status === "rejected") {
            return res.status(400).json({ message: "Cannot approve a rejected leave" });
        }

        // Check if it's a past date
        const today = formatDate(new Date());
        if (leave.date < today) {
            return res.status(400).json({ message: "Cannot approve leave for past date" });
        }

        // Update leave
        leave.status = "approved";
        leave.reviewedBy = reviewerId;
        leave.reviewedAt = new Date();

        if (remark !== undefined) {
            leave.remark = remark;
        }

        await leave.save();

        // Update attendance if exists for that date/class/section
        const attendance = await Attendance.findOne({
            school,
            classId: leave.classId,
            sectionId: leave.sectionId,
            date: leave.date,
        });

        if (attendance) {
            const student = attendance.students.find(
                (s) => String(s.studentId) === String(leave.studentId)
            );

            if (student) {
                student.status = "leave";
                await attendance.save();
            }
        }

        return res.status(200).json({
            message: "Leave approved successfully",
            leave: {
                _id: leave._id,
                date: leave.date,
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

        // Check if user has permission to reject this leave
        if (reviewerRole === 'teacher') {
            const teacherCheck = await validateTeacherClassSection(reviewerId, school);
            if (!teacherCheck.valid) {
                return res.status(403).json({
                    message: "You are not authorized to reject leaves"
                });
            }

            // Teacher can only reject leaves from their assigned class/section
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

        // Check if it's a past date
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

        // Do not change attendance (teacher may update attendance separately)
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

        console.log("DEBUG - getLeavesByStudent called:", {
            userId,
            userRole,
            school,
            studentId
        });

        // If user is a student, they can only view their own leaves
        if (userRole === 'student' && String(studentId) !== String(userId)) {
            return res.status(403).json({
                message: "You can only view your own leaves"
            });
        }

        // If user is a teacher, check if the student belongs to their class/section
        if (userRole === 'teacher') {
            console.log("DEBUG - User is a teacher, validating...");

            // Get teacher's assigned class/section
            const teacherCheck = await validateTeacherClassSection(userId, school);
            console.log("DEBUG - Teacher check result:", teacherCheck);

            if (!teacherCheck.valid) {
                return res.status(403).json({
                    message: teacherCheck.message
                });
            }

            // Check if student belongs to teacher's class/section
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

            // Check if student is verified
            if (!student.verified) {
                return res.status(403).json({
                    message: "Student account is not verified"
                });
            }

            // Check if student belongs to teacher's class/section
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

        // Build filter
        const filter = { school, studentId };

        if (status) {
            filter.status = status;
        }

        if (startDate && endDate) {
            try {
                filter.date = {
                    $gte: formatDate(startDate),
                    $lte: formatDate(endDate)
                };
            } catch (error) {
                return res.status(400).json({
                    message: "Invalid date range format",
                    error: error.message
                });
            }
        }

        // Count total leaves
        const total = await Leave.countDocuments(filter);

        // First, get student information
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
            .sort({ date: -1 })
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
            date: leave.date,
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

        // Validate teacher assignment
        const teacherCheck = await validateTeacherClassSection(teacherId, school);
        if (!teacherCheck.valid) {
            return res.status(403).json({
                message: teacherCheck.message
            });
        }

        // Validate dates and format them
        const formattedDates = [];
        for (const date of dates) {
            try {
                formattedDates.push(formatDate(date));
            } catch (error) {
                return res.status(400).json({
                    message: "Invalid date format",
                    error: error.message
                });
            }
        }

        // Check for past dates
        const today = formatDate(new Date());
        const pastDates = formattedDates.filter(d => d < today);

        if (pastDates.length > 0) {
            return res.status(400).json({
                message: "Cannot apply leave for past dates",
                pastDates
            });
        }

        // Check for existing leaves
        const existing = await Leave.find({
            school,
            teacherId,
            date: { $in: formattedDates },
            status: { $in: ["pending", "approved"] },
        });

        if (existing.length > 0) {
            return res.status(409).json({
                message: "Leave already applied for some dates",
                conflictDates: existing.map(e => e.date),
            });
        }

        // Create leave documents
        const newLeaves = formattedDates.map(date => ({
            school,
            userType: "teacher",
            teacherId,
            teacherName,
            classId: teacherCheck.classId,
            sectionId: teacherCheck.sectionId,
            date,
            subject,
            reason,
            status: "pending",
            appliedAt: new Date()
        }));

        const created = await Leave.insertMany(newLeaves);

        res.status(201).json({
            message: "Teacher leave applied successfully",
            leaves: created.map(leave => ({
                _id: leave._id,
                date: leave.date,
                subject: leave.subject,
                reason: leave.reason,
                status: leave.status,
                appliedAt: leave.appliedAt
            }))
        });
    } catch (err) {
        console.error("applyTeacherLeave error:", err);
        res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
};

// TEACHER VIEW OWN LEAVES
const getTeacherLeaves = async (req, res) => {
    try {
        const school = req.user.school;
        const teacherId = req.user._id;
        const { page = 1, limit = 20, status, startDate, endDate } = req.query;

        const skip = (page - 1) * limit;

        // Build filter
        const filter = {
            school,
            teacherId,
            userType: "teacher",
        };

        if (status) {
            filter.status = status;
        }

        if (startDate && endDate) {
            try {
                filter.date = {
                    $gte: formatDate(startDate),
                    $lte: formatDate(endDate)
                };
            } catch (error) {
                return res.status(400).json({
                    message: "Invalid date range format",
                    error: error.message
                });
            }
        }

        // Total leave count
        const total = await Leave.countDocuments(filter);

        const leaves = await Leave.find(filter)
            .populate("reviewedBy", "name email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Format response
        const formattedLeaves = leaves.map(leave => ({
            _id: leave._id,
            date: leave.date,
            subject: leave.subject,
            reason: leave.reason,
            status: leave.status,
            appliedAt: leave.appliedAt,
            reviewedAt: leave.reviewedAt,
            remark: leave.remark
        }));

        res.status(200).json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit),
            leaves: formattedLeaves,
        });

    } catch (err) {
        console.error("getTeacherLeaves error:", err);
        res.status(500).json({
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

        // Validate that at least one field is provided
        if (!subject && !reason) {
            return res.status(400).json({
                message: "At least one field (subject or reason) is required to update"
            });
        }

        const leave = await Leave.findById(id);

        if (!leave) {
            return res.status(404).json({ message: "Leave not found" });
        }

        // Validate leave ownership
        if (leave.userType !== "teacher") {
            return res.status(400).json({ message: "Not a teacher leave record" });
        }

        if (String(leave.teacherId) !== String(teacherId)) {
            return res.status(403).json({ message: "You can only update your own leave" });
        }

        // Check school access
        if (String(leave.school) !== String(school)) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Check leave status
        if (leave.status !== "pending") {
            return res.status(400).json({ message: "Only pending leaves can be updated" });
        }

        // Check if it's a future date
        const today = formatDate(new Date());
        if (leave.date < today) {
            return res.status(400).json({ message: "Cannot update past leave" });
        }

        // Update fields
        if (subject !== undefined) leave.subject = subject;
        if (reason !== undefined) leave.reason = reason;

        await leave.save();

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

        // Validate leave ownership
        if (leave.userType !== "teacher") {
            return res.status(400).json({ message: "Not a teacher leave record" });
        }

        if (String(leave.teacherId) !== String(teacherId)) {
            return res.status(403).json({ message: "You can only cancel your own leave" });
        }

        // Check school access
        if (String(leave.school) !== String(school)) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Check leave status
        if (leave.status === "cancelled") {
            return res.status(400).json({ message: "Leave already cancelled" });
        }

        if (leave.status === "rejected") {
            return res.status(400).json({ message: "Cannot cancel a rejected leave" });
        }

        // Check if it's a past date
        const today = formatDate(new Date());
        if (leave.date < today) {
            return res.status(400).json({ message: "Cannot cancel leave for past date" });
        }

        leave.status = "cancelled";
        leave.reviewedAt = new Date();

        await leave.save();

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
        const school = req.user.school;
        const reviewer = req.user._id;
        const { id } = req.params;

        const leave = await Leave.findById(id);

        if (!leave) {
            return res.status(404).json({ message: "Leave not found" });
        }

        // Validate leave type
        if (leave.userType !== "teacher") {
            return res.status(400).json({ message: "Not a teacher leave record" });
        }

        // Check school access
        if (String(leave.school) !== String(school)) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Check leave status
        if (leave.status === "approved") {
            return res.status(400).json({ message: "Leave already approved" });
        }

        if (leave.status === "cancelled") {
            return res.status(400).json({ message: "Cannot approve cancelled leave" });
        }

        if (leave.status === "rejected") {
            return res.status(400).json({ message: "Cannot approve rejected leave" });
        }

        // Check if it's a past date
        const today = formatDate(new Date());
        if (leave.date < today) {
            return res.status(400).json({ message: "Cannot approve leave for past date" });
        }

        leave.status = "approved";
        leave.reviewedAt = new Date();
        leave.reviewedBy = reviewer;

        await leave.save();

        res.status(200).json({
            message: "Teacher leave approved successfully",
            leave: {
                _id: leave._id,
                date: leave.date,
                status: leave.status,
                reviewedAt: leave.reviewedAt
            }
        });
    } catch (err) {
        console.error("adminApproveTeacherLeave error:", err);
        res.status(500).json({
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

        // Validate leave type
        if (leave.userType !== "teacher") {
            return res.status(400).json({ message: "Not a teacher leave record" });
        }

        // Check school access
        if (String(leave.school) !== String(school)) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Check leave status
        if (leave.status === "rejected") {
            return res.status(400).json({ message: "Leave already rejected" });
        }

        if (leave.status === "cancelled") {
            return res.status(400).json({ message: "Cannot reject cancelled leave" });
        }

        if (leave.status === "approved") {
            return res.status(400).json({ message: "Cannot reject approved leave" });
        }

        // Check if it's a past date
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