const Result = require("../models/Result");
const Subject = require("../models/Subject");
const User = require("../models/User");
const ClassSection = require("../models/ClassSection");
const ExamSchedule = require("../models/ExamSchedule");
const { deleteFileFromS3, uploadFileToS3 } = require("../services/s3.service");

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

// Add Result
const addResult = async (req, res) => {
    try {
        const {
            studentId,
            classId,
            sectionId,
            marksObtained,
            totalMarks,
            position,
            examType,
            year
        } = req.body;

        const schoolId = req.user.school;

        if (
            !studentId ||
            !classId ||
            !sectionId ||
            !marksObtained ||
            !totalMarks ||
            !position ||
            !examType ||
            !year
        ) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // ---- Check Student ----
        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ message: "Student not found" });
        if (student.role !== "student") return res.status(400).json({ message: "This is not a student" });

        if (!student.classInfo?.id || !student.sectionInfo?.id)
            return res.status(400).json({ message: "Student missing class or section" });

        // ---- Match class + section ----
        if (student.classInfo.id.toString() !== classId) {
            return res.status(400).json({ message: "Student not in this class" });
        }
        if (student.sectionInfo.id.toString() !== sectionId) {
            return res.status(400).json({ message: "Student not in this section" });
        }

        // ---- Check Duplicate Result ----
        const already = await Result.findOne({
            school: schoolId,
            studentId,
            classId,
            sectionId,
            examType,
            year
        });

        if (already) {
            return res.status(400).json({ message: "Result already exists for this student" });
        }

        // ---- Upload Image ----
        let image = null;
        if (req.file) {
            image = await handleResultImageUpload(req.file);
        }

        // ---- Create Result ----
        const newResult = await Result.create({
            school: schoolId,
            studentId,
            classId,
            sectionId,
            marksObtained,
            totalMarks,
            position,
            examType,
            year,
            image
        });

        res.status(201).json({
            message: "Result added successfully",
            result: newResult
        });

    } catch (err) {
        console.error("Add Result Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Update Result
const updateResult = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await Result.findById(id);
        if (!result) return res.status(404).json({ message: "Result not found" });

        const updatedData = req.body;

        // Replace image if new uploaded
        if (req.file) {
            const newImage = await handleResultImageUpload(req.file, result.image);
            updatedData.image = newImage;
        }

        const updated = await Result.findByIdAndUpdate(id, { $set: updatedData }, { new: true });

        res.status(200).json({ message: "Result updated", result: updated });

    } catch (err) {
        console.error("Update Result Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get results (Admin + Teacher + Student with filters)
const getResults = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const { studentId, classId, sectionId, examType, year, page = 1, limit = 10 } = req.query;

        const filter = { school: schoolId };

        if (studentId) filter.studentId = studentId;
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;
        if (examType) filter.examType = examType;
        if (year) filter.year = year;

        const skip = (page - 1) * limit;

        const results = await Result.find(filter)
            .populate("studentId", "name email rollNo")
            .populate("classId", "class section")
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });

        const total = await Result.countDocuments(filter);

        res.status(200).json({
            total,
            page: Number(page),
            totalPages: Math.ceil(total / limit),
            results,
        });

    } catch (err) {
        console.error("Get Results Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Student-only
const getStudentResults = async (req, res) => {
    try {
        const student = req.user;

        const results = await Result.find({
            studentId: student._id,
            school: student.school,
        });

        res.status(200).json({ total: results.length, results });

    } catch (err) {
        console.error("Student Results Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Delete result
const deleteResult = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await Result.findById(id);
        if (!result) return res.status(404).json({ message: "Result not found" });

        if (result.image) {
            await deleteFileFromS3(result.image);
        }

        await result.deleteOne();

        res.status(200).json({ message: "Result deleted successfully" });

    } catch (err) {
        console.error("Delete Result Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

module.exports = {
    addResult,
    updateResult,
    getResults,
    getStudentResults,
    deleteResult,
};
