const mongoose = require("mongoose");
const ClassSection = require("../models/ClassSection");
const School = require("../models/School");
const User = require("../models/User");



const addMultipleClassesWithSections = async (req, res) => {
    try {
        const { schoolId, classes } = req.body;
        console.log(req.user)

        // Check if user is authorized for this school
        if (req.user.school.toString() !== schoolId) {
            return res.status(403).json({
                message: "Unauthorized access to this school"
            });
        }

        const school = await School.findById(schoolId);
        if (!school) return res.status(404).json({ message: "School not found" });

        const results = [];

        for (const c of classes) {
            const exists = await ClassSection.findOne({
                school: schoolId,
                class: c.className
            });
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

        // Check if user is authorized for this school
        if (req.user.school.toString() !== schoolId) {
            return res.status(403).json({
                message: "Unauthorized access to this school"
            });
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

        // Check if user is authorized for this school
        if (req.user.school.toString() !== classDoc.school.toString()) {
            return res.status(403).json({
                message: "Unauthorized access to this school"
            });
        }

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

        // Check if user is authorized for this school
        if (req.user.school.toString() !== classDoc.school.toString()) {
            return res.status(403).json({
                message: "Unauthorized access to this school"
            });
        }

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
        let { page = 1, limit = 20 } = req.query;

        // Convert to numbers
        page = parseInt(page);
        limit = parseInt(limit);

        // Check if user is authorized for this school
        if (req.user.school.toString() !== schoolId) {
            return res.status(403).json({
                message: "Unauthorized access to this school"
            });
        }

        // Validate school exists
        const schoolExists = await School.findById(schoolId);
        if (!schoolExists) {
            return res.status(404).json({ message: "School not found" });
        }

        const skip = (page - 1) * limit;

        const total = await ClassSection.countDocuments({ school: schoolId });

        const classes = await ClassSection.find({ school: schoolId })
            .skip(skip)
            .limit(limit)
            .sort({ class: 1 });

        res.status(200).json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            count: classes.length,
            classes,
        });

    } catch (err) {
        console.error("Error fetching classes:", err);
        res.status(500).json({ message: "Error fetching classes", error: err.message });
    }
};

// Assign or reassign a section incharge
const assignSectionIncharge = async (req, res) => {
    try {
        const { classId, sectionId, teacherId } = req.body;

        // Find the class first to get school information
        const classDoc = await ClassSection.findById(classId);
        if (!classDoc) {
            return res.status(404).json({ message: "Class not found" });
        }

        // Check if user is authorized for this school
        if (req.user.school.toString() !== classDoc.school.toString()) {
            return res.status(403).json({
                message: "Unauthorized access to this school"
            });
        }

        const section = classDoc.sections.find(
            sec => sec._id.toString() === sectionId.toString()
        );
        if (!section) {
            return res.status(404).json({ message: "Section not found in this class" });
        }

        const teacher = await User.findById(teacherId);
        if (!teacher || teacher.role !== "teacher") {
            return res.status(400).json({ message: "Invalid teacher ID" });
        }

        // Check if teacher belongs to the same school
        if (teacher.school.toString() !== classDoc.school.toString()) {
            return res.status(400).json({
                message: "Teacher does not belong to this school",
            });
        }

        if (
            teacher.isIncharge &&
            teacher.sectionInfo?.id &&
            teacher.sectionInfo.id.toString() !== sectionId.toString()
        ) {
            return res.status(400).json({
                message: "Teacher is already incharge of another section",
            });
        }

        // Remove current incharge from this section if exists
        await User.updateMany(
            {
                role: "teacher",
                isIncharge: true,
                "sectionInfo.id": sectionId,
                school: classDoc.school,
            },
            {
                $set: {
                    isIncharge: false,
                    classInfo: null,
                    sectionInfo: null,
                },
            }
        );

        // Assign new incharge
        teacher.isIncharge = true;
        teacher.classInfo = {
            id: classDoc._id,
            name: classDoc.class,
        };
        teacher.sectionInfo = {
            id: section._id,
            name: section.name,
        };

        await teacher.save();

        return res.status(200).json({
            message: "Section incharge assigned successfully",
            incharge: {
                teacherId: teacher._id,
                teacherName: teacher.name,
                class: classDoc.class,
                section: section.name,
            },
        });

    } catch (err) {
        console.error("assignSectionIncharge error:", err);
        res.status(500).json({
            message: "Server error",
            error: err.message,
        });
    }
};

module.exports = {
    addMultipleClassesWithSections,
    updateAllClassesAndSections,
    deleteSectionFromClass,
    assignSectionIncharge,
    getClassesBySchool,
    deleteClass,
};