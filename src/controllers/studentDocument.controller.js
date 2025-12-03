const StudentDocument = require("../models/StudentDocument");
const User = require("../models/User");
const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");

// Upload multiple files
async function handleFilesUpload(files) {
    if (!files || files.length === 0) return [];
    const uploadedFiles = [];
    for (const file of files) {
        const uploaded = await uploadFileToS3({
            fileBuffer: file.buffer,
            fileName: file.originalname,
            mimeType: file.mimetype,
        });
        uploadedFiles.push(uploaded);
    }
    return uploadedFiles;
}

// STUDENT: Upload Document
const uploadDocument = async (req, res) => {
    try {
        const { studentId, classId, sectionId, text, uploadedFor } = req.body;

        if (!studentId || !classId || !sectionId) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const student = await User.findById(studentId);
        if (!student || student.role !== "student") {
            return res.status(404).json({ message: "Student not found" });
        }

        if (
            !student.classInfo?.id ||
            student.classInfo.id.toString() !== classId ||
            !student.sectionInfo?.id ||
            student.sectionInfo.id.toString() !== sectionId
        ) {
            return res.status(400).json({ message: "Student not in this class or section" });
        }

        let files = [];
        if (req.files && req.files.length > 0) {
            files = await handleFilesUpload(req.files);
        }

        const document = await StudentDocument.create({ studentId, classId, sectionId, text, uploadedFor, files });

        res.status(201).json({ message: "Document uploaded", document });
    } catch (err) {
        console.error("Upload Document Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// UPDATE Document
const updateDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { text, uploadedFor } = req.body;

        const document = await StudentDocument.findById(id);
        if (!document) return res.status(404).json({ message: "Document not found" });

        if (req.files && req.files.length > 0) {
            if (document.files && document.files.length > 0) {
                for (const file of document.files) await deleteFileFromS3(file);
            }
            document.files = await handleFilesUpload(req.files);
        }

        if (text) document.text = text;
        if (uploadedFor) document.uploadedFor = uploadedFor;

        await document.save();

        res.status(200).json({ message: "Document updated", document });
    } catch (err) {
        console.error("Update Document Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// DELETE Document
const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;

        const document = await StudentDocument.findById(id);
        if (!document) return res.status(404).json({ message: "Document not found" });

        if (document.files && document.files.length > 0) {
            for (const file of document.files) await deleteFileFromS3(file);
        }

        await document.deleteOne();

        res.status(200).json({ message: "Document deleted" });
    } catch (err) {
        console.error("Delete Document Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET documents (Admin / Teacher)
const getDocuments = async (req, res) => {
    try {
        const { classId, sectionId, studentId, teacher, admin, page = 1, limit = 10 } = req.query;
        const filter = {};

        if (teacher === "true") {
            filter.uploadedFor = "teacher";
        }

        else if (admin === "true") {
            filter.uploadedFor = "admin_office";
        }

        else if (req.user.role === "teacher") {
            if (!classId || !sectionId) {
                return res.status(400).json({
                    message: "Teacher must provide classId & sectionId"
                });
            }
            filter.classId = classId;
            filter.sectionId = sectionId;
        }

        if (studentId) filter.studentId = studentId;
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;

        const skip = (page - 1) * limit;

        const documents = await StudentDocument.find(filter)
            .populate("studentId", "name email")
            .populate("classId", "class sections")
            .populate("sectionId", "section")
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });

        const total = await StudentDocument.countDocuments(filter);

        res.status(200).json({
            total,
            page: Number(page),
            totalPages: Math.ceil(total / limit),
            documents,
        });

    } catch (err) {
        console.error("Get Documents Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET student own documents
const getStudentDocuments = async (req, res) => {
    try {
        const studentId = req.user._id;
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const documents = await StudentDocument.find({ studentId })
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });

        const total = await StudentDocument.countDocuments({ studentId });

        res.status(200).json({
            total,
            page: Number(page),
            totalPages: Math.ceil(total / limit),
            documents,
        });
    } catch (err) {
        console.error("Get Student Documents Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

module.exports = {
    uploadDocument,
    updateDocument,
    deleteDocument,
    getDocuments,
    getStudentDocuments,
};
