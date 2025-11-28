const Result = require("../models/Result");
const Subject = require("../models/Subject");
const User = require("../models/User");
const ClassSection = require("../models/ClassSection");
const ExamSchedule = require("../models/ExamSchedule");

// Add Result
const addResult = async (req, res) => {
    try {
        const { studentId, classId, sectionId, subjectId, examType, year, marksObtained, totalMarks } = req.body;
        const schoolId = req.user.school;

        if (!studentId || !classId || !sectionId || !subjectId || !examType || !year || !marksObtained || !totalMarks)
            return res.status(400).json({ message: "Missing required fields" });

        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ message: "Student not found" });
        if (student.role !== "student") return res.status(400).json({ message: "This is not a student" });

        if (!student?.classInfo?.id || !student?.sectionInfo?.id) {
            return res.status(400).json({ message: "Student missing class or section assignment" });
        }

        if (student?.classInfo?.id.toString() !== classId || student?.sectionInfo?.id.toString() !== sectionId) {
            return res.status(400).json({ message: "Student not in this class or section" });
        }
        const subject = await Subject.findById(subjectId);
        if (!subject) return res.status(404).json({ message: "Subject not found" });

        if (
            subject.class.toString() !== classId.toString() ||
            subject.sectionId.toString() !== sectionId.toString()
        ) {
            return res.status(400).json({ message: "Subject not assigned to this class & section" });
        }

        const examExists = await ExamSchedule.findOne({
            school: schoolId,
            classId,
            sectionId,
            subjectId,
            type: examType,
            year,
        });

        if (!examExists)
            return res.status(400).json({
                message: `Exam schedule not found. You must add ${examType} exam for ${year} before adding result.`,
            });

        const already = await Result.findOne({
            school: schoolId,
            studentId,
            subjectId,
            examType,
            year,
        });

        if (already)
            return res.status(400).json({
                message: "Result already added for this student for this subject in this exam.",
            });

        const newResult = await Result.create({
            school: schoolId,
            studentId,
            classId,
            sectionId,
            subjectId,
            examType,
            year,
            marksObtained,
            totalMarks,
        });

        res.status(201).json({ message: "Result added successfully", result: newResult });

    } catch (err) {
        console.error("Add result error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Update Result
const updateResult = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.school;

        const result = await Result.findById(id);
        if (!result) return res.status(404).json({ message: "Result not found" });

        const updatedData = req.body;
        const { studentId, classId, sectionId, subjectId, examType, year } = {
            ...result.toObject(),
            ...updatedData,
        };

        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ message: "Student not found" });

        if (student.classId.toString() !== classId.toString() || student.sectionId.toString() !== sectionId.toString())
            return res.status(400).json({ message: "Student not in this class or section" });

        const subject = await Subject.findById(subjectId);
        if (!subject) return res.status(404).json({ message: "Subject not found" });

        if (subject.class.toString() !== classId.toString() || subject.sectionId.toString() !== sectionId.toString()) {
            return res.status(400).json({ message: "Subject not assigned to this class & section" });
        }

        const examExists = await ExamSchedule.findOne({
            school: schoolId,
            classId,
            sectionId,
            subjectId,
            type: examType,
            year,
        });

        if (!examExists)
            return res.status(400).json({
                message: `Exam schedule not found, cannot update result.`,
            });

        const other = await Result.findOne({
            _id: { $ne: id },
            school: schoolId,
            studentId,
            subjectId,
            examType,
            year,
        });

        if (other)
            return res.status(400).json({ message: "Result already exists for this subject and exam." });

        const updated = await Result.findByIdAndUpdate(id, { $set: updatedData }, { new: true });

        res.status(200).json({ message: "Result updated", result: updated });

    } catch (err) {
        console.error("Update result error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get results (Admin + Teacher + Student with filters)
const getResults = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const { studentId, classId, sectionId, subjectId, examType, year, page = 1, limit = 10 } = req.query;

        const filter = { school: schoolId };

        if (studentId) filter.studentId = studentId;
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;
        if (subjectId) filter.subjectId = subjectId;
        if (examType) filter.examType = examType;
        if (year) filter.year = year;

        const skip = (page - 1) * limit;

        const results = await Result.find(filter)
            .populate("studentId", "name email rollNo")
            .populate("subjectId", "name code")
            .populate("classId", "class sections")
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
        console.error("Get results error:", err);
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
        })
            .populate("subjectId", "name code")
            .populate("classId", "class");

        res.status(200).json({ total: results.length, results });

    } catch (err) {
        console.error("Student result error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Delete result
const deleteResult = async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await Result.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ message: "Result not found" });

        res.status(200).json({ message: "Result deleted successfully" });

    } catch (err) {
        console.error("Delete result error:", err);
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
