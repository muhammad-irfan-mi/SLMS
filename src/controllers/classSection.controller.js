const mongoose = require("mongoose");
const ClassSection = require("../models/ClassSection");
const School = require("../models/School");
const User = require("../models/User");



const addMultipleClassesWithSections = async (req, res) => {
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

        const orderNumbers = classes.map(c => c.order);
        const duplicateOrders = orderNumbers.filter((order, index) =>
            orderNumbers.indexOf(order) !== index
        );

        if (duplicateOrders.length > 0) {
            return res.status(400).json({
                message: "Duplicate order numbers found",
                duplicateOrders: [...new Set(duplicateOrders)]
            });
        }

        const classNames = classes.map(c => c.className.toLowerCase());
        const duplicateClassNames = classNames.filter((name, index) =>
            classNames.indexOf(name) !== index
        );

        if (duplicateClassNames.length > 0) {
            return res.status(400).json({
                message: "Duplicate class names found",
                duplicateClassNames: [...new Set(duplicateClassNames)]
            });
        }

        const existingClasses = await ClassSection.find({ school: schoolId });
        const existingOrders = existingClasses.map(c => c.order);

        const conflictingOrders = orderNumbers.filter(order =>
            existingOrders.includes(order)
        );

        if (conflictingOrders.length > 0) {
            return res.status(400).json({
                message: "Order numbers already in use",
                conflictingOrders,
                existingClassesWithOrders: existingClasses.map(c => ({
                    className: c.class,
                    order: c.order
                }))
            });
        }

        // Check if any class names already exist
        const existingClassNames = existingClasses.map(c => c.class.toLowerCase());
        const conflictingClassNames = classNames.filter(name =>
            existingClassNames.includes(name)
        );

        if (conflictingClassNames.length > 0) {
            return res.status(400).json({
                message: "Class names already exist",
                conflictingClassNames,
                existingClasses: existingClasses
                    .filter(c => conflictingClassNames.includes(c.class.toLowerCase()))
                    .map(c => ({ className: c.class, order: c.order }))
            });
        }

        const results = [];
        const createdClasses = [];

        const sortedClasses = [...classes].sort((a, b) => a.order - b.order);

        for (const c of sortedClasses) {
            // Format sections
            const formattedSections = c.sections.map((s, index) => ({
                name: s.trim()
            }));

            // Create new class
            const newClass = await ClassSection.create({
                school: schoolId,
                class: c.className,
                order: c.order,
                sections: formattedSections,
            });

            createdClasses.push(newClass);

            results.push({
                className: c.className,
                status: "Created",
                id: newClass._id,
                order: newClass.order,
                sections: newClass.sections.map(s => s.name)
            });
        }

        res.status(201).json({
            message: "Classes created successfully",
            totalCreated: createdClasses.length,
            classes: createdClasses.sort((a, b) => a.order - b.order).map(cls => ({
                _id: cls._id,
                className: cls.class,
                order: cls.order,
                sections: cls.sections.map(s => s.name),
                createdAt: cls.createdAt
            })),
            summary: results
        });
    } catch (err) {
        console.error("Error adding multiple classes:", err);

        if (err.code === 11000) {
            return res.status(400).json({
                message: "Duplicate class name or order detected",
                error: "A class with this name or order already exists in this school"
            });
        }

        res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
};

