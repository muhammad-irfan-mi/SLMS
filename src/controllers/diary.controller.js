const User = require("../models/User");
const ClassSection = require("../models/ClassSection");
const Subject = require("../models/Subject");
const Schedule = require("../models/Schedule");
const Diary = require("../models/diary");
const { deleteFileFromS3, uploadFileToS3 } = require("../services/s3.service");
const {
    createDiarySchema,
    updateDiarySchema,
    getDiaryQuerySchema
} = require("../validators/diary.validation");
const { sendDiaryNotification } = require("../utils/notificationService");

const formatDate = (date) => {
    const d = date ? new Date(date) : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const extractSection = (classObj, sectionId) => {
    if (!classObj?.sections) return null;
    const section = classObj.sections.find(
        (s) => s._id.toString() === sectionId.toString()
    );
    return section ? { _id: section._id, name: section.name } : null;
};

// Handle file uploads
async function handleDiaryUploads(files, existing = {}) {
    let images = existing.images || [];
    let pdf = existing.pdf || null;

    if (files?.images) {
        for (const img of images) {
            await deleteFileFromS3(img);
        }
        images = [];

        for (const file of files.images.slice(0, 2)) {
            const uploaded = await uploadFileToS3({
                fileBuffer: file.buffer,
                fileName: file.originalname,
                mimeType: file.mimetype,
            });
            images.push(uploaded);
        }
    }

    if (files?.pdf?.[0]) {
        if (pdf) await deleteFileFromS3(pdf);
        pdf = await uploadFileToS3({
            fileBuffer: files.pdf[0].buffer,
            fileName: files.pdf[0].originalname,
            mimeType: files.pdf[0].mimetype,
        });
    }

    return { images, pdf };
}

// Create diary with images
const createDiary = async (req, res) => {
    try {
        const teacherId = req.user._id;
        const school = req.user.school;
        const teacherName = req.user.name;

        const { error, value } = createDiarySchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                message: "Validation error",
                details: error.details.map(d => d.message)
            });
        }

        const {
            classId,
            sectionId,
            subjectId,
            title,
            description,
            date,
            dueDate,
            forAll = true,
            studentIds = []
        } = value;


        const scheduleExists = await Schedule.findOne({
            school,
            teacherId,
            classId,
            sectionId,
            subjectId
        });

        if (!scheduleExists) {
            return res.status(403).json({
                message: "Not authorized to create diary for this subject"
            });
        }

        const classDoc = await ClassSection.findOne({ _id: classId, school }).lean();
        if (!classDoc) {
            return res.status(404).json({ message: "Class not found" });
        }

        const sectionExists = classDoc.sections.some(
            s => String(s._id) === String(sectionId)
        );
        if (!sectionExists) {
            return res.status(404).json({ message: "Section not found" });
        }

        const subjectDoc = await Subject.findOne({ _id: subjectId, school });
        if (!subjectDoc) {
            return res.status(404).json({ message: "Subject not found" });
        }

        let finalStudentIds = [];

        if (!forAll) {
            if (!Array.isArray(studentIds) || studentIds.length === 0) {
                return res.status(400).json({
                    message: "studentIds are required when forAll is false"
                });
            }

            const students = await User.find({
                _id: { $in: studentIds },
                school,
                role: "student",
                "classInfo.id": classId,
                "sectionInfo.id": sectionId
            }).select("_id");

            if (students.length !== studentIds.length) {
                return res.status(400).json({
                    message: "Some students do not belong to this class/section"
                });
            }

            finalStudentIds = students.map(s => s._id);
        }

        const uploads = await handleDiaryUploads(req.files);

        const diary = await Diary.create({
            school,
            classId,
            sectionId,
            subjectId,
            date,
            dueDate,
            title,
            description,
            forAll,
            studentIds: forAll ? [] : finalStudentIds,
            createdBy: teacherId,
            createdByName: teacherName,
            images: uploads.images,
            pdf: uploads.pdf
        });

        const notification = await sendDiaryNotification({
            diary: diary,
            actor: req.user,
            action: 'creation',
            targetStudentIds: finalStudentIds
        });

        return res.status(201).json({
            message: "Diary created successfully",
            diary
        });

    } catch (err) {
        console.error("createDiary error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const updateDiary = async (req, res) => {
    try {
        const { diaryId } = req.params;
        const teacherId = req.user._id;
        const school = req.user.school;
        const teacherRole = req.user.role;

        const { error, value } = updateDiarySchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                message: "Validation error",
                details: error.details.map(d => d.message)
            });
        }

        const { title, description, date, dueDate, forAll, studentIds } = value;

        const diary = await Diary.findById(diaryId);
        if (!diary) {
            return res.status(404).json({ message: "Diary not found" });
        }

        const isCreator = String(diary.createdBy) === String(teacherId);

        if (!isCreator && !["superadmin", "admin_office"].includes(teacherRole)) {
            return res.status(403).json({
                message: "You are not allowed to update this diary"
            });
        }

        if (title !== undefined) diary.title = title;
        if (description !== undefined) diary.description = description;
        if (date) diary.date = date;
        if (dueDate) diary.dueDate = dueDate;

        if (forAll !== undefined) {
            diary.forAll = forAll;

            if (forAll === true) {
                diary.studentIds = [];
            }
        }

        if (forAll === false && Array.isArray(studentIds)) {
            const students = await User.find({
                _id: { $in: studentIds },
                school,
                role: "student",
                "classInfo.id": diary.classId,
                "sectionInfo.id": diary.sectionId
            }).select("_id");

            if (students.length !== studentIds.length) {
                return res.status(400).json({
                    message: "Some students are invalid"
                });
            }

            diary.studentIds = students.map(s => s._id);
        }

        const uploads = await handleDiaryUploads(req.files, {
            images: diary.images,
            pdf: diary.pdf
        });

        if (uploads.images.length > 0) diary.images = uploads.images;
        if (uploads.pdf !== undefined) diary.pdf = uploads.pdf;

        await diary.save();

        const notification = await sendDiaryNotification({
            diary: diary,
            actor: req.user,
            action: 'update'
        });

        return res.status(200).json({
            message: "Diary updated successfully",
            diary
        });

    } catch (err) {
        console.error("updateDiary error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getDiaryBySection = async (req, res) => {
    try {
        const { sectionId } = req.params;
        const school = req.user.school;
        const user = req.user;

        const { error, value } = getDiaryQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                message: "Validation error",
                details: error.details.map(d => d.message)
            });
        }

        const {
            date,
            startDate,
            endDate,
            active,
            page = 1,
            limit = 10,
            subjectId,
            classId
        } = value;

        const skip = (page - 1) * limit;

        let filter = { school, sectionId };

        if (classId) {
            filter.classId = classId;
        }

        if (subjectId) {
            filter.subjectId = subjectId;
        }

        if (date) {
            filter.date = date;
        } else if (startDate && endDate) {
            filter.date = { $gte: startDate, $lte: endDate };
        }

        if (user.role === "student") {
            filter.$or = [
                { forAll: true },
                { studentIds: user._id }
            ];
        }

        if (user.role === "teacher") {
            const hasSchedule = await Schedule.findOne({
                school,
                teacherId: user._id,
                sectionId
            });

            if (!hasSchedule && user.role !== "superadmin" && user.role !== "admin_office") {
                return res.status(403).json({
                    message: "You don't have access to this section's diary"
                });
            }
        }

        const total = await Diary.countDocuments(filter);

        let diaries = await Diary.find(filter)
            .populate("classId", "class sections")
            .populate("subjectId", "name code")
            .populate("createdBy", "name email")
            .sort({ date: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        diaries = diaries.map((d) => ({
            _id: d._id,
            school: d.school,
            class: d.classId?.class || null,
            section: extractSection(d.classId, sectionId),
            subject: d.subjectId || null,
            teacher: d.createdBy || null,
            date: d.date,
            dueDate: d.dueDate,
            title: d.title,
            description: d.description,
            forAll: d.forAll,
            studentIds: d.studentIds,
            images: d.images || [],
            pdf: d.pdf,
            createdByName: d.createdByName,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt
        }));

        if (active === "true") {
            const today = new Date();
            diaries = diaries.filter(d => {
                if (!d.dueDate) return false;
                const dueDate = new Date(d.dueDate);
                return dueDate >= today;
            });
        }

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            diaries
        });

    } catch (err) {
        console.error("getDiaryBySection error:", err);
        res.status(500).json({
            message: err.message || "Server error"
        });
    }
};

