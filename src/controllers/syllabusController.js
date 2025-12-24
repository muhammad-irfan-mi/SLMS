const Syllabus = require("../models/Syllabus");
const ClassSection = require("../models/ClassSection");
const Subject = require("../models/Subject");
const User = require("../models/User");

const formatDate = (d) => {
    const D = d ? new Date(d) : new Date();
    return `${D.getFullYear()}-${String(D.getMonth() + 1).padStart(2, "0")}-${String(D.getDate()).padStart(2, "0")}`;
};

const extractSection = (classObj, sectionId) => {
    if (!classObj?.sections) return null;

    const sec = classObj.sections.find(
        s => s._id.toString() === sectionId.toString()
    );

    return sec ? { _id: sec._id, name: sec.name } : null;
};


// create syllabus (teacher/admin)
const createSyllabus = async (req, res) => {
    try {
        const school = req.user.school;
        const uploader = req.user._id;
        const { classId, sectionId, subjectId, title, description, detail, publishDate, expireDate, status } = req.body;

        if (!classId || !sectionId || !subjectId || !title) {
            return res.status(400).json({ message: "classId, sectionId, subjectId and title are required" });
        }

        // validate class/subject/existence
        const [classDoc, subject, uploaderDoc] = await Promise.all([
            ClassSection.findById(classId),
            Subject.findById(subjectId),
            User.findById(uploader)
        ]);
        if (!classDoc) return res.status(404).json({ message: "Class not found" });
        if (!subject) return res.status(404).json({ message: "Subject not found" });
        if (!uploaderDoc) return res.status(404).json({ message: "Uploader (user) not found" });

        // optional: ensure subject.class matches classId
        if (String(subject.class) !== String(classId)) {
            return res.status(400).json({ message: "Subject not assigned to given class" });
        }

        const doc = await Syllabus.create({
            school,
            classId,
            sectionId,
            subjectId,
            title,
            description: description || "",
            detail: detail || "",
            //   files: Array.isArray(files) ? files : [],
            uploadedBy: uploader,
            publishDate: publishDate ? formatDate(publishDate) : undefined,
            expireDate: expireDate ? formatDate(expireDate) : undefined,
            status: status || "draft"
        });

        return res.status(201).json({ message: "Syllabus created", syllabus: doc });
    } catch (err) {
        console.error("createSyllabus error:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};

// get syllabus by filters (class/section/subject/status)
const getSyllabus = async (req, res) => {
    try {
        const school = req.user.school;
        let {
            classId,
            sectionId,
            subjectId,
            status,
            page = 1,
            limit = 10
        } = req.query;

        page = Number(page);
        limit = Number(limit);

        const filter = { school };
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;
        if (subjectId) filter.subjectId = subjectId;
        if (status) filter.status = status;

        const total = await Syllabus.countDocuments(filter);

        const items = await Syllabus.find(filter)
            .populate("subjectId", "name code")
            .populate("uploadedBy", "name email")
            .populate("classId", "class sections")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        const formatted = items.map(item => ({
            _id: item._id,
            title: item.title,
            description: item.description,
            detail: item.detail,
            publishDate: item.publishDate,
            expireDate: item.expireDate,
            status: item.status,

            class: item.classId
                ? { _id: item.classId._id, name: item.classId.class }
                : null,

            section: extractSection(item.classId, item.sectionId),

            subject: item.subjectId,
            uploadedBy: item.uploadedBy,
            createdAt: item.createdAt
        }));

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            syllabus: formatted
        });

    } catch (err) {
        console.error("getSyllabus error:", err);
        res.status(500).json({ message: err.message });
    }
};

// get syllabus by section (student)
const getSyllabusBySection = async (req, res) => {
    try {
        const school = req.user.school;
        const { sectionId } = req.params;

        let { page = 1, limit = 10, status } = req.query;
        page = Number(page);
        limit = Number(limit);

        if (!sectionId)
            return res.status(400).json({ message: "sectionId required" });

        const filter = { school, sectionId };
        if (status) filter.status = status;

        const total = await Syllabus.countDocuments(filter);

        const items = await Syllabus.find(filter)
            .populate("subjectId", "name code")
            .populate("uploadedBy", "name email")
            .populate("classId", "class sections")
            .sort({ publishDate: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        const formatted = items.map(item => ({
            _id: item._id,
            title: item.title,
            description: item.description,
            detail: item.detail,
            publishDate: item.publishDate,
            expireDate: item.expireDate,
            status: item.status,

            class: item.classId
                ? { _id: item.classId._id, name: item.classId.class }
                : null,

            section: extractSection(item.classId, item.sectionId),

            subject: item.subjectId,
            uploadedBy: item.uploadedBy,
            createdAt: item.createdAt
        }));

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            syllabus: formatted
        });

    } catch (err) {
        console.error("getSyllabusBySection error:", err);
        res.status(500).json({ message: err.message });
    }
};

// update syllabus (partial allowed)
const updateSyllabus = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await Syllabus.findById(id);
        if (!existing) return res.status(404).json({ message: "Syllabus not found" });

        // only uploader or admin should edit - you can add check here
        const updated = await Syllabus.findByIdAndUpdate(id, { $set: req.body }, { new: true });
        return res.status(200).json({ message: "Syllabus updated", syllabus: updated });
    } catch (err) {
        console.error("updateSyllabus error:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};

// delete syllabus
const deleteSyllabus = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await Syllabus.findById(id);
        if (!existing) return res.status(404).json({ message: "Syllabus not found" });
        await existing.deleteOne();
        return res.status(200).json({ message: "Syllabus deleted" });
    } catch (err) {
        console.error("deleteSyllabus error:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};

module.exports = {
    createSyllabus,
    getSyllabus,
    getSyllabusBySection,
    updateSyllabus,
    deleteSyllabus
};
