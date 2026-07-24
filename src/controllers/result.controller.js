const Result = require("../models/Result");
const Student = require("../models/Student");
const Subject = require("../models/Subject");
const ExamSchedule = require("../models/ExamSchedule");
const { addResultSchema, updateResultSchema, getResultsSchema } = require("../validators/result.vakidation");
const { getClassSectionMaps, formatClassSection } = require("../utils/classHelper");
const Staff = require("../models/Staff");

const calculateGrade = (percentage) => {
    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B";
    if (percentage >= 60) return "C";
    if (percentage >= 50) return "D";
    return "F";
};

const getExamScheduleTotalMarks = async (subjectId, classId, sectionId, examType, year, schoolId) => {
    const examSchedule = await ExamSchedule.findOne({
        school: schoolId,
        subjectId,
        classId,
        sectionId,
        type: examType,
        year: year,
        status: 'scheduled'
    }).lean();

    if (!examSchedule) {
        return null;
    }

    // You can set total marks per subject in exam schedule or use a default
    // For now, we'll use 100 as default or you can add a totalMarks field to ExamSchedule
    return examSchedule.totalMarks || 100;
};

const validateExamSchedule = async (subjectId, classId, sectionId, examType, year, schoolId) => {
    const examSchedule = await ExamSchedule.findOne({
        school: schoolId,
        subjectId,
        classId,
        sectionId,
        type: examType,
        year: year,
        status: 'scheduled'
    }).lean();

    if (!examSchedule) {
        return {
            valid: false,
            message: `No exam schedule found for subject. Please create exam schedule first.`
        };
    }

    return {
        valid: true,
        examSchedule
    };
};

const canManageResult = async (user, studentId, schoolId) => {
    console.log("Checking if user can manage result", user.role, studentId, schoolId)

    // Check if user is admin (schoolId exists in user or role is admin_office)
    const isAdmin = user.schoolId || user.role === 'admin_office';
    console.log("Is admin:", isAdmin)

    if (isAdmin) {
        const student = await Student.findOne({
            _id: studentId,
            school: schoolId,
            isActive: true
        }).lean();
        console.log("Admin - Student found:", student)

        if (!student) {
            return { allowed: false, message: "Student not found", student: null };
        }

        return { allowed: true, student: student };
    }

    const student = await Student.findOne({
        _id: studentId,
        school: schoolId,
        isActive: true
    }).lean();
    console.log("Teacher - Student:", student)

    if (!student) {
        return { allowed: false, message: "Student not found", student: null };
    }

    const teacher = await Staff.findOne({
        _id: user._id,
        school: schoolId,
        isActive: true,
        isIncharge: true,
        'classInfo.id': student.classInfo.id,
        'sectionInfo.id': student.sectionInfo.id
    }).lean();

    if (!teacher) {
        return {
            allowed: false,
            message: "You are not authorized to manage results for this student. You can only manage your section students.",
            student: null
        };
    }

    return { allowed: true, student: student };
};

const getAccessibleStudentIds = async (user, schoolId) => {
    const isAdmin = user.role === 'admin' || user.role === 'superadmin' || user.role === 'admin_office';

    if (isAdmin) {
        return null; 
    }

    const teacher = await Staff.findOne({
        _id: user._id,
        school: schoolId,
        isActive: true,
        isIncharge: true
    }).lean();

    if (!teacher || !teacher.classInfo?.id || !teacher.sectionInfo?.id) {
        return []; 
    }

    const students = await Student.find({
        school: schoolId,
        isActive: true,
        'classInfo.id': teacher.classInfo.id,
        'sectionInfo.id': teacher.sectionInfo.id
    }).select('_id').lean();

    return students.map(s => s._id);
};

