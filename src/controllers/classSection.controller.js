const mongoose = require("mongoose");
const ClassSection = require("../models/ClassSection");
const School = require("../models/School");
const User = require("../models/User");



const addMultipleClassesWithSections = async (req, res) => {
    try {
        const { schoolId, classes } = req.body;

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
                fee: c.fee,
                order: c.order,
                sections: formattedSections,
            });

            createdClasses.push(newClass);

            results.push({
                className: c.className,
                status: "Created",
                id: newClass._id,
                fee: newClass.fee,
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
                fee: cls.fee,
                order: cls.order,
                sections: cls.sections.map(s => s.name),
                createdAt: cls.createdAt
            })),
            summary: results
        });
    } catch (err) {

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

        const existingClasses = await ClassSection.find({ school: schoolId });
        const results = [];

        const incomingClassNames = classes.map(c => c.className.toLowerCase());
        const existingClassMap = new Map();
        existingClasses.forEach(cls => {
            existingClassMap.set(cls.class.toLowerCase(), cls);
        });

        for (const oldClass of existingClasses) {
            if (!incomingClassNames.includes(oldClass.class.toLowerCase())) {
                results.push({
                    className: oldClass.class,
                    fee: oldClass.fee,
                    order: oldClass.order,
                    status: "Not Modified",
                    reason: "Class not in update request",
                    action: "Kept in system"
                });
            }
        }
        const newClassesToCreate = [];
        const updateClasses = [];

        for (const c of classes) {
            const existingClass = existingClassMap.get(c.className.toLowerCase());

            if (!existingClass) {
                const orderConflict = existingClasses.find(cls => cls.order === c.order);
                if (orderConflict) {
                    results.push({
                        className: c.className,
                        fee: c.fee,
                        order: c.order,
                        status: "Cannot Create",
                        reason: `Order ${c.order} is already used by class: ${orderConflict.class}`,
                        existingClass: orderConflict.class,
                        existingOrder: orderConflict.order
                    });
                    continue;
                }

                // Also check for order conflicts with other new classes being created in this request
                const orderConflictWithNew = newClassesToCreate.find(
                    newClass => newClass.order === c.order
                );
                if (orderConflictWithNew) {
                    results.push({
                        className: c.className,
                        fee: c.fee,
                        order: c.order,
                        status: "Cannot Create",
                        reason: `Duplicate order ${c.order} found in request with class: ${orderConflictWithNew.className}`
                    });
                    continue;
                }

                newClassesToCreate.push(c);
            } else {
                updateClasses.push({ ...c, existingClass });
            }
        }
        
      for (const c of newClassesToCreate) {
            try {
                const sections = c.sections ? [...new Set(c.sections.map(s => s.trim()))] : [];
                
                const newClass = await ClassSection.create({
                    school: schoolId,
                    class: c.className,
                    fee: c.fee !== undefined ? c.fee : null,
                    order: c.order,
                    sections: sections.map(name => ({ name })),
                });

                results.push({
                    className: c.className,
                    status: "Created",
                    id: newClass._id,
                    fee: newClass.fee,
                    order: newClass.order,
                    sections: newClass.sections.map(s => s.name)
                });
            } catch (err) {
                if (err.code === 11000) {
                    results.push({
                        className: c.className,
                        status: "Failed",
                        reason: "Duplicate class name or order detected",
                        error: err.message
                    });
                } else {
                    throw err;
                }
            }
        }

        for (const c of updateClasses) {
            const existingClass = c.existingClass;
            const fee = c.fee !== undefined ? c.fee : null;
            const sections = c.sections ? [...new Set(c.sections.map(s => s.trim()))] : [];
            
            const existingSectionNames = existingClass.sections.map(s => s.name);
            const newSectionsFromPayload = sections;
            
            const allSections = [...new Set([...existingSectionNames, ...newSectionsFromPayload])];
            const sectionsAdded = newSectionsFromPayload.filter(s => !existingSectionNames.includes(s));
            
            const updateData = {
                sections: allSections.map(name => ({ name })),
                updatedAt: new Date()
            };
            
            if (fee !== undefined && fee !== null) {
                updateData.fee = fee;
            }
            
            await ClassSection.findByIdAndUpdate(existingClass._id, updateData);
            
            results.push({
                className: c.className,
                status: "Updated",
                fee: fee !== undefined && fee !== null ? fee : existingClass.fee,
                previousFee: existingClass.fee,
                existingSectionCount: existingSectionNames.length,
                newSectionsAdded: sectionsAdded,
                totalSections: allSections.length,
                allSections: allSections,
                order: existingClass.order 
            });
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
                fee: classObj.fee,
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

const removeSectionIncharge = async (req, res) => {
    try {
        const { teacherId } = req.body;

        const teacher = await User.findById(teacherId);

        if (!teacher || teacher.role !== "teacher") {
            return res.status(404).json({
                message: "Teacher not found",
            });
        }

        if (req.user.school.toString() !== teacher.school.toString()) {
            return res.status(403).json({
                message: "Unauthorized access to this school",
            });
        }

        if (!teacher.isIncharge) {
            return res.status(400).json({
                message: "Teacher is not assigned as section incharge",
            });
        }

        teacher.isIncharge = false;
        teacher.classInfo = null;
        teacher.sectionInfo = null;

        await teacher.save();

        return res.status(200).json({
            message: "Section incharge removed successfully",
            teacherId: teacher._id,
        });

    } catch (err) {
        return res.status(500).json({
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

        const results = {
            successful: 0,
            failed: 0,
            errors: []
        };

        let successful = 0;
        let failed = 0;
        const errors = [];

        for (const student of studentsToPromote) {
            try {
                student.classInfo.id = toClassId;
                student.sectionInfo.id = toSectionId;

                student.promotedFromClass = fromClassId;
                student.promotedFromSection = fromSectionId;
                student.promotedAt = new Date();

                await student.save();

                successful++;
            } catch (error) {
                failed++;
                errors.push({
                    studentId: student._id,
                    name: student.name,
                    error: error.message,
                });
            }
        }

        return res.status(200).json({
            message: "Students promoted successfully",
            total: studentsToPromote.length,
            successful,
            failed,
            errors,
        });

    } catch (err) {
        res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
};

const updateSectionName = async (req, res) => {
    try {
        const { sectionId, newSectionName } = req.body;
        const schoolId = req.user.school;

        const classDoc = await ClassSection.findOne({
            'sections._id': sectionId,
            school: schoolId
        });

        if (!classDoc) {
            return res.status(404).json({
                message: "Section not found in your school"
            });
        }

        const section = classDoc.sections.id(sectionId);

        if (!section) {
            return res.status(404).json({
                message: "Section not found"
            });
        }

        const existingSection = classDoc.sections.find(
            s => s.name.toLowerCase() === newSectionName.toLowerCase() &&
                s._id.toString() !== sectionId.toString()
        );

        if (existingSection) {
            return res.status(400).json({
                message: "Section with this name already exists in this class"
            });
        }

        section.name = newSectionName.trim();
        await classDoc.save();

        res.status(200).json({
            message: "Section name updated successfully",
        });

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
    assignSectionIncharge,
    removeSectionIncharge,
    getClassesBySchool,
    promoteStudentsToNextClass,
    updateSectionName
};