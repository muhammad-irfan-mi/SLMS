const ClassSection = require("../models/ClassSection");
const School = require("../models/School");
const User = require("../models/User");

const addMultipleClassesWithSections = async (req, res) => {
    try {
        const { schoolId, classes } = req.body;

        if (!schoolId || !Array.isArray(classes) || classes.length === 0) {
            return res.status(400).json({ message: "School ID and classes are required" });
        }

        const school = await School.findById(schoolId);
        if (!school) return res.status(404).json({ message: "School not found" });

        const results = [];

        for (const c of classes) {
            if (!c.className || !Array.isArray(c.sections) || c.sections.length === 0) {
                results.push({ className: c.className || "Unknown", status: "Failed", reason: "Invalid data" });
                continue;
            }

            const exists = await ClassSection.findOne({ school: schoolId, class: c.className });
            if (exists) {
                results.push({ className: c.className, status: "Skipped", reason: "Class already exists" });
                continue;
            }

            const formattedSections = c.sections.map((s) => ({ name: s }));
            const newClass = await ClassSection.create({
                school: schoolId,
                class: c.className,
                sections: formattedSections,
            });

            results.push({ className: c.className, status: "Created", id: newClass._id });
        }

        res.status(201).json({
            message: "Class creation completed",
            summary: results,
        });
    } catch (err) {
        console.error("Error adding multiple classes:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const updateAllClassesAndSections = async (req, res) => {
    try {
        const { schoolId, classes } = req.body;

        if (!schoolId || !Array.isArray(classes) || classes.length === 0) {
            return res.status(400).json({ message: "School ID and classes are required" });
        }

        const school = await School.findById(schoolId);
        if (!school) return res.status(404).json({ message: "School not found" });

        const existingClasses = await ClassSection.find({ school: schoolId });
        const results = [];

        const incomingClassNames = classes.map((c) => c.className.toLowerCase());

        // Step 1: Delete classes that no longer exist in request
        for (const oldClass of existingClasses) {
            if (!incomingClassNames.includes(oldClass.class.toLowerCase())) {
                await oldClass.deleteOne();
                results.push({
                    className: oldClass.class,
                    status: "Deleted",
                    reason: "Not included in update list",
                });
            }
        }

        // Step 2: Add new or update existing classes
        for (const c of classes) {
            if (!c.className || !Array.isArray(c.sections)) {
                results.push({
                    className: c.className || "Unknown",
                    status: "Failed",
                    reason: "Invalid data",
                });
                continue;
            }

            const existingClass = await ClassSection.findOne({
                school: schoolId,
                class: c.className,
            });

            if (!existingClass) {
                // New class — create
                const formattedSections = [...new Set(c.sections)].map((s) => ({ name: s }));
                const newClass = await ClassSection.create({
                    school: schoolId,
                    class: c.className,
                    sections: formattedSections,
                });
                results.push({ className: c.className, status: "Created", id: newClass._id });
            } else {
                const newSections = [...new Set(c.sections.map((s) => s.trim()))];

                existingClass.sections = newSections.map((s) => ({ name: s }));
                await existingClass.save();

                results.push({
                    className: c.className,
                    status: "Updated",
                    sectionCount: newSections.length,
                });
            }
        }

        res.status(200).json({
            message: "Classes and sections updated successfully",
            summary: results,
        });
    } catch (err) {
        console.error("Error updating classes and sections:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const deleteSectionFromClass = async (req, res) => {
    try {
        const { classId, sectionName } = req.body;

        const classDoc = await ClassSection.findById(classId);
        if (!classDoc) return res.status(404).json({ message: "Class not found" });

        const updatedSections = classDoc.sections.filter(
            (s) => s.name.toLowerCase() !== sectionName.toLowerCase()
        );

        if (updatedSections.length === classDoc.sections.length)
            return res.status(404).json({ message: "Section not found" });

        classDoc.sections = updatedSections;
        await classDoc.save();

        res.status(200).json({ message: "Section deleted successfully", classData: classDoc });
    } catch (err) {
        console.error("Error deleting section:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const deleteClass = async (req, res) => {
    try {
        const { id } = req.params;
        const classDoc = await ClassSection.findById(id);
        if (!classDoc) return res.status(404).json({ message: "Class not found" });

        await classDoc.deleteOne();
        res.status(200).json({ message: "Class and all its sections deleted successfully" });
    } catch (err) {
        console.error("Error deleting class:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const getClassesBySchool = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const classes = await ClassSection.find({ school: schoolId });
        res.status(200).json({ count: classes.length, classes });
    } catch (err) {
        res.status(500).json({ message: "Error fetching classes", error: err.message });
    }
};

// Assign or reassign a section incharge
const assignSectionIncharge = async (req, res) => {
    try {
        const { classId, sectionId, teacherId } = req.body;

        if (!classId || !sectionId || !teacherId) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // const school = await School.findById(schoolId);
        // if (!school) return res.status(404).json({ message: "School not found" });

        const classDoc = await ClassSection.findById(classId);
        if (!classDoc) return res.status(404).json({ message: "Class not found" });

        const section = classDoc.sections.find(
            (sec) => sec._id.toString() === sectionId
        );
        if (!section)
            return res.status(404).json({ message: "Section not found in this class" });

        const teacher = await User.findById(teacherId);
        if (!teacher || teacher.role !== "teacher") {
            return res.status(400).json({ message: "Invalid teacher ID" });
        }

        const existingIncharge = await User.findOne({
            _id: { $ne: teacherId },
            role: "teacher",
            isIncharge: true,
            "sectionInfo.id": { $exists: true },
        });

        if (
            teacher.isIncharge &&
            teacher.sectionInfo?.id?.toString() !== sectionId.toString()
        ) {
            return res.status(400).json({
                message: "This teacher is already incharge of another section.",
            });
        }

        await User.updateMany(
            {
                role: "teacher",
                "sectionInfo.id": sectionId,
                isIncharge: true,
            },
            { $set: { isIncharge: false, classInfo: null, sectionInfo: null } }
        );

        teacher.isIncharge = true;
        teacher.classInfo = { id: classDoc._id, name: classDoc.class };
        teacher.sectionInfo = { id: section._id, name: section.name };

        await teacher.save();

        return res.status(200).json({
            message: "Teacher assigned as incharge successfully",
            incharge: {
                teacherId: teacher._id,
                teacherName: teacher.name,
                class: classDoc.class,
                section: section.name,
            },
        });
    } catch (err) {
        console.error("Error assigning incharge:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};


module.exports = {
    addMultipleClassesWithSections,
    updateAllClassesAndSections,
    deleteSectionFromClass,
    deleteClass,
    getClassesBySchool,
    assignSectionIncharge
};
