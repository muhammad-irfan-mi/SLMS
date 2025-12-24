const Syllabus = require("../models/Syllabus");
const ClassSection = require("../models/ClassSection");
const Subject = require("../models/Subject");
const User = require("../models/User");
const School = require("../models/School");

const formatDate = (d) => {
    const D = new Date(d);
    return `${D.getFullYear()}-${String(D.getMonth() + 1).padStart(2, "0")}-${String(D.getDate()).padStart(2, "0")}`;
};

const resolveUploader = async (uploadedBy) => {
    if (!uploadedBy) return null;

    const user = await User.findById(uploadedBy)
        .select("name role")
        .lean();

    if (user) {
        return {
            _id: user._id,
            name: user.name,
            type: "user",
            role: user.role
        };
    }

    const school = await School.findById(uploadedBy)
        .select("name")
        .lean();

    if (school) {
        return {
            _id: school._id,
            name: school.name,
            type: "school"
        };
    }

    return null;
};

const extractSection = (classObj, sectionId) => {
    const sec = classObj?.sections?.find(
        s => s._id.toString() === sectionId.toString()
    );
    return sec ? { _id: sec._id, name: sec.name } : null;
};

const normalizePagination = (query) => {
    const page = Math.max(parseInt(query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    return { page, limit, skip };
};

// CREATE
const createSyllabus = async (req, res) => {
    try {
        const school = req.user.school;
        const uploader = req.user._id;

        const {
            classId,
            sectionId,
            subjectId,
            title,
            description,
            detail,
            publishDate,
            expireDate,
            status
        } = req.body;

        const [classDoc, subject] = await Promise.all([
            ClassSection.findById(classId),
            Subject.findById(subjectId),
        ]);

        if (!classDoc) return res.status(404).json({ message: "Class not found" });
        if (!subject) return res.status(404).json({ message: "Subject not found" });

        if (String(subject.class) !== String(classId)) {
            return res.status(400).json({ message: "Subject not assigned to class" });
        }

        const syllabus = await Syllabus.create({
            school,
            classId,
            sectionId,
            subjectId,
            title,
            description,
            detail,
            uploadedBy: uploader,
            publishDate: publishDate ? formatDate(publishDate) : undefined,
            expireDate: expireDate ? formatDate(expireDate) : undefined,
            status: status || "draft",
        });

        res.status(201).json({ message: "Syllabus created", syllabus });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET (FILTER + PAGINATION)
const getSyllabus = async (req, res) => {
    try {
        const school = req.user.school;
        const { classId, sectionId, subjectId, status } = req.query;
        const { page, limit, skip } = normalizePagination(req.query);

        const filter = { school };
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;
        if (subjectId) filter.subjectId = subjectId;
        if (status) filter.status = status;

        const [total, rows] = await Promise.all([
            Syllabus.countDocuments(filter),
            Syllabus.find(filter)
                .populate("subjectId", "name code")
                .populate("classId", "class sections")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        // resolve uploader for each row
        const syllabus = await Promise.all(
            rows.map(async (item) => {
                const uploader = await resolveUploader(item.uploadedBy);

                return {
                    _id: item._id,
                    title: item.title,
                    description: item.description,
                    detail: item.detail,
                    publishDate: item.publishDate,
                    expireDate: item.expireDate,
                    status: item.status,
                    subject: item.subjectId,

                    uploadedBy: uploader,

                    class: item.classId
                        ? { _id: item.classId._id, name: item.classId.class }
                        : null,

                    section: extractSection(item.classId, item.sectionId),
                    createdAt: item.createdAt
                };
            })
        );

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            syllabus
        });

    } catch (err) {
        console.error("getSyllabus error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// GET BY SECTION (STUDENT)
const getSyllabusBySection = async (req, res) => {
    try {
        const school = req.user.school;
        const { sectionId } = req.params;
        const { status } = req.query;
        const { page, limit, skip } = normalizePagination(req.query);

        const filter = {
            school,
            sectionId,
            status: status || "published"
        };

        const [total, rows] = await Promise.all([
            Syllabus.countDocuments(filter),
            Syllabus.find(filter)
                .populate("subjectId", "name code")
                .populate("classId", "class sections")
                .sort({ publishDate: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const syllabus = await Promise.all(
            rows.map(async (item) => {
                const uploader = await resolveUploader(item.uploadedBy);

                return {
                    _id: item._id,
                    title: item.title,
                    description: item.description,
                    detail: item.detail,
                    publishDate: item.publishDate,
                    expireDate: item.expireDate,
                    subject: item.subjectId,

                    uploadedBy: uploader,

                    class: item.classId
                        ? { _id: item.classId._id, name: item.classId.class }
                        : null,

                    section: extractSection(item.classId, item.sectionId)
                };
            })
        );

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            syllabus
        });

    } catch (err) {
        console.error("getSyllabusBySection error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// UPDATE
const updateSyllabus = async (req, res) => {
    const updated = await Syllabus.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Syllabus not found" });
    res.json({ message: "Syllabus updated", syllabus: updated });
};

// DELETE
const deleteSyllabus = async (req, res) => {
    const deleted = await Syllabus.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Syllabus not found" });
    res.json({ message: "Syllabus deleted" });
};

module.exports = {
    createSyllabus,
    getSyllabus,
    getSyllabusBySection,
    updateSyllabus,
    deleteSyllabus
};