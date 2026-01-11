const mongoose = require("mongoose");
const AttendanceImported = require("../models/Attendance");
const UserImported = require("../models/User");
const ClassSectionImported = require("../models/ClassSection");
const Leave = require("../models/Leave");

const Attendance = AttendanceImported.default || AttendanceImported;
const User = UserImported.default || UserImported;
const ClassSection = ClassSectionImported.default || ClassSectionImported;

const formatDate = (date) => {
    if (!date) return null;
    
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }
    
    const d = new Date(date);
    if (isNaN(d.getTime())) {
        throw new Error("Invalid date");
    }
    
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

// Helper function to validate teacher assignment
const validateTeacherAssignment = async (teacherId, classId, sectionId, school) => {
    try {
        const teacher = await User.findOne({
            _id: teacherId,
            school,
            role: 'teacher',
        }).select('isIncharge classInfo sectionInfo').lean();

        if (!teacher) {
            return { valid: false, message: "Teacher not found" };
        }

        // Check if teacher is incharge
        if (!teacher.isIncharge) {
            return { valid: false, message: "Only incharge teachers can mark attendance" };
        }

        // Check if teacher is assigned to the specified class/section
        if (String(teacher.classInfo?.id) !== String(classId)) {
            return { valid: false, message: "Teacher is not assigned to this class" };
        }

        if (String(teacher.sectionInfo?.id) !== String(sectionId)) {
            return { valid: false, message: "Teacher is not assigned to this section" };
        }

        return { valid: true };
    } catch (error) {
        return { valid: false, message: "Error validating teacher assignment" };
    }
};

// Helper function to validate student enrollment
const validateStudentEnrollment = async (studentIds, classId, sectionId, school) => {
    try {
        const enrolledStudents = await User.find({
            _id: { $in: studentIds },
            school,
            role: 'student',
            // status: 'active',
            'classInfo.id': classId,
            'sectionInfo.id': sectionId
        }).select('_id').lean();

        const enrolledIds = new Set(enrolledStudents.map(s => String(s._id)));
        
        // Check for non-enrolled students
        const nonEnrolled = studentIds.filter(id => !enrolledIds.has(String(id)));
        
        if (nonEnrolled.length > 0) {
            return {
                valid: false,
                message: "Some students are not enrolled in this class/section",
                nonEnrolled
            };
        }

        return { valid: true };
    } catch (error) {
        return { valid: false, message: "Error validating student enrollment" };
    }
};

const markAttendance = async (req, res) => {
    try {
        const { classId, sectionId, students, date } = req.body;
        const teacherId = req.user._id;
        const school = req.user.school;

        // Validate class existence
        const classDoc = await ClassSection.findById(classId);
        if (!classDoc) {
            return res.status(404).json({ message: "Class not found" });
        }

        // Verify teacher is assigned to this class/section
        const teacherCheck = await validateTeacherAssignment(teacherId, classId, sectionId, school);
        if (!teacherCheck.valid) {
            return res.status(403).json({ 
                message: teacherCheck.message 
            });
        }

        // Format date
        let attendanceDate;
        try {
            attendanceDate = formatDate(date);
        } catch (error) {
            return res.status(400).json({
                message: "Invalid date format",
                error: error.message
            });
        }

        // Check if date is in the future
        const today = formatDate(new Date());
        if (attendanceDate > today) {
            return res.status(400).json({ 
                message: "Cannot mark attendance for future dates" 
            });
        }

        // Check if attendance already exists for this date
        const exists = await Attendance.findOne({
            school,
            classId,
            sectionId,
            date: attendanceDate
        });

        if (exists) {
            return res.status(409).json({ 
                message: "Attendance already marked for this date" 
            });
        }

        // Extract student IDs
        const studentIds = students.map(s => s.studentId);

        // Validate student enrollment
        const enrollmentCheck = await validateStudentEnrollment(studentIds, classId, sectionId, school);
        if (!enrollmentCheck.valid) {
            return res.status(400).json({
                message: enrollmentCheck.message,
                nonEnrolledStudents: enrollmentCheck.nonEnrolled
            });
        }

        // Fetch student details and approved leaves in parallel
        const [users, leaves] = await Promise.all([
            User.find({ 
                _id: { $in: studentIds },
                school 
            })
            .select("name email")
            .lean(),

            Leave.find({
                school,
                studentId: { $in: studentIds },
                date: attendanceDate,
                status: "approved"
            }).lean()
        ]);

        // Create maps for quick lookups
        const leaveSet = new Set(leaves.map(l => String(l.studentId)));
        const userMap = new Map(users.map(u => [String(u._id), u]));

        // Prepare final student records with automatic leave status
        const finalStudents = students.map(s => {
            const user = userMap.get(String(s.studentId));
            const hasApprovedLeave = leaveSet.has(String(s.studentId));
            
            return {
                studentId: s.studentId,
                name: user?.name || "Unknown",
                email: user?.email || "N/A",
                status: hasApprovedLeave ? "leave" : (s.status || "present")
            };
        });

        // Create attendance record
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
            attendance: {
                _id: attendance._id,
                date: attendance.date,
                classId: attendance.classId,
                sectionId: attendance.sectionId,
                teacherId: attendance.teacherId,
                totalStudents: finalStudents.length,
                present: finalStudents.filter(s => s.status === "present").length,
                absent: finalStudents.filter(s => s.status === "absent").length,
                leave: finalStudents.filter(s => s.status === "leave").length,
                students: finalStudents,
                createdAt: attendance.createdAt
            }
        });

    } catch (err) {
        console.error("markAttendance error:", err);
        return res.status(500).json({ 
            message: "Server error",
            error: err.message 
        });
    }
};

