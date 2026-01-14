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

// Handle file uploads similar to project controller
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

// Validate date and due date constraints
const validateDates = (date, dueDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diaryDate = new Date(date);
    diaryDate.setHours(0, 0, 0, 0);
    
    const diaryDueDate = new Date(dueDate);
    diaryDueDate.setHours(0, 0, 0, 0);
    
    if (diaryDate < today) {
        return { valid: false, message: "Diary date cannot be in the past" };
    }
    
    if (diaryDueDate <= diaryDate) {
        return { valid: false, message: "Due date must be after the diary date" };
    }
    
    return { valid: true };
};

// Create diary with images
const createDiary = async (req, res) => {
    try {
        const teacherId = req.user._id;
        const school = req.user.school;
        const teacherName = req.user.name;
        const teacherRole = req.user.role;

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
            rollNumbers = []
        } = value;

        // Validate date constraints
        const dateValidation = validateDates(date, dueDate);
        if (!dateValidation.valid) {
            return res.status(400).json({ message: dateValidation.message });
        }

        let isAuthorized = false;
        
        if (teacherRole === "superadmin" || teacherRole === "admin_office") {
            isAuthorized = true;
        } else {
            const scheduleExists = await Schedule.findOne({
                school,
                teacherId,
                classId,
                sectionId,
                subjectId
            });

            isAuthorized = !!scheduleExists;
        }

        if (!isAuthorized) {
            return res.status(403).json({
                message: "Not authorized. You are not assigned to teach this subject in the selected class/section"
            });
        }

        const classDoc = await ClassSection.findOne({
            _id: classId,
            school
        }).lean();

        if (!classDoc) {
            return res.status(404).json({
                message: "Class not found or doesn't belong to your school"
            });
        }

        const sectionExists = classDoc.sections.some(s => String(s._id) === String(sectionId));
        if (!sectionExists) {
            return res.status(404).json({
                message: "Section not found in this class"
            });
        }

        const subjectDoc = await Subject.findOne({
            _id: subjectId,
            school
        }).lean();

        if (!subjectDoc) {
            return res.status(404).json({
                message: "Subject not found or doesn't belong to your school"
            });
        }

        const uploads = await handleDiaryUploads(req.files);

        let studentIds = [];
        if (!forAll && Array.isArray(rollNumbers) && rollNumbers.length > 0) {
            const students = await User.find({
                school,
                role: "student",
                rollNo: { $in: rollNumbers },
                "classInfo.id": classId,
                "sectionInfo.id": sectionId
            }).select("_id rollNo name");

            if (students.length !== rollNumbers.length) {
                const foundRollNumbers = students.map(s => s.rollNo);
                const missing = rollNumbers.filter(r => !foundRollNumbers.includes(r));
                return res.status(400).json({
                    message: "Some students not found in this class/section",
                    missingRollNumbers: missing
                });
            }

            studentIds = students.map(s => s._id);
        }

        // Create diary
        const diary = await Diary.create({
            school,
            classId,
            sectionId,
            subjectId,
            date: formatDate(date),
            dueDate: formatDate(dueDate),
            title,
            description: description || "",
            forAll,
            studentIds,
            createdBy: teacherId,
            createdByName: teacherName,
            images: uploads.images,
            pdf: uploads.pdf
        });

        // Populate the response
        const populatedDiary = await Diary.findById(diary._id)
            .populate("classId", "class sections")
            .populate("subjectId", "name code")
            .populate("createdBy", "name email")
            .lean();

        res.status(201).json({
            message: "Diary created successfully",
            diary: {
                ...populatedDiary,
                class: populatedDiary.classId?.class || null,
                section: extractSection(populatedDiary.classId, sectionId),
                subject: populatedDiary.subjectId || null,
                teacher: populatedDiary.createdBy || null,
                images: uploads.images,
                pdf: uploads.pdf,
                classId: undefined,
                subjectId: undefined,
                createdBy: undefined
            }
        });

    } catch (err) {
        console.error("createDiary error:", err);
        res.status(500).json({
            message: err.message || "Server error",
            error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
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

        const {
            title,
            description,
            date,
            dueDate,
            forAll,
            rollNumbers,
            subjectId
        } = value;

        // Find existing diary
        const existingDiary = await Diary.findById(diaryId);
        if (!existingDiary) {
            return res.status(404).json({ message: "Diary not found" });
        }

        // Check if user is the creator
        const isCreator = String(existingDiary.createdBy) === String(teacherId);

        // For non-creators, only admin can update
        if (!isCreator && teacherRole !== "superadmin" && teacherRole !== "admin_office") {
            return res.status(403).json({
                message: "Access denied: Only the creator or admin can update this diary"
            });
        }

        // If creator, check if they still have schedule permission for the updated subject
        if (isCreator && teacherRole !== "superadmin" && teacherRole !== "admin_office") {
            const finalSubjectId = subjectId || existingDiary.subjectId;
            const scheduleExists = await Schedule.findOne({
                school,
                teacherId,
                classId: existingDiary.classId,
                sectionId: existingDiary.sectionId,
                subjectId: finalSubjectId
            });

            if (!scheduleExists) {
                return res.status(403).json({
                    message: "You are no longer assigned to teach this subject in this class/section"
                });
            }
        }

        // Validate dates if being updated
        if (date || dueDate) {
            const finalDate = date || existingDiary.date;
            const finalDueDate = dueDate || existingDiary.dueDate;
            
            const dateValidation = validateDates(finalDate, finalDueDate);
            if (!dateValidation.valid) {
                return res.status(400).json({ message: dateValidation.message });
            }
        }

        // Validate subject if being updated
        if (subjectId && subjectId !== String(existingDiary.subjectId)) {
            const subjectDoc = await Subject.findOne({
                _id: subjectId,
                school
            });

            if (!subjectDoc) {
                return res.status(404).json({
                    message: "Subject not found or doesn't belong to your school"
                });
            }
            existingDiary.subjectId = subjectId;
        }

        // Handle file uploads
        const uploads = await handleDiaryUploads(req.files, {
            images: existingDiary.images,
            pdf: existingDiary.pdf
        });

        // Update fields
        if (title !== undefined) existingDiary.title = title;
        if (description !== undefined) existingDiary.description = description;
        if (date) existingDiary.date = formatDate(date);
        if (dueDate) existingDiary.dueDate = formatDate(dueDate);
        if (forAll !== undefined) existingDiary.forAll = forAll;

        // Update student IDs if not for all
        if (forAll === false && Array.isArray(rollNumbers)) {
            const students = await User.find({
                school,
                role: "student",
                rollNo: { $in: rollNumbers },
                "classInfo.id": existingDiary.classId,
                "sectionInfo.id": existingDiary.sectionId
            }).select("_id rollNo name");

            if (students.length !== rollNumbers.length) {
                const foundRollNumbers = students.map(s => s.rollNo);
                const missing = rollNumbers.filter(r => !foundRollNumbers.includes(r));
                return res.status(400).json({
                    message: "Some students not found",
                    missingRollNumbers: missing
                });
            }

            existingDiary.studentIds = students.map(s => s._id);
        } else if (forAll === true) {
            existingDiary.studentIds = [];
        }

        // Update images and PDF
        if (uploads.images.length > 0) {
            existingDiary.images = uploads.images;
        }
        if (uploads.pdf !== undefined) {
            existingDiary.pdf = uploads.pdf;
        }

        await existingDiary.save();

        res.status(200).json({
            message: "Diary updated successfully",
            diary: existingDiary
        });

    } catch (err) {
        console.error("updateDiary error:", err);
        res.status(500).json({
            message: err.message || "Server error",
            error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};

// Get diary by section with filters
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