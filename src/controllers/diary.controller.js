const User = require("../models/User");
const ClassSection = require("../models/ClassSection");
const Subject = require("../models/Subject");
const Schedule = require("../models/Schedule");
const mongoose = require("mongoose");
const Diary = require("../models/diary");

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


const createDiary = async (req, res) => {
    try {
        const {
            classId,
            sectionId,
            subjectId,
            title,
            description,
            date,
            dueDate,
            forAll,
            rollNumbers,
        } = req.body;

        const teacherId = req.user._id;
        const school = req.user.school;

        if (!classId || !sectionId || !subjectId || !title || !date || !dueDate)
            return res.status(400).json({ message: "All required fields must be filled" });

        const classDoc = await ClassSection.findById(classId).lean();
        if (!classDoc) return res.status(404).json({ message: "Class not found" });

        const section = classDoc.sections.find((s) => String(s._id) === String(sectionId));
        if (!section) return res.status(404).json({ message: "Section not found" });

        const subjectDoc = await Subject.findById(subjectId).lean();
        const teacher = await User.findById(teacherId).lean();
        if (!subjectDoc) return res.status(404).json({ message: "Invalid subject ID" });

        const schedule = await Schedule.findOne({
            school,
            teacherId,
            classId: classId,
            sectionId,
            subjectId,
        });

        if (!schedule) {
            return res.status(403).json({
                message: "You are not assigned to this class/section/subject in schedule. Cannot create diary.",
            });
        }

        let studentIds = [];
        if (!forAll && Array.isArray(rollNumbers) && rollNumbers.length > 0) {
            const students = await User.find({
                school,
                role: "student",
                rollNo: { $in: rollNumbers },
                "classInfo.id": classId,
                "sectionInfo.id": sectionId,
            }).select("_id");

            if (!students.length) {
                return res.status(404).json({ message: "No students found for provided roll numbers" });
            }

            studentIds = students.map((s) => s._id);
        }

        const diary = await Diary.create({
            school,
            classId,
            sectionId,
            subjectId,
            date: formatDate(date),
            dueDate: formatDate(dueDate),
            title,
            description,
            forAll: !!forAll,
            studentIds,
            createdBy: teacherId,
            createdByName: teacher?.name || "Unknown",
        });

        res.status(201).json({ message: "Diary created successfully", diary });
    } catch (err) {
        console.error("createDiary error:", err);
        res.status(500).json({ message: err.message || "Server error" });
    }
};

const updateDiary = async (req, res) => {
    try {
        const { diaryId } = req.params;
        const {
            title,
            description,
            date,
            dueDate,
            forAll,
            rollNumbers,
        } = req.body;

        const teacherId = req.user._id;
        const school = req.user.school;

        const existingDiary = await Diary.findById(diaryId);
        if (!existingDiary)
            return res.status(404).json({ message: "Diary not found" });

        if (
            String(existingDiary.createdBy) !== String(teacherId) &&
            req.user.role !== "superadmin"
        ) {
            return res.status(403).json({
                message: "Access denied: You are not allowed to edit this diary",
            });
        }

        if (title) existingDiary.title = title;
        if (description) existingDiary.description = description;
        if (date) existingDiary.date = formatDate(date);
        if (dueDate) existingDiary.dueDate = formatDate(dueDate);
        if (forAll !== undefined) existingDiary.forAll = !!forAll;

        if (!forAll && Array.isArray(rollNumbers) && rollNumbers.length > 0) {
            const students = await User.find({
                school,
                role: "student",
                rollNo: { $in: rollNumbers },
                "classInfo.id": existingDiary.classId,
                "sectionInfo.id": existingDiary.sectionId,
            }).select("_id");

            existingDiary.studentIds = students.map((s) => s._id);
        } else if (forAll) {
            existingDiary.studentIds = [];
        }

        await existingDiary.save();

        res.status(200).json({ message: "Diary updated successfully", diary: existingDiary });
    } catch (err) {
        console.error("updateDiary error:", err);
        res.status(500).json({ message: err.message || "Server error" });
    }
};

const getDiaryBySection = async (req, res) => {
    try {
        const { sectionId } = req.params;
        const { date, startDate, endDate, active } = req.query;
        const school = req.user.school;
        const user = req.user;

        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.max(Number(req.query.limit) || 10, 1);
        const skip = (page - 1) * limit;

        let filter = { school, sectionId };

        if (date) filter.date = date;
        else if (startDate && endDate)
            filter.date = { $gte: startDate, $lte: endDate };

        if (user.role === "student") {
            filter.$or = [{ forAll: true }, { studentIds: user._id }];
        }

        const total = await Diary.countDocuments(filter);

        let diaries = await Diary.find(filter)
            .populate("classId", "class sections")
            .populate("subjectId", "name code")
            .populate("createdBy", "name email")
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        diaries = diaries.map((d) => ({
            ...d,
            class: d.classId?.class || null,
            section: extractSection(d.classId, sectionId),
            subject: d.subjectId || null,
            teacher: d.createdBy || null,
            classId: undefined,
            subjectId: undefined,
            createdBy: undefined
        }));

        if (active === "true") {
            const today = new Date();
            diaries = diaries.filter(
                (d) => d.dueDate && new Date(d.dueDate) >= today
            );
        }

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            diaries
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getStudentDiary = async (req, res) => {
    try {
        const student = req.user;
        const sectionId = student.sectionInfo?.id;

        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.max(Number(req.query.limit) || 10, 1);
        const skip = (page - 1) * limit;

        const filter = {
            school: student.school,
            $or: [
                { classId: student.classInfo.id, sectionId, forAll: true },
                { studentIds: student._id }
            ]
        };

        const total = await Diary.countDocuments(filter);

        let diaries = await Diary.find(filter)
            .populate("classId", "class sections")
            .populate("subjectId", "name code")
            .populate("createdBy", "name email")
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        diaries = diaries.map((d) => ({
            ...d,
            class: d.classId?.class || null,
            section: extractSection(d.classId, sectionId),
            subject: d.subjectId || null,
            teacher: d.createdBy || null,
            classId: undefined
        }));

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            diaries
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const deleteDiary = async (req, res) => {
    try {
        const { diaryId } = req.params;
        const teacherId = req.user._id;

        const existingDiary = await Diary.findById(diaryId);
        if (!existingDiary)
            return res.status(404).json({ message: "Diary not found" });

        if (
            String(existingDiary.createdBy) !== String(teacherId) &&
            req.user.role !== "superadmin"
        ) {
            return res.status(403).json({
                message: "Access denied: You are not allowed to delete this diary",
            });
        }

        await existingDiary.deleteOne();

        res.status(200).json({ message: "Diary deleted successfully" });
    } catch (err) {
        console.error("deleteDiary error:", err);
        res.status(500).json({ message: err.message || "Server error" });
    }
};

module.exports = {
    createDiary,
    updateDiary,
    getDiaryBySection,
    getStudentDiary,
    deleteDiary
};