const updateAttendance = async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const { students } = req.body;
        const school = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;

        // Validate attendanceId
        if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
            return res.status(400).json({ message: "Invalid attendance ID" });
        }

        // Find attendance record
        const attendance = await Attendance.findById(attendanceId);
        if (!attendance) {
            return res.status(404).json({ message: "Attendance not found" });
        }

        // Check school access
        if (String(attendance.school) !== String(school)) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Check if user has permission to update
        if (userRole === 'teacher') {
            // Teacher can only update their own attendance records
            if (String(attendance.teacherId) !== String(userId)) {
                return res.status(403).json({ 
                    message: "You can only update attendance records you created" 
                });
            }

            // Check if attendance date is in the past (teachers can't update future attendance)
            const today = formatDate(new Date());
            if (attendance.date > today) {
                return res.status(400).json({ 
                    message: "Cannot update attendance for future dates" 
                });
            }
        }

        // Validate student IDs in request
        const studentIds = students.map(s => s.studentId);
        const uniqueIds = [...new Set(studentIds.map(id => String(id)))];
        
        if (studentIds.length !== uniqueIds.length) {
            return res.status(400).json({ 
                message: "Duplicate student IDs in request" 
            });
        }

        // Validate that all students belong to the same class/section as the attendance record
        const enrollmentCheck = await validateStudentEnrollment(
            studentIds, 
            attendance.classId, 
            attendance.sectionId, 
            school
        );
        
        if (!enrollmentCheck.valid) {
            return res.status(400).json({
                message: enrollmentCheck.message,
                nonEnrolledStudents: enrollmentCheck.nonEnrolled
            });
        }

        // Fetch approved leaves for this date
        const leaves = await Leave.find({
            school,
            studentId: { $in: studentIds },
            date: attendance.date,
            status: "approved"
        }).lean();

        const leaveSet = new Set(leaves.map(l => String(l.studentId)));

        // Create a map of existing students
        const existingStudentMap = new Map(
            attendance.students.map(s => [String(s.studentId), s])
        );

        // Fetch details for new students
        const newStudentIds = studentIds.filter(id => !existingStudentMap.has(String(id)));
        let newUsers = [];
        
        if (newStudentIds.length > 0) {
            newUsers = await User.find({
                _id: { $in: newStudentIds },
                school
            }).select("name email").lean();
        }

        const newUserMap = new Map(newUsers.map(u => [String(u._id), u]));

        // Update attendance records
        const updatedStudents = [];

        for (const s of students) {
            const studentIdStr = String(s.studentId);
            const hasApprovedLeave = leaveSet.has(studentIdStr);
            
            // Determine final status (respect approved leaves)
            const finalStatus = hasApprovedLeave ? "leave" : s.status;
            
            if (existingStudentMap.has(studentIdStr)) {
                // Update existing student
                const existingStudent = existingStudentMap.get(studentIdStr);
                existingStudent.status = finalStatus;
                updatedStudents.push(existingStudent);
            } else {
                // Add new student
                const user = newUserMap.get(studentIdStr);
                const newStudent = {
                    studentId: s.studentId,
                    name: user?.name || "Unknown",
                    email: user?.email || "N/A",
                    status: finalStatus
                };
                existingStudentMap.set(studentIdStr, newStudent);
                updatedStudents.push(newStudent);
            }
        }

        // Save updated attendance
        attendance.students = updatedStudents;
        await attendance.save();

        return res.status(200).json({
            message: "Attendance updated successfully",
            attendance: {
                _id: attendance._id,
                date: attendance.date,
                classId: attendance.classId,
                sectionId: attendance.sectionId,
                totalStudents: updatedStudents.length,
                present: updatedStudents.filter(s => s.status === "present").length,
                absent: updatedStudents.filter(s => s.status === "absent").length,
                leave: updatedStudents.filter(s => s.status === "leave").length,
                students: updatedStudents,
                updatedAt: attendance.updatedAt
            }
        });

    } catch (err) {
        console.error("updateAttendance error:", err);
        return res.status(500).json({ 
            message: "Server error",
            error: err.message 
        });
    }
};