const updateAllClassesAndSections = async (req, res) => {
    try {
        const { schoolId, classes } = req.body;

        if (req.user.school.toString() !== schoolId) {
            return res.status(403).json({
                message: "Unauthorized access to this school"
            });
        }

        const school = await School.findById(schoolId);
        if (!school) return res.status(404).json({ message: "School not found" });

        for (const c of classes) {
            if (c.order === undefined || c.order === null) {
                return res.status(400).json({
                    message: `Order is required for class: ${c.className || 'Unknown'}`
                });
            }
        }

        const orderNumbers = classes.map(c => c.order);
        const duplicateOrders = orderNumbers.filter((order, index) =>
            orderNumbers.indexOf(order) !== index
        );

        if (duplicateOrders.length > 0) {
            return res.status(400).json({
                message: "Duplicate order numbers found in request",
                duplicateOrders: [...new Set(duplicateOrders)]
            });
        }

        const existingClasses = await ClassSection.find({ school: schoolId });
        const results = [];
        const incomingClassNames = classes.map(c => c.className.toLowerCase());

        for (const oldClass of existingClasses) {
            if (!incomingClassNames.includes(oldClass.class.toLowerCase())) {
                results.push({
                    className: oldClass.class,
                    order: oldClass.order,
                    status: "Not Modified",
                    reason: "Class not in update request",
                    action: "Kept in system"
                });
            }
        }

        for (const c of classes) {
            const existingClass = await ClassSection.findOne({
                school: schoolId,
                class: { $regex: new RegExp(`^${c.className}$`, 'i') },
            });

            if (!existingClass) {
                const orderConflict = await ClassSection.findOne({
                    school: schoolId,
                    order: c.order
                });

                if (orderConflict) {
                    results.push({
                        className: c.className,
                        order: c.order,
                        status: "Cannot Create",
                        reason: `Order ${c.order} is already used by class: ${orderConflict.class}`
                    });
                    continue;
                }

                const newClass = await ClassSection.create({
                    school: schoolId,
                    class: c.className,
                    order: c.order,
                    sections: [...new Set(c.sections.map(s => s.trim()))].map(name => ({ name })),
                });

                results.push({
                    className: c.className,
                    status: "Created",
                    id: newClass._id,
                    order: newClass.order,
                    sections: newClass.sections.map(s => s.name)
                });
            } else {
                if (c.order !== existingClass.order) {
                    const orderConflict = await ClassSection.findOne({
                        school: schoolId,
                        order: c.order,
                        _id: { $ne: existingClass._id }
                    });

                    if (orderConflict) {
                        results.push({
                            className: c.className,
                            order: c.order,
                            status: "Cannot Update Order",
                            reason: `Order ${c.order} is already used by class: ${orderConflict.class}`
                        });
                        continue;
                    }
                }

                const existingSectionNames = existingClass.sections.map(s => s.name);
                const newSectionsFromPayload = [...new Set(c.sections.map(s => s.trim()))];

                const allSections = [...new Set([...existingSectionNames, ...newSectionsFromPayload])];
                const sectionsAdded = newSectionsFromPayload.filter(s => !existingSectionNames.includes(s));

                existingClass.order = c.order;
                existingClass.sections = allSections.map(name => ({ name }));
                await existingClass.save();

                results.push({
                    className: c.className,
                    status: "Updated",
                    oldOrder: existingClass._doc.order,
                    newOrder: c.order,
                    existingSectionCount: existingSectionNames.length,
                    newSectionsAdded: sectionsAdded,
                    allSections: existingClass.sections.map(s => s.name)
                });
            }
        }

        res.status(200).json({
            message: "Classes and sections updated successfully",
            summary: results,
        });
    } catch (err) {
        console.error("Error updating classes and sections:", err);
        res.status(500).json({
            message: "Server error",
            error: err.message
        });
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

        page = parseInt(page);
        limit = parseInt(limit);

        if (req.user.school.toString() !== schoolId) {
            return res.status(403).json({
                message: "Unauthorized access to this school"
            });
        }

        const schoolExists = await School.findById(schoolId);
        if (!schoolExists) {
            return res.status(404).json({ message: "School not found" });
        }

        const skip = (page - 1) * limit;

        const total = await ClassSection.countDocuments({ school: schoolId });

        const classes = await ClassSection.find({ school: schoolId })
            .skip(skip)
            .limit(limit)
            .sort({ order: 1 });

        const inchargeTeachers = await User.find({
            school: schoolId,
            role: 'teacher',
            isIncharge: true,
            isActive: true
        }).select('_id name email phone classInfo sectionInfo images')
            .lean();

        const inchargeMap = {};
        inchargeTeachers.forEach(teacher => {
            if (teacher.classInfo?.id && teacher.sectionInfo?.id) {
                const key = `${teacher.classInfo.id}_${teacher.sectionInfo.id}`;
                inchargeMap[key] = {
                    _id: teacher._id,
                    name: teacher.name,
                    email: teacher.email,
                    phone: teacher.phone,
                    // profileImage: teacher.images?.recentPic || null,
                    // classInfo: teacher.classInfo,
                    // sectionInfo: teacher.sectionInfo
                };
            }
        });

        const enhancedClasses = classes.map(classObj => {
            console.log(classObj, "classObj")
            const enhancedSections = classObj.sections.map(section => {
                const key = `${classObj._id}_${section._id}`;
                const incharge = inchargeMap[key] || null;

                return {
                    _id: section._id,
                    name: section.name,
                    incharge: incharge
                };
            });

            return {
                _id: classObj._id,
                class: classObj.class,
                order: classObj.order,
                school: classObj.school,
                sections: enhancedSections,
                createdAt: classObj.createdAt,
                updatedAt: classObj.updatedAt
            };
        });

        res.status(200).json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            // count: classes.length,
            // classes,
            count: enhancedClasses.length,
            classes: enhancedClasses,
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

const promoteStudentsToNextClass = async (req, res) => {
    try {
        const { fromClassId, fromSectionId, toClassId, toSectionId } = req.body;
        const schoolId = req.user.school;

        if (!fromClassId || !fromSectionId || !toClassId || !toSectionId) {
            return res.status(400).json({
                message: "Missing required fields. Need: fromClassId, fromSectionId, toClassId, toSectionId"
            });
        }

        const fromClass = await ClassSection.findOne({
            _id: fromClassId,
            school: schoolId
        });

        if (!fromClass) {
            return res.status(404).json({ message: "Source class not found" });
        }

        const fromSection = fromClass.sections.id(fromSectionId);
        if (!fromSection) {
            return res.status(404).json({
                message: "Source section not found in class",
                availableSections: fromClass.sections.map(s => ({ id: s._id, name: s.name }))
            });
        }

        // Get destination class and section
        const toClass = await ClassSection.findOne({
            _id: toClassId,
            school: schoolId
        });

        if (!toClass) {
            return res.status(404).json({ message: "Destination class not found" });
        }

        const toSection = toClass.sections.id(toSectionId);
        if (!toSection) {
            return res.status(404).json({
                message: "Destination section not found in class",
            });
        }

        if (toClass.order <= fromClass.order) {
            return res.status(400).json({
                message: "Destination class must be higher order than source class",
                fromClass: { name: fromClass.class, order: fromClass.order },
                toClass: { name: toClass.class, order: toClass.order }
            });
        }

        const existingStudents = await User.find({
            school: schoolId,
            "classInfo.id": toClassId,
            "sectionInfo.id": toSectionId,
            role: "student",
            isActive: true
        });

        if (existingStudents.length > 0) {
            return res.status(400).json({
                message: "Destination section already has active students",
                count: existingStudents.length,
                students: existingStudents.map(s => ({ name: s.name, rollNo: s.rollNo }))
            });
        }

        const studentsToPromote = await User.find({
            school: schoolId,
            "classInfo.id": fromClassId,
            "sectionInfo.id": fromSectionId,
            role: "student",
            isActive: true
        });

        if (studentsToPromote.length === 0) {
            return res.status(200).json({
                message: "No active students found in source section",
                from: `${fromClass.class}-${fromSection.name}`,
                to: `${toClass.class}-${toSection.name}`
            });
        }

        const rollNumbers = studentsToPromote.map(s => s.rollNo).filter(Boolean);
        const existingRollNos = await User.find({
            school: schoolId,
            "classInfo.id": toClassId,
            "sectionInfo.id": toSectionId,
            rollNo: { $in: rollNumbers },
            role: "student",
            isActive: true
        }).select("rollNo name");

        if (existingRollNos.length > 0) {
            return res.status(400).json({
                message: "Some roll numbers already exist in destination",
                duplicates: existingRollNos.map(s => ({ rollNo: s.rollNo, name: s.name }))
            });
        }

        const results = {
            successful: 0,
            failed: 0,
            errors: []
        };

        for (const student of studentsToPromote) {
            try {
                const inactiveStudent = await User.findOne({
                    school: schoolId,
                    "classInfo.id": toClassId,
                    "sectionInfo.id": toSectionId,
                    email: student.email,
                    role: "student",
                    isActive: false
                });

                if (inactiveStudent) {
                    inactiveStudent.name = student.name;
                    inactiveStudent.classInfo.id = toClassId;
                    inactiveStudent.sectionInfo.id = toSectionId;
                    inactiveStudent.isActive = true;
                    inactiveStudent.rollNo = student.rollNo;
                    inactiveStudent.promotedFrom = student._id;
                    inactiveStudent.promotedAt = new Date();
                    await inactiveStudent.save();
                } else {
                    const newStudent = new User({
                        name: student.name,
                        email: student.email,
                        username: student.username,
                        rollNo: student.rollNo,
                        fatherName: student.fatherName,
                        phone: student.phone,
                        address: student.address,
                        role: "student",
                        school: student.school,
                        classInfo: { id: toClassId },
                        sectionInfo: { id: toSectionId },
                        images: student.images,
                        verified: student.verified,
                        isActive: true,
                        promotedFrom: student._id,
                        promotedAt: new Date(),
                        createdAt: new Date()
                    });
                    await newStudent.save();
                }

                student.isActive = false;
                student.archivedAt = new Date();
                student.archiveReason = `Promoted to ${toClass.class}-${toSection.name}`;
                await student.save();

                results.successful++;
            } catch (error) {
                console.error(`Error promoting student ${student._id}:`, error);
                results.failed++;
                results.errors.push({
                    studentId: student._id,
                    name: student.name,
                    error: error.message
                });
            }
        }

        const response = {
            message: results.failed > 0 ?
                `Promotion completed with ${results.failed} error(s)` :
                "All students promoted successfully",
            results: {
                total: studentsToPromote.length,
                successful: results.successful,
                failed: results.failed
            }
        };

        if (results.errors.length > 0) {
            response.errors = results.errors;
        }

        res.status(results.failed > 0 ? 207 : 200).json(response);

    } catch (err) {
        res.status(500).json({
            message: "Server error",
            error: err.message
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
    promoteStudentsToNextClass
};