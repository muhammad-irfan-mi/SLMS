const ClassSection = require("../models/ClassSection");
const Result = require("../models/Result");
const User = require("../models/User");
const { deleteFileFromS3, uploadFileToS3 } = require("../services/s3.service");
const { sendResultNotification } = require("../utils/notificationService");

// Get class and section info
const getClassSectionInfo = async (classId, sectionId, schoolId) => {
    const classSection = await ClassSection.findOne({
        _id: classId,
        school: schoolId
    }).lean();

    if (!classSection) {
        return { class: null, section: null };
    }

    const classInfo = {
        _id: classSection._id,
        name: classSection.class
    };

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

    return { class: classInfo, section: sectionInfo };
};

// Check if user is section incharge
const isSectionIncharge = async (userId, sectionId, schoolId) => {
    const user = await User.findOne({
        _id: userId,
        school: schoolId,
        role: 'teacher'
    }).select('sectionInfo');

    if (!user || !user.sectionInfo) return false;

    if (Array.isArray(user.sectionInfo)) {
        return user.sectionInfo.some(s => s.id?.toString() === sectionId.toString());
    } else {
        return user.sectionInfo.id?.toString() === sectionId.toString();
    }
};

const handleResultImageUpload = async (file, oldImage = null) => {
    if (!file) return oldImage;

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new Error("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed");
    }

    if (file.size > 5 * 1024 * 1024) {
        throw new Error("File size too large. Maximum size is 5MB");
    }

    if (oldImage) {
        await deleteFileFromS3(oldImage);
    }

    return await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
    });
};

// Transform result with class/section info
const transformResult = async (result, schoolId) => {
    const classSectionInfo = await getClassSectionInfo(result.classId, result.sectionId, schoolId);

    return {
        _id: result._id,
        school: result.school,
        studentId: result.studentId,
        class: classSectionInfo.class,
        section: classSectionInfo.section,
        examType: result.examType,
        year: result.year,
        marksObtained: result.marksObtained,
        totalMarks: result.totalMarks,
        percentage: result.percentage,
        position: result.position,
        image: result.image,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt
    };
};

// Batch transform results
const transformResults = async (results, schoolId) => {
    const classIds = [...new Set(
        results.map(r => r.classId?.toString()).filter(Boolean)
    )];

    const classSections = await ClassSection.find({
        _id: { $in: classIds },
        school: schoolId
    }).lean();

    const classSectionMap = new Map();
    classSections.forEach(cs => {
        classSectionMap.set(cs._id.toString(), cs);
    });

    return results.map(result => {
        const classSection = classSectionMap.get(result.classId?.toString());

        const transformed = {
            _id: result._id,
            school: result.school,
            studentInfo: result.studentId,
            examType: result.examType,
            year: result.year,
            marksObtained: result.marksObtained,
            totalMarks: result.totalMarks,
            percentage: result.percentage,
            position: result.position,
            image: result.image,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt
        };

        if (classSection) {
            transformed.classInfo = {
                _id: classSection._id,
                name: classSection.class
            };

            if (result.sectionId && classSection.sections) {
                const section = classSection.sections.find(
                    sec => sec._id.toString() === result.sectionId.toString()
                );
                if (section) {
                    transformed.sectionInfo = {
                        _id: section._id,
                        name: section.name
                    };
                }
            }
        }

        return transformed;
    });
};

const addResult = async (req, res) => {
    try {
        const { studentId, classId, sectionId, marksObtained, totalMarks, position, examType, year } = req.body;
        const schoolId = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;

        if (userRole === 'teacher') {
            const isIncharge = await isSectionIncharge(userId, sectionId, schoolId);
            if (!isIncharge) return res.status(403).json({ message: "You can only add results for your assigned section" });
        }

        const student = await User.findOne({
            _id: studentId,
            school: schoolId,
            role: "student"
        });

        if (!student) return res.status(404).json({ message: "Student not found in your school" });

        const studentClassId = student.classInfo?.id?.toString();
        const studentSectionId = student.sectionInfo?.id?.toString();

        if (!studentClassId || !studentSectionId) return res.status(400).json({ message: "Student is not assigned to any class or section" });
        if (studentClassId !== classId) return res.status(400).json({ message: "Student is not enrolled in the specified class" });
        if (studentSectionId !== sectionId) return res.status(400).json({ message: "Student is not in the specified section" });

        const classSection = await ClassSection.findOne({
            _id: classId,
            school: schoolId,
            'sections._id': sectionId
        });

        if (!classSection) return res.status(404).json({ message: "Class or section not found in your school" });

        const existingResult = await Result.findOne({
            school: schoolId,
            studentId,
            classId,
            sectionId,
            examType,
            year
        });

        if (existingResult) return res.status(400).json({ message: "Result already exists for this student for the selected exam and year" });

        let image = null;
        if (req.file) {
            image = await handleResultImageUpload(req.file);
        }

        const percentage = ((marksObtained / totalMarks) * 100).toFixed(2);

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

        const notification = await sendResultNotification({
            result: newResult,
            actor: req.user,
            action: 'creation'
        });

        const populatedResult = await Result.findById(newResult._id).populate({
            path: 'studentId',
            select: 'name email rollNo admissionNo'
        });

        const transformedResult = await transformResult(populatedResult, schoolId);

        res.status(201).json({
            message: "Result added successfully",
            result: transformedResult
        });
    } catch (err) {
        console.error("Add Result Error:", err);
        if (err.message.includes("Invalid file type") || err.message.includes("File size too large")) {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: "Server error" });
    }
};