const getAttendanceBySection = async (req, res) => {
    try {
        const { sectionId } = req.params;
        const { date, startDate, endDate, status } = req.query;
        const school = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;

        // Validate sectionId
        if (!mongoose.Types.ObjectId.isValid(sectionId)) {
            return res.status(400).json({ message: "Invalid section ID" });
        }

        // For teachers, check if they're assigned to this section
        if (userRole === 'teacher') {
            // Get teacher's assigned section
            const teacher = await User.findOne({
                _id: userId,
                school,
                role: 'teacher',
                status: 'active'
            }).select('sectionInfo').lean();

            if (!teacher) {
                return res.status(403).json({ 
                    message: "Teacher not found or inactive" 
                });
            }

            if (String(teacher.sectionInfo?.id) !== String(sectionId)) {
                return res.status(403).json({ 
                    message: "You can only view attendance for your assigned section" 
                });
            }
        }

        const { page, limit, skip } = normalizePagination(req.query);

        // Build filter
        const filter = {
            school,
            sectionId
        };

        // Handle date filtering
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

        // Get total count and records
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

        // Format response
        const attendance = records.map(att => {
            const section = att.classId?.sections?.find(
                s => String(s._id) === String(sectionId)
            ) || null;

            let students = att.students;
            if (status) {
                students = students.filter(s => s.status === status);
            }

            return {
                _id: att._id,
                date: att.date,
                class: att.classId ? { 
                    _id: att.classId._id, 
                    name: att.classId.class 
                } : null,
                section: section ? { 
                    _id: section._id, 
                    name: section.name 
                } : null,
                teacher: att.teacherId ? { 
                    _id: att.teacherId._id, 
                    name: att.teacherId.name,
                    email: att.teacherId.email
                } : null,
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
                createdAt: att.createdAt,
                updatedAt: att.updatedAt
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
        return res.status(500).json({ 
            message: "Server error",
            error: err.message 
        });
    }
};

const getAttendanceByStudent = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { date, startDate, endDate, status } = req.query;
        const school = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;
        
        const { page, limit, skip } = normalizePagination(req.query);

        // Validate studentId
        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({ message: "Invalid student ID" });
        }

        // Check permissions
        if (userRole === 'student') {
            // Students can only view their own attendance
            if (String(studentId) !== String(userId)) {
                return res.status(403).json({ 
                    message: "You can only view your own attendance" 
                });
            }
        } else if (userRole === 'teacher') {
            // Teachers can only view attendance of students in their class/section
            const teacher = await User.findOne({
                _id: userId,
                school,
                role: 'teacher',
                status: 'active'
            }).select('classInfo sectionInfo').lean();

            if (!teacher) {
                return res.status(403).json({ 
                    message: "Teacher not found or inactive" 
                });
            }

            // Check if student belongs to teacher's class/section
            const student = await User.findOne({
                _id: studentId,
                school,
                role: 'student',
                status: 'active',
                'classInfo.id': teacher.classInfo?.id,
                'sectionInfo.id': teacher.sectionInfo?.id
            });

            if (!student) {
                return res.status(403).json({ 
                    message: "Student not found in your class/section" 
                });
            }
        }

        // Build filter
        const filter = {
            school,
            "students.studentId": new mongoose.Types.ObjectId(studentId)
        };

        // Handle date filtering
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

        // Get total count and records
        const total = await Attendance.countDocuments(filter);

        const records = await Attendance.find(filter)
            .populate("classId", "class sections")
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Format response
        const attendance = records
            .map(r => {
                const student = r.students.find(
                    s => String(s.studentId) === String(studentId)
                );

                if (!student) return null;
                if (status && student.status !== status) return null;

                const section = r.classId?.sections?.find(
                    sec => String(sec._id) === String(r.sectionId)
                ) || null;

                return {
                    _id: r._id,
                    date: r.date,
                    class: r.classId ? { 
                        _id: r.classId._id, 
                        name: r.classId.class 
                    } : null,
                    section: section ? { 
                        _id: section._id, 
                        name: section.name 
                    } : null,
                    status: student.status,
                    createdAt: r.createdAt
                };
            })
            .filter(Boolean);

        return res.status(200).json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            attendance
        });

    } catch (err) {
        console.error("getAttendanceByStudent error:", err);
        return res.status(500).json({ 
            message: "Server error",
            error: err.message 
        });
    }
};

module.exports = {
    markAttendance,
    updateAttendance,
    getAttendanceBySection,
    getAttendanceByStudent,
};