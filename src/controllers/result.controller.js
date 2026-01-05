const Result = require("../models/Result");
const User = require("../models/User");
const ClassSection = require("../models/ClassSection");
const { deleteFileFromS3, uploadFileToS3 } = require("../services/s3.service");
const resultValidation = require("../validators/result.vakidation");

async function handleResultImageUpload(file, oldImage = null) {
    if (!file) return oldImage;

    if (oldImage) {
        await deleteFileFromS3(oldImage);
    }

    const uploaded = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
    });

    return uploaded;
}

// Check if user is section incharge
const isSectionIncharge = async (userId, sectionId, schoolId) => {
    try {
        const user = await User.findOne({
            _id: userId,
            school: schoolId,
            role: 'teacher',
            'sectionInfo.id': sectionId
        });

        return user !== null;
    } catch (error) {
        return false;
    }
};


const getClassSectionInfo = async (classId, sectionId, schoolId) => {
    try {
        // Find the class section document
        const classSection = await ClassSection.findOne({
            _id: classId,
            school: schoolId
        }).lean();

        if (!classSection) {
            return {
                class: null,
                section: null
            };
        }

        // Extract class info
        const classInfo = {
            _id: classSection._id,
            name: classSection.class
        };

        // Find the specific section within the class
        let sectionInfo = null;
        if (sectionId && classSection.sections) {
            const section = classSection.sections.find(
                sec => sec._id.toString() === sectionId.toString()
            );

            if (section) {
                sectionInfo = {
                    _id: section._id,
                    name: section.name
                };
            }
        }

        return {
            class: classInfo,
            section: sectionInfo
        };
    } catch (error) {
        console.error('Error in getClassSectionInfo:', error);
        return {
            class: null,
            section: null
        };
    }
};