const createResult = async (req, res) => {
    console.log("createResult", req.user)
    try {
        const { error } = addResultSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const schoolId = req.user.school;
        const user = req.user;
        const {
            studentId,
            classId,
            sectionId,
            examType,
            year,
            subjects,
            remarks
        } = req.body;

        const accessCheck = await canManageResult(user, studentId, schoolId);
        console.log("Access check result:", accessCheck)
        if (!accessCheck.allowed) {
            return res.status(403).json({
                success: false,
                message: accessCheck.message || "You are not authorized to create result for this student."
            });
        }

        const student = accessCheck.student;
        console.log("Student found:", student)

        if (
            student.classInfo.id.toString() !== classId ||
            student.sectionInfo.id.toString() !== sectionId
        ) {
            return res.status(400).json({
                success: false,
                message: "Student does not belong to selected class/section."
            });
        }

        const alreadyExists = await Result.exists({
            school: schoolId,
            studentId,
            examType,
            year
        });

        if (alreadyExists) {
            return res.status(400).json({
                success: false,
                message: "Result already exists for this student and exam."
            });
        }

        const subjectIds = subjects.map(item => item.subjectId);
        const dbSubjects = await Subject.find({
            _id: { $in: subjectIds },
            school: schoolId,
            isActive: true
        }).select("name code totalMarks").lean();

        if (dbSubjects.length !== subjects.length) {
            return res.status(400).json({
                success: false,
                message: "Invalid subject selected."
            });
        }

        const subjectMap = new Map();
        dbSubjects.forEach(subject => {
            subjectMap.set(subject._id.toString(), subject);
        });

        let totalMarks = 0;
        let obtainedMarks = 0;
        const subjectResult = [];

        for (const item of subjects) {
            const subject = subjectMap.get(item.subjectId);
            if (!subject) continue;

            const examValidation = await validateExamSchedule(
                item.subjectId,
                classId,
                sectionId,
                examType,
                year,
                schoolId
            );

            if (!examValidation.valid) {
                return res.status(400).json({
                    success: false,
                    message: `${subject.name}: ${examValidation.message}`
                });
            }

            const examTotalMarks = examValidation.examSchedule.totalMarks || subject.totalMarks || 100;

            if (item.obtainedMarks > examTotalMarks) {
                return res.status(400).json({
                    success: false,
                    message: `${subject.name} obtained marks (${item.obtainedMarks}) cannot exceed total marks (${examTotalMarks})`
                });
            }

            totalMarks += examTotalMarks;
            obtainedMarks += item.obtainedMarks;

            subjectResult.push({
                subjectId: subject._id,
                subjectName: subject.name,
                totalMarks: examTotalMarks,
                obtainedMarks: item.obtainedMarks,
                remarks: item.remarks || "",
                examScheduleId: examValidation.examSchedule._id
            });
        }

        const percentage = totalMarks > 0
            ? Number(((obtainedMarks / totalMarks) * 100).toFixed(2))
            : 0;

        const grade = calculateGrade(percentage);

        const result = await Result.create({
            school: schoolId,
            studentId,
            classId,
            sectionId,
            examType,
            year,
            subjects: subjectResult,
            totalMarks,
            obtainedMarks,
            percentage,
            grade,
            remarks,
            createdBy: req.user._id
        });

        return res.status(201).json({
            success: true,
            message: "Result created successfully.",
            data: result
        });

    } catch (err) {
        console.error("Error creating result:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

const updateResult = async (req, res) => {
    try {
        const { error } = updateResultSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const schoolId = req.user.school;
        const user = req.user;

        const result = await Result.findOne({
            _id: req.params.resultId,
            school: schoolId
        }).lean();

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Result not found."
            });
        }

        const accessCheck = await canManageResult(user, result.studentId, schoolId);
        if (!accessCheck.allowed) {
            return res.status(403).json({
                success: false,
                message: accessCheck.message || "You are not authorized to update result for this student."
            });
        }

        const subjectIds = req.body.subjects.map(item => item.subjectId);
        const dbSubjects = await Subject.find({
            _id: { $in: subjectIds },
            school: schoolId,
            isActive: true
        }).select("name code totalMarks").lean();

        if (dbSubjects.length !== subjectIds.length) {
            return res.status(400).json({
                success: false,
                message: "Invalid subject selected."
            });
        }

        const subjectMap = new Map();
        dbSubjects.forEach(subject => {
            subjectMap.set(subject._id.toString(), subject);
        });

        let totalMarks = 0;
        let obtainedMarks = 0;
        const subjects = [];

        for (const item of req.body.subjects) {
            const subject = subjectMap.get(item.subjectId);
            if (!subject) continue;

            console.log(item.subjectId,
                result.classId,
                result.sectionId,
                result.examType,
                result.year,
                schoolId)
            const examValidation = await validateExamSchedule(
                item.subjectId,
                result.classId,
                result.sectionId,
                result.examType,
                result.year,
                schoolId
            );

            if (!examValidation.valid) {
                return res.status(400).json({
                    success: false,
                    message: `${subject.name}: ${examValidation.message}`
                });
            }

            const examTotalMarks = examValidation.examSchedule.totalMarks || subject.totalMarks || 100;

            if (item.obtainedMarks > examTotalMarks) {
                return res.status(400).json({
                    success: false,
                    message: `${subject.name} obtained marks (${item.obtainedMarks}) cannot exceed total marks (${examTotalMarks})`
                });
            }

            totalMarks += examTotalMarks;
            obtainedMarks += item.obtainedMarks;

            subjects.push({
                subjectId: subject._id,
                subjectName: subject.name,
                totalMarks: examTotalMarks,
                obtainedMarks: item.obtainedMarks,
                remarks: item.remarks || "",
                examScheduleId: examValidation.examSchedule._id
            });
        }

        const percentage = totalMarks > 0
            ? Number(((obtainedMarks / totalMarks) * 100).toFixed(2))
            : 0;

        const updatedResult = await Result.findByIdAndUpdate(
            req.params.resultId,
            {
                subjects: subjects,
                totalMarks: totalMarks,
                obtainedMarks: obtainedMarks,
                percentage: percentage,
                grade: calculateGrade(percentage),
                remarks: req.body.remarks || "",
                updatedBy: req.user._id
            },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: "Result updated successfully.",
            data: updatedResult
        });

    } catch (err) {
        console.error("Error updating result:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

const deleteResult = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const user = req.user;

        const result = await Result.findOne({
            _id: req.params.resultId,
            school: schoolId
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Result not found."
            });
        }

        //----------------------------------------------------
        // Check if user can manage this student
        //----------------------------------------------------
        const accessCheck = await canManageResult(user, result.studentId, schoolId);
        if (!accessCheck.allowed) {
            return res.status(403).json({
                success: false,
                message: accessCheck.message || "You are not authorized to delete result for this student."
            });
        }

        await result.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Result deleted successfully."
        });

    } catch (err) {
        console.error("Error deleting result:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

const getResultById = async (req, res) => {
    try {
        const schoolId = req.user.school;

        const result = await Result.findOne({
            _id: req.params.resultId,
            school: schoolId
        })
            .populate(
                "studentId",
                "name email rollNo registrationNumber classInfo sectionInfo"
            )
            .lean();

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Result not found."
            });
        }

        const { classMap, sectionMap } = await getClassSectionMaps(
            [result.studentId],
            schoolId
        );

        const { classInfo, sectionInfo } = formatClassSection(
            result.studentId,
            classMap,
            sectionMap
        );

        const {
            studentId,
            classId,
            sectionId,
            ...resultData
        } = result;

        return res.status(200).json({
            success: true,
            data: {
                ...resultData,
                studentInfo: {
                    _id: studentId._id,
                    name: studentId.name,
                    email: studentId.email,
                    rollNo: studentId.rollNo,
                    registrationNumber: studentId.registrationNumber
                },
                classInfo: classInfo ? {
                    _id: classInfo.id,
                    name: classInfo.name
                } : null,
                sectionInfo: sectionInfo ? {
                    _id: sectionInfo.id,
                    name: sectionInfo.name
                } : null
            }
        });

    } catch (err) {
        console.error("Error getting result:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

const getResults = async (req, res) => {
    try {
        const { error, value } = getResultsSchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const schoolId = req.user.school;
        const user = req.user;

        const {
            page = 1,
            limit = 10,
            classId,
            sectionId,
            examType,
            year,
            search
        } = value;

        const isAdmin = user.schoolId || user.role === 'admin' || user.role === 'superadmin' || user.role === 'admin_office';

        let accessibleStudentIds = null;

        if (!isAdmin) {
            const teacher = await Staff.findOne({
                _id: user._id,
                school: schoolId,
                isActive: true,
                isIncharge: true
            }).lean();

            if (!teacher || !teacher.classInfo?.id || !teacher.sectionInfo?.id) {
                return res.status(200).json({
                    success: true,
                    pagination: {
                        total: 0,
                        page,
                        limit,
                        totalPages: 0
                    },
                    data: []
                });
            }

            const students = await Student.find({
                school: schoolId,
                isActive: true,
                'classInfo.id': teacher.classInfo.id,
                'sectionInfo.id': teacher.sectionInfo.id
            }).select('_id').lean();

            accessibleStudentIds = students.map(s => s._id);

            if (accessibleStudentIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    pagination: {
                        total: 0,
                        page,
                        limit,
                        totalPages: 0
                    },
                    data: []
                });
            }
        }

        let studentFilter = {
            school: schoolId,
            isActive: true
        };

        if (accessibleStudentIds !== null) {
            studentFilter._id = { $in: accessibleStudentIds };
        }

        if (classId) {
            studentFilter['classInfo.id'] = classId;
        }
        if (sectionId) {
            studentFilter['sectionInfo.id'] = sectionId;
        }

        if (search) {
            studentFilter.$or = [
                { name: { $regex: search, $options: "i" } },
                { rollNo: { $regex: search, $options: "i" } },
                { registrationNumber: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (page - 1) * limit;

        const [students, totalStudents] = await Promise.all([
            Student.find(studentFilter)
                .select('_id name email rollNo registrationNumber classInfo sectionInfo')
                .skip(skip)
                .limit(limit)
                .lean(),
            Student.countDocuments(studentFilter)
        ]);

        if (!students.length) {
            return res.status(200).json({
                success: true,
                pagination: {
                    total: 0,
                    page,
                    limit,
                    totalPages: 0
                },
                data: []
            });
        }

        const studentIds = students.map(s => s._id);

        const resultFilter = {
            school: schoolId,
            studentId: { $in: studentIds }
        };

        if (examType) resultFilter.examType = examType;
        if (year) resultFilter.year = year;

        const results = await Result.find(resultFilter)
            .populate("studentId", "name email rollNo registrationNumber classInfo sectionInfo")
            .sort({ year: -1, createdAt: -1 })
            .lean();

        const { classMap, sectionMap } = await getClassSectionMaps(
            results.map(r => r.studentId),
            schoolId
        );

        const groupedResults = students.map(student => {
            const studentResults = results.filter(
                r => r.studentId._id.toString() === student._id.toString()
            );

            const formattedResults = studentResults.map(result => {
                const { studentId, classId, sectionId, ...resultData } = result;
                return resultData;
            });

            const { classInfo, sectionInfo } = formatClassSection(
                student,
                classMap,
                sectionMap
            );

            return {
                studentInfo: {
                    _id: student._id,
                    name: student.name,
                    email: student.email,
                    rollNo: student.rollNo,
                    registrationNumber: student.registrationNumber
                },
                classInfo: classInfo ? {
                    _id: classInfo.id,
                    name: classInfo.name
                } : null,
                sectionInfo: sectionInfo ? {
                    _id: sectionInfo.id,
                    name: sectionInfo.name
                } : null,
                totalResults: formattedResults.length,
                results: formattedResults
            };
        });

        return res.status(200).json({
            success: true,
            pagination: {
                total: totalStudents,
                page,
                limit,
                totalPages: Math.ceil(totalStudents / limit)
            },
            data: groupedResults
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

const getStudentResults = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const user = req.user;
        const { studentId } = req.params;

        const accessCheck = await canManageResult(user, studentId, schoolId);
        if (!accessCheck.allowed) {
            return res.status(403).json({
                success: false,
                message: accessCheck.message || "You are not authorized to view results for this student."
            });
        }

        const results = await Result.find({
            school: schoolId,
            studentId: studentId
        })
            .populate(
                "studentId",
                "name email rollNo registrationNumber classInfo sectionInfo"
            )
            .sort({ year: -1, createdAt: -1 })
            .lean();

        if (!results.length) {
            return res.status(200).json({
                success: true,
                total: 0,
                studentInfo: null,
                classInfo: null,
                sectionInfo: null,
                results: []
            });
        }

        const student = results[0].studentId;

        const { classMap, sectionMap } = await getClassSectionMaps(
            [student],
            schoolId
        );

        const { classInfo, sectionInfo } = formatClassSection(
            student,
            classMap,
            sectionMap
        );

        const formattedResults = results.map(result => {
            const {
                studentId,
                classId,
                sectionId,
                ...resultData
            } = result;
            return resultData;
        });

        return res.status(200).json({
            success: true,
            studentInfo: {
                _id: student._id,
                name: student.name,
                email: student.email,
                rollNo: student.rollNo,
                registrationNumber: student.registrationNumber
            },
            classInfo: classInfo ? {
                _id: classInfo.id,
                name: classInfo.name
            } : null,
            sectionInfo: sectionInfo ? {
                _id: sectionInfo.id,
                name: sectionInfo.name
            } : null,
            total: formattedResults.length,
            results: formattedResults
        });

    } catch (err) {
        console.error("Error getting student results:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

const getClassResults = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = {
            school: schoolId,
            classId: req.params.classId
        };

        if (req.query.sectionId) {
            filter.sectionId = req.query.sectionId;
        }

        if (req.query.examType) {
            filter.examType = req.query.examType;
        }

        if (req.query.year) {
            filter.year = Number(req.query.year);
        }

        const [results, total] = await Promise.all([
            Result.find(filter)
                .populate("studentId", "name rollNo registrationNumber")
                .sort({ obtainedMarks: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Result.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            },
            data: results
        });

    } catch (err) {
        console.error("Error getting class results:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

module.exports = {
    createResult,
    updateResult,
    deleteResult,
    getResults,
    getResultById,
    getStudentResults,
    getClassResults,
};