// Get student diary
const getStudentDiary = async (req, res) => {
    try {
        const student = req.user;
        const school = student.school;
        const studentId = student._id;
        const classId = student.classInfo?.id;
        const sectionId = student.sectionInfo?.id;

        if (!classId || !sectionId) {
            return res.status(400).json({
                message: "Student not assigned to any class or section"
            });
        }

        const { error, value } = getDiaryQuerySchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                message: "Validation error",
                details: error.details.map(d => d.message)
            });
        }

        const {
            date,
            startDate,
            endDate,
            active,
            page = 1,
            limit = 10,
            subjectId
        } = value;

        const skip = (page - 1) * limit;

        const filter = {
            school,
            classId,
            sectionId,
            $or: [
                { forAll: true },
                { studentIds: studentId }
            ]
        };

        if (subjectId) {
            filter.subjectId = subjectId;
        }

        if (date) {
            filter.date = date;
        } else if (startDate && endDate) {
            filter.date = { $gte: startDate, $lte: endDate };
        }

        const total = await Diary.countDocuments(filter);

        let diaries = await Diary.find(filter)
            .populate("classId", "class sections")
            .populate("subjectId", "name code")
            .populate("createdBy", "name email")
            .sort({ date: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        diaries = diaries.map((d) => ({
            _id: d._id,
            school: d.school,
            class: d.classId?.class || null,
            section: extractSection(d.classId, sectionId),
            subject: d.subjectId || null,
            teacher: d.createdBy || null,
            date: d.date,
            dueDate: d.dueDate,
            title: d.title,
            description: d.description,
            forAll: d.forAll,
            images: d.images || [],
            pdf: d.pdf,
            createdByName: d.createdByName,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt
        }));

        // Filter active diaries if requested
        if (active === "true") {
            const today = new Date();
            diaries = diaries.filter(d => {
                if (!d.dueDate) return false;
                const dueDate = new Date(d.dueDate);
                return dueDate >= today;
            });
        }

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            diaries
        });

    } catch (err) {
        console.error("getStudentDiary error:", err);
        res.status(500).json({
            message: err.message || "Server error"
        });
    }
};

// Delete diary
const deleteDiary = async (req, res) => {
    try {
        const { diaryId } = req.params;
        const teacherId = req.user._id;
        const teacherRole = req.user.role;

        const existingDiary = await Diary.findById(diaryId);
        if (!existingDiary) {
            return res.status(404).json({ message: "Diary not found" });
        }

        const isCreator = String(existingDiary.createdBy) === String(teacherId);

        if (!isCreator && teacherRole !== "superadmin" && teacherRole !== "admin_office") {
            return res.status(403).json({
                message: "Access denied: Only creator or admin can delete this diary"
            });
        }

        if (existingDiary.images && existingDiary.images.length > 0) {
            for (const img of existingDiary.images) {
                await deleteFileFromS3(img);
            }
        }
        if (existingDiary.pdf) {
            await deleteFileFromS3(existingDiary.pdf);
        }

        await existingDiary.deleteOne();

        res.status(200).json({ message: "Diary deleted successfully" });

    } catch (err) {
        console.error("deleteDiary error:", err);
        res.status(500).json({
            message: err.message || "Server error",
            error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};

module.exports = {
    createDiary,
    updateDiary,
    getDiaryBySection,
    getStudentDiary,
    deleteDiary
};