// Add Result with full validation
const addResult = async (req, res) => {
    try {
        // Validate request body
        const { error, value } = resultValidation.addResult.validate(req.body);
        if (error) {
            return res.status(400).json({
                message: "Validation error",
                error: error.details[0].message
            });
        }

        const {
            studentId,
            classId,
            sectionId,
            marksObtained,
            totalMarks,
            position,
            examType,
            year
        } = value;

        const schoolId = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;

        // Check if user is teacher (section incharge) or admin
        if (userRole === 'teacher') {
            // For teachers, check if they are incharge of this section
            const isIncharge = await isSectionIncharge(userId, sectionId, schoolId);
            if (!isIncharge) {
                return res.status(403).json({
                    message: "You can only add results for your assigned section"
                });
            }
        }

        // ---- Check Student ----
        const student = await User.findOne({
            _id: studentId,
            school: schoolId,
            role: "student"
        }).populate('classInfo.id').populate('sectionInfo.id');

        if (!student) {
            return res.status(404).json({ message: "Student not found in your school" });
        }

        // Check if student has class and section
        if (!student.classInfo?.id || !student.sectionInfo?.id) {
            return res.status(400).json({
                message: "Student is not assigned to any class or section"
            });
        }

        // Verify student's class and section match the provided IDs
        const studentClassId = student.classInfo.id._id ?
            student.classInfo.id._id.toString() :
            student.classInfo.id.toString();
        const studentSectionId = student.sectionInfo.id._id ?
            student.sectionInfo.id._id.toString() :
            student.sectionInfo.id.toString();

        if (studentClassId !== classId) {
            return res.status(400).json({
                message: "Student is not enrolled in the specified class"
            });
        }

        if (studentSectionId !== sectionId) {
            return res.status(400).json({
                message: "Student is not in the specified section"
            });
        }

        // Check if class-section exists in school
        const classSection = await ClassSection.findOne({
            _id: classId,
            school: schoolId,
            'sections._id': sectionId
        });

        if (!classSection) {
            return res.status(404).json({
                message: "Class or section not found in your school"
            });
        }

        // ---- Check Duplicate Result ----
        const existingResult = await Result.findOne({
            school: schoolId,
            studentId,
            classId,
            sectionId,
            examType,
            year
        });

        if (existingResult) {
            return res.status(400).json({
                message: "Result already exists for this student for the selected exam and year"
            });
        }

        // ---- Upload Image ----
        let image = null;
        if (req.file) {
            // Validate image file
            const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedMimeTypes.includes(req.file.mimetype)) {
                return res.status(400).json({
                    message: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed"
                });
            }

            if (req.file.size > 5 * 1024 * 1024) { // 5MB limit
                return res.status(400).json({
                    message: "File size too large. Maximum size is 5MB"
                });
            }

            image = await handleResultImageUpload(req.file);
        }

        // Calculate percentage
        const percentage = ((marksObtained / totalMarks) * 100).toFixed(2);

        // ---- Create Result ----
        const newResult = await Result.create({
            school: schoolId,
            studentId,
            classId,
            sectionId,
            marksObtained,
            totalMarks,
            percentage: parseFloat(percentage),
            position,
            examType,
            year,
            image
        });

        // Populate result with student and class details
        const populatedResult = await Result.findById(newResult._id)
            .populate({
                path: 'studentId',
                select: 'name email rollNo admissionNo',
                populate: [
                    { path: 'classInfo.id', select: 'class' },
                    { path: 'sectionInfo.id', select: 'name' }
                ]
            })
            .populate({
                path: 'classId',
                select: 'class sections'
            });

        res.status(201).json({
            message: "Result added successfully",
            result: populatedResult
        });

    } catch (err) {
        console.error("Add Result Error:", err);
        res.status(500).json({
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Update Result with validation
const updateResult = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;

        // Validate request body
        const { error, value } = resultValidation.updateResult.validate(req.body);
        if (error) {
            return res.status(400).json({
                message: "Validation error",
                error: error.details[0].message
            });
        }

        const result = await Result.findById(id)
            .populate('studentId', 'name email rollNo')
            .populate('classId', 'class sections');

        if (!result) {
            return res.status(404).json({ message: "Result not found" });
        }

        // Check if result belongs to user's school
        if (result.school.toString() !== schoolId.toString()) {
            return res.status(403).json({
                message: "You can only update results from your school"
            });
        }

        // Check if user is teacher (section incharge)
        if (userRole === 'teacher') {
            const isIncharge = await isSectionIncharge(userId, result.sectionId.toString(), schoolId);
            if (!isIncharge) {
                return res.status(403).json({
                    message: "You can only update results for your assigned section"
                });
            }
        }

        // If updating studentId, classId, or sectionId, validate the new student
        if (value.studentId || value.classId || value.sectionId) {
            const studentToUpdate = value.studentId || result.studentId;
            const classToUpdate = value.classId || result.classId;
            const sectionToUpdate = value.sectionId || result.sectionId;

            const student = await User.findOne({
                _id: studentToUpdate,
                school: schoolId,
                role: "student"
            }).populate('classInfo.id').populate('sectionInfo.id');

            if (!student) {
                return res.status(404).json({
                    message: "Student not found in your school"
                });
            }

            const studentClassId = student.classInfo.id._id ?
                student.classInfo.id._id.toString() :
                student.classInfo.id.toString();
            const studentSectionId = student.sectionInfo.id._id ?
                student.sectionInfo.id._id.toString() :
                student.sectionInfo.id.toString();

            if (studentClassId !== classToUpdate.toString()) {
                return res.status(400).json({
                    message: "Student is not enrolled in the specified class"
                });
            }

            if (studentSectionId !== sectionToUpdate.toString()) {
                return res.status(400).json({
                    message: "Student is not in the specified section"
                });
            }

            // Check for duplicate result if exam type or year is being changed
            const examTypeToCheck = value.examType || result.examType;
            const yearToCheck = value.year || result.year;

            const duplicateResult = await Result.findOne({
                _id: { $ne: id },
                school: schoolId,
                studentId: studentToUpdate,
                classId: classToUpdate,
                sectionId: sectionToUpdate,
                examType: examTypeToCheck,
                year: yearToCheck
            });

            if (duplicateResult) {
                return res.status(400).json({
                    message: "Another result already exists for this student for the selected exam and year"
                });
            }
        }

        // Calculate percentage if marks are being updated
        let updatedData = { ...value };
        if (value.marksObtained !== undefined || value.totalMarks !== undefined) {
            const marksObtained = value.marksObtained !== undefined ?
                value.marksObtained : result.marksObtained;
            const totalMarks = value.totalMarks !== undefined ?
                value.totalMarks : result.totalMarks;

            const percentage = ((marksObtained / totalMarks) * 100).toFixed(2);
            updatedData.percentage = parseFloat(percentage);
        }

        // Replace image if new uploaded
        if (req.file) {
            const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedMimeTypes.includes(req.file.mimetype)) {
                return res.status(400).json({
                    message: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed"
                });
            }

            if (req.file.size > 5 * 1024 * 1024) {
                return res.status(400).json({
                    message: "File size too large. Maximum size is 5MB"
                });
            }

            const newImage = await handleResultImageUpload(req.file, result.image);
            updatedData.image = newImage;
        }

        const updatedResult = await Result.findByIdAndUpdate(
            id,
            { $set: updatedData },
            { new: true, runValidators: true }
        )
            .populate({
                path: 'studentId',
                select: 'name email rollNo admissionNo',
                populate: [
                    { path: 'classInfo.id', select: 'class' },
                    { path: 'sectionInfo.id', select: 'name' }
                ]
            })
            .populate({
                path: 'classId',
                select: 'class sections'
            });

        res.status(200).json({
            message: "Result updated successfully",
            result: updatedResult
        });

    } catch (err) {
        console.error("Update Result Error:", err);
        res.status(500).json({
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Get results with comprehensive filtering
const getResults = async (req, res) => {
    try {
        // Validate query parameters
        const { error, value } = resultValidation.getResults.validate(req.query);
        if (error) {
            return res.status(400).json({
                message: "Validation error",
                error: error.details[0].message
            });
        }

        const {
            studentId,
            classId,
            sectionId,
            examType,
            year,
            position,
            page = 1,
            limit = 10
        } = value;

        const schoolId = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;

        // Build filter
        const filter = { school: schoolId };

        // For teachers, only show results from their assigned sections
        if (userRole === 'teacher') {
            const teacher = await User.findById(userId).select('sectionInfo classInfo isIncharge');

            // Check teacher authorization
            if (!teacher || !teacher.sectionInfo?.id || !teacher.isIncharge) {
                return res.status(403).json({
                    message: "You are not authorized to view results"
                });
            }

            const assignedSectionId = teacher.sectionInfo.id.toString();
            filter.sectionId = assignedSectionId;

            // Auto-filter by teacher's class
            if (teacher.classInfo?.id && !classId) {
                filter.classId = teacher.classInfo.id;
            }

            // Verify requested section matches teacher's section
            if (sectionId && sectionId.toString() !== assignedSectionId) {
                return res.status(403).json({
                    message: "You are not authorized to view results from this section"
                });
            }

            // Verify requested class matches teacher's class
            if (classId && teacher.classInfo?.id && classId.toString() !== teacher.classInfo.id.toString()) {
                return res.status(403).json({
                    message: "You are not authorized to view results from this class"
                });
            }
        }

        // Add filters
        if (studentId) filter.studentId = studentId;
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;
        if (examType) filter.examType = examType;
        if (year) filter.year = year;
        if (position) filter.position = position;

        const skip = (page - 1) * limit;

        // Get results with pagination
        const results = await Result.find(filter)
            .populate({
                path: 'studentId',
                select: 'name email rollNo',
            })
            .skip(skip)
            .limit(Number(limit))
            .sort({ year: -1, examType: 1, marksObtained: -1 })
            .lean();

        // Get unique class IDs for batch fetching
        const classIds = [...new Set(
            results.map(r => r.classId?.toString()).filter(Boolean)
        )];

        // Fetch all class sections in one query
        const classSections = await ClassSection.find({
            _id: { $in: classIds },
            school: schoolId
        }).lean();

        // Create lookup map for class sections
        const classSectionMap = new Map();
        classSections.forEach(cs => {
            classSectionMap.set(cs._id.toString(), cs);
        });

        // Transform results
        const transformedResults = results.map(result => {
            const classSection = classSectionMap.get(result.classId?.toString());

            const transformed = {
                _id: result._id,
                school: result.school,
                student: result.studentId, // studentId renamed to student
                examType: result.examType,
                year: result.year,
                marksObtained: result.marksObtained,
                totalMarks: result.totalMarks,
                percentage: result.percentage,
                position: result.position,
                image: result.image,
                createdAt: result.createdAt,
                updatedAt: result.updatedAt,
                __v: result.__v
            };

            // Add class info if available
            if (classSection) {
                transformed.class = {
                    _id: classSection._id,
                    name: classSection.class
                };

                // Add section info if available
                if (result.sectionId && classSection.sections) {
                    const section = classSection.sections.find(
                        sec => sec._id.toString() === result.sectionId.toString()
                    );
                    if (section) {
                        transformed.section = {
                            _id: section._id,
                            name: section.name
                        };
                    }
                }
            }

            return transformed;
        });

        const total = await Result.countDocuments(filter);

        res.status(200).json({
            total,
            page: Number(page),
            totalPages: Math.ceil(total / limit),
            limit: Number(limit),
            results: transformedResults,
        });

    } catch (err) {
        console.error("Get Results Error:", err);
        res.status(500).json({
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Student-only results with their own data
const getStudentResults = async (req, res) => {
    try {
        const student = req.user;

        const results = await Result.find({
            studentId: student._id,
            school: student.school,
        })
            .populate({
                path: 'classId',
                select: 'class sections'
            })
            .sort({ year: -1, examType: 1 })
            .lean();

        // Get unique class IDs for fetching class sections
        const classIds = [...new Set(
            results.map(r => r.classId?._id?.toString()).filter(Boolean)
        )];

        // Fetch all class sections for efficient lookup
        const classSections = await ClassSection.find({
            _id: { $in: classIds },
            school: student.school
        }).lean();

        // Create lookup map for class sections
        const classSectionMap = new Map();
        classSections.forEach(cs => {
            classSectionMap.set(cs._id.toString(), cs);
        });

        // Transform results with individual percentage for each result
        const transformedResults = results.map(result => {
            const classSection = classSectionMap.get(result.classId?._id?.toString());

            // Calculate percentage for this individual result
            const individualPercentage = result.totalMarks > 0
                ? ((result.marksObtained / result.totalMarks) * 100).toFixed(2)
                : "0.00";

            const transformed = {
                _id: result._id,
                school: result.school,
                examType: result.examType,
                year: result.year,
                marksObtained: result.marksObtained,
                totalMarks: result.totalMarks,
                averagePercentage: individualPercentage, // Individual result's percentage
                position: result.position,
                image: result.image,
                createdAt: result.createdAt,
                updatedAt: result.updatedAt
            };

            // Add class info if available
            if (classSection) {
                transformed.class = {
                    _id: classSection._id,
                    name: classSection.class
                };

                // Add section info if available
                if (result.sectionId && classSection.sections) {
                    const section = classSection.sections.find(
                        sec => sec._id.toString() === result.sectionId.toString()
                    );
                    if (section) {
                        transformed.section = {
                            _id: section._id,
                            name: section.name
                        };
                    }
                }
            }

            return transformed;
        });

        // Calculate overall statistics
        const stats = {
            totalExams: transformedResults.length,
            averagePercentage: 0,
            highestScore: 0,
            totalMarksObtained: 0,
            totalPossibleMarks: 0
        };

        if (transformedResults.length > 0) {
            transformedResults.forEach(result => {
                stats.totalMarksObtained += result.marksObtained;
                stats.totalPossibleMarks += result.totalMarks;

                if (result.marksObtained > stats.highestScore) {
                    stats.highestScore = result.marksObtained;
                }
            });

            // Calculate overall average percentage
            stats.averagePercentage = ((stats.totalMarksObtained / stats.totalPossibleMarks) * 100).toFixed(2);
        }

        res.status(200).json({
            total: transformedResults.length,
            statistics: stats,
            results: transformedResults
        });

    } catch (err) {
        console.error("Student Results Error:", err);
        res.status(500).json({
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Get results by position with ranking
const getResultsByPosition = async (req, res) => {
    try {
        const { examType, year, classId, sectionId } = req.query;
        const schoolId = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;

        // Build filter
        const filter = { school: schoolId };

        if (examType) filter.examType = examType;
        if (year) filter.year = year;
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;

        // For teachers, restrict to their sections
        if (userRole === 'teacher') {
            const teacher = await User.findById(userId)
                .select('sectionInfo.id');

            if (!teacher || !teacher.sectionInfo || teacher.sectionInfo.length === 0) {
                return res.status(403).json({
                    message: "You are not assigned to any section"
                });
            }

            const assignedSectionIds = teacher.sectionInfo.map(s => s.id.toString());
            filter.sectionId = { $in: assignedSectionIds };
        }

        // Get results grouped by position
        const resultsByPosition = await Result.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: "$position",
                    count: { $sum: 1 },
                    averagePercentage: { $avg: "$percentage" },
                    results: {
                        $push: {
                            studentId: "$studentId",
                            marksObtained: "$marksObtained",
                            totalMarks: "$totalMarks",
                            percentage: "$percentage",
                            examType: "$examType",
                            year: "$year"
                        }
                    }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Get top performers
        const topPerformers = await Result.find(filter)
            .sort({ percentage: -1 })
            .limit(10)
            .populate({
                path: 'studentId',
                select: 'name rollNo'
            })
            .select('marksObtained totalMarks percentage position examType year');

        res.status(200).json({
            resultsByPosition,
            topPerformers,
            filterApplied: {
                examType,
                year,
                classId,
                sectionId
            }
        });

    } catch (err) {
        console.error("Get Results By Position Error:", err);
        res.status(500).json({
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Delete result with authorization check
const deleteResult = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;

        const result = await Result.findById(id);
        if (!result) {
            return res.status(404).json({ message: "Result not found" });
        }

        // Check if result belongs to user's school
        if (result.school.toString() !== schoolId.toString()) {
            return res.status(403).json({
                message: "You can only delete results from your school"
            });
        }

        // Check if user is teacher (section incharge)
        if (userRole === 'teacher') {
            const isIncharge = await isSectionIncharge(userId, result.sectionId.toString(), schoolId);
            if (!isIncharge) {
                return res.status(403).json({
                    message: "You can only delete results for your assigned section"
                });
            }
        }

        if (result.image) {
            await deleteFileFromS3(result.image);
        }

        await result.deleteOne();

        res.status(200).json({
            message: "Result deleted successfully",
            deletedResult: {
                id: result._id,
                studentId: result.studentId,
                examType: result.examType,
                year: result.year
            }
        });

    } catch (err) {
        console.error("Delete Result Error:", err);
        res.status(500).json({
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

module.exports = {
    addResult,
    updateResult,
    getResults,
    getStudentResults,
    deleteResult,
    getResultsByPosition
};