const updateResult = async (req, res) => {
    try {
        const { resultId } = req.params;
        const updateData = { ...req.body };
        const schoolId = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;

        const result = await Result.findById(resultId);
        if (!result) return res.status(404).json({ message: "Result not found" });
        if (result.school.toString() !== schoolId.toString()) return res.status(403).json({ message: "You can only update results from your school" });

        if (userRole === 'teacher') {
            const isIncharge = await isSectionIncharge(userId, result.sectionId.toString(), schoolId);
            if (!isIncharge) return res.status(403).json({ message: "You can only update results for your assigned section" });
        }

        if (req.body.marksObtained !== undefined || req.body.totalMarks !== undefined) {
            const marksObtained = req.body.marksObtained !== undefined ? req.body.marksObtained : result.marksObtained;
            const totalMarks = req.body.totalMarks !== undefined ? req.body.totalMarks : result.totalMarks;
            updateData.percentage = ((marksObtained / totalMarks) * 100).toFixed(2);
        }

        if (req.file) {
            updateData.image = await handleResultImageUpload(req.file, result.image);
        }

        const updatedResult = await Result.findByIdAndUpdate(
            resultId,
            updateData,
            { new: true, runValidators: true }
        ).populate({
            path: 'studentId',
            select: 'name email rollNo admissionNo'
        });

        const notification = await sendResultNotification({
            result: updatedResult,
            actor: req.user,
            action: 'update'
        });

        const transformedResult = await transformResult(updatedResult, schoolId);

        res.status(200).json({
            message: "Result updated successfully",
            result: transformedResult
        });
    } catch (err) {
        console.error("Update Result Error:", err);
        if (err.message.includes("Invalid file type") || err.message.includes("File size too large")) {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: "Server error" });
    }
};

const getResults = async (req, res) => {
    try {
        const { studentId, classId, sectionId, examType, year, position, page = 1, limit = 10 } = req.query;
        const schoolId = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;

        const filter = { school: schoolId };

        if (userRole === 'teacher') {
            const teacher = await User.findById(userId).select('sectionInfo classInfo isIncharge');
            if (!teacher || !teacher.sectionInfo?.id || !teacher.isIncharge) return res.status(403).json({ message: "You are not authorized to view results" });

            const assignedSectionId = teacher.sectionInfo.id.toString();
            filter.sectionId = assignedSectionId;

            if (teacher.classInfo?.id && !classId) filter.classId = teacher.classInfo.id;
            if (sectionId && sectionId.toString() !== assignedSectionId) return res.status(403).json({ message: "You are not authorized to view results from this section" });
            if (classId && teacher.classInfo?.id && classId.toString() !== teacher.classInfo.id.toString()) {
                return res.status(403).json({ message: "You are not authorized to view results from this class" });
            }
        }

        if (studentId) filter.studentId = studentId;
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;
        if (examType) filter.examType = examType;
        if (year) filter.year = year;
        if (position) filter.position = position;

        const skip = (page - 1) * limit;

        const results = await Result.find(filter)
            .populate({
                path: 'studentId',
                select: 'name email rollNo'
            })
            .skip(skip)
            .limit(Number(limit))
            .sort({ year: -1, examType: 1, marksObtained: -1 })
            .lean();

        const transformedResults = await transformResults(results, schoolId);
        const total = await Result.countDocuments(filter);

        res.status(200).json({
            total,
            page: Number(page),
            totalPages: Math.ceil(total / limit),
            limit: Number(limit),
            results: transformedResults
        });
    } catch (err) {
        console.error("Get Results Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getStudentResults = async (req, res) => {
    try {
        const studentId = req.user._id;
        const schoolId = req.user.school;

        const results = await Result.find({
            studentId: studentId,
            school: schoolId
        })
            .populate({
                path: 'studentId',
                select: 'name email rollNo'
            })
            .sort({ year: -1, examType: 1 })
            .lean();

        const transformedResults = await transformResults(results, schoolId);

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
            stats.averagePercentage = ((stats.totalMarksObtained / stats.totalPossibleMarks) * 100).toFixed(2);
        }

        res.status(200).json({
            total: transformedResults.length,
            statistics: stats,
            results: transformedResults
        });
    } catch (err) {
        console.error("Student Results Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getResultsByPosition = async (req, res) => {
    try {
        const { examType, year, classId, sectionId } = req.query;
        const schoolId = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;

        const filter = { school: schoolId };

        if (examType) filter.examType = examType;
        if (year) filter.year = year;
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;

        if (userRole === 'teacher') {
            const teacher = await User.findById(userId).select('sectionInfo');
            if (!teacher || !teacher.sectionInfo) return res.status(403).json({ message: "You are not assigned to any section" });

            const assignedSectionIds = teacher.sectionInfo.map(s => s.id.toString());
            filter.sectionId = { $in: assignedSectionIds };
        }

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

        const topPerformers = await Result.find(filter)
            .sort({ percentage: -1 })
            .limit(10)
            .populate({
                path: 'studentId',
                select: 'name rollNo'
            })
            .select('marksObtained totalMarks percentage position examType year');

        const transformedTopPerformers = await transformResults(topPerformers, schoolId);

        res.status(200).json({
            resultsByPosition,
            topPerformers: transformedTopPerformers,
            filterApplied: { examType, year, classId, sectionId }
        });
    } catch (err) {
        console.error("Get Results By Position Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const deleteResult = async (req, res) => {
    try {
        const { resultId } = req.params;
        const schoolId = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;

        const result = await Result.findById(resultId);
        if (!result) return res.status(404).json({ message: "Result not found" });
        if (result.school.toString() !== schoolId.toString()) return res.status(403).json({ message: "You can only delete results from your school" });

        if (userRole === 'teacher') {
            const isIncharge = await isSectionIncharge(userId, result.sectionId.toString(), schoolId);
            if (!isIncharge) return res.status(403).json({ message: "You can only delete results for your assigned section" });
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
        res.status(500).json({ message: "Server error" });
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