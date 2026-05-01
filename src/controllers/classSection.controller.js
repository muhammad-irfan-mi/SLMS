const mongoose = require("mongoose");
const ClassSection = require("../models/ClassSection");
const School = require("../models/School");
const User = require("../models/User");
const Student = require("../models/Student");
const Staff = require("../models/Staff");

const getClassSectionDetails = async (classId, sectionId, schoolId) => {
    const classDoc = await ClassSection.findOne({
        _id: classId,
        school: schoolId
    }).lean();

    if (!classDoc) return { classInfo: null, sectionInfo: null };

    const classInfo = {
        id: classDoc._id,
        name: classDoc.class
    };

    let sectionInfo = null;
    if (sectionId && classDoc.sections) {
        const section = classDoc.sections.find(
            sec => sec._id.toString() === sectionId.toString()
        );
        if (section) {
            sectionInfo = {
                id: section._id,
                name: section.name
            };
        }
    }

    return { classInfo, sectionInfo };
};

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

// const updateAllClassesAndSections = async (req, res) => {
//     try {
//         const { schoolId, classes } = req.body;

//         if (req.user.school.toString() !== schoolId) {
//             return res.status(403).json({
//                 message: "Unauthorized access to this school"
//             });
//         }

//         const school = await School.findById(schoolId);
//         if (!school) return res.status(404).json({ message: "School not found" });

//         const existingClasses = await ClassSection.find({ school: schoolId });
//         const results = [];

//         const incomingClassNames = classes.map(c => c.className.toLowerCase());
//         const existingClassMap = new Map();
//         existingClasses.forEach(cls => {
//             existingClassMap.set(cls.class.toLowerCase(), cls);
//         });

//         for (const oldClass of existingClasses) {
//             if (!incomingClassNames.includes(oldClass.class.toLowerCase())) {
//                 results.push({
//                     className: oldClass.class,
//                     fee: oldClass.fee,
//                     order: oldClass.order,
//                     status: "Not Modified",
//                     reason: "Class not in update request",
//                     action: "Kept in system"
//                 });
//             }
//         }
//         const newClassesToCreate = [];
//         const updateClasses = [];

//         for (const c of classes) {
//             const existingClass = existingClassMap.get(c.className.toLowerCase());

//             if (!existingClass) {
//                 const orderConflict = existingClasses.find(cls => cls.order === c.order);
//                 if (orderConflict) {
//                     results.push({
//                         className: c.className,
//                         fee: c.fee,
//                         order: c.order,
//                         status: "Cannot Create",
//                         reason: `Order ${c.order} is already used by class: ${orderConflict.class}`,
//                         existingClass: orderConflict.class,
//                         existingOrder: orderConflict.order
//                     });
//                     continue;
//                 }

//                 // Also check for order conflicts with other new classes being created in this request
//                 const orderConflictWithNew = newClassesToCreate.find(
//                     newClass => newClass.order === c.order
//                 );
//                 if (orderConflictWithNew) {
//                     results.push({
//                         className: c.className,
//                         fee: c.fee,
//                         order: c.order,
//                         status: "Cannot Create",
//                         reason: `Duplicate order ${c.order} found in request with class: ${orderConflictWithNew.className}`
//                     });
//                     continue;
//                 }

//                 newClassesToCreate.push(c);
//             } else {
//                 updateClasses.push({ ...c, existingClass });
//             }
//         }

//       for (const c of newClassesToCreate) {
//             try {
//                 const sections = c.sections ? [...new Set(c.sections.map(s => s.trim()))] : [];

//                 const newClass = await ClassSection.create({
//                     school: schoolId,
//                     class: c.className,
//                     fee: c.fee !== undefined ? c.fee : null,
//                     order: c.order,
//                     sections: sections.map(name => ({ name })),
//                 });

//                 results.push({
//                     className: c.className,
//                     status: "Created",
//                     id: newClass._id,
//                     fee: newClass.fee,
//                     order: newClass.order,
//                     sections: newClass.sections.map(s => s.name)
//                 });
//             } catch (err) {
//                 if (err.code === 11000) {
//                     results.push({
//                         className: c.className,
//                         status: "Failed",
//                         reason: "Duplicate class name or order detected",
//                         error: err.message
//                     });
//                 } else {
//                     throw err;
//                 }
//             }
//         }

//         for (const c of updateClasses) {
//             const existingClass = c.existingClass;
//             const fee = c.fee !== undefined ? c.fee : null;
//             const sections = c.sections ? [...new Set(c.sections.map(s => s.trim()))] : [];

//             const existingSectionNames = existingClass.sections.map(s => s.name);
//             const newSectionsFromPayload = sections;

//             const allSections = [...new Set([...existingSectionNames, ...newSectionsFromPayload])];
//             const sectionsAdded = newSectionsFromPayload.filter(s => !existingSectionNames.includes(s));

//             const updateData = {
//                 sections: allSections.map(name => ({ name })),
//                 updatedAt: new Date()
//             };

//             if (fee !== undefined && fee !== null) {
//                 updateData.fee = fee;
//             }

//             await ClassSection.findByIdAndUpdate(existingClass._id, updateData);

//             results.push({
//                 className: c.className,
//                 status: "Updated",
//                 fee: fee !== undefined && fee !== null ? fee : existingClass.fee,
//                 previousFee: existingClass.fee,
//                 existingSectionCount: existingSectionNames.length,
//                 newSectionsAdded: sectionsAdded,
//                 totalSections: allSections.length,
//                 allSections: allSections,
//                 order: existingClass.order 
//             });
//         }

//         res.status(200).json({
//             message: "Classes and sections updated successfully",
//             summary: results,
//         });

//     } catch (err) {
//         console.error("Error updating classes and sections:", err);
//         res.status(500).json({
//             message: "Server error",
//             error: err.message
//         });
//     }
// };

const updateAllClassesAndSections = async (req, res) => {
    try {
        const { schoolId, classes } = req.body;

        if (req.user.school.toString() !== schoolId) {
            return res.status(403).json({
                message: "Unauthorized access to this school"
            });
        }

        const school = await School.findById(schoolId);
        if (!school) {
            return res.status(404).json({ message: "School not found" });
        }

        const existingClasses = await ClassSection.find({ school: schoolId });
        const results = [];

        const existingClassMap = new Map();
        existingClasses.forEach(cls => {
            existingClassMap.set(cls.class.toLowerCase(), cls);
        });

        const newClassesToCreate = [];
        const updateClasses = [];

        for (const c of classes) {
            const className = c.className.trim().toLowerCase();
            const existingClass = existingClassMap.get(className);

            if (!existingClass) {
                const orderConflict = existingClasses.find(cls => cls.order === c.order);
                if (orderConflict) {
                    results.push({
                        className: c.className,
                        status: "Cannot Create",
                        reason: `Order ${c.order} already used by ${orderConflict.class}`
                    });
                    continue;
                }

                const duplicateOrder = newClassesToCreate.find(nc => nc.order === c.order);
                if (duplicateOrder) {
                    results.push({
                        className: c.className,
                        status: "Cannot Create",
                        reason: `Duplicate order ${c.order} in request`
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
                const uniqueSections = c.sections
                    ? [...new Set(c.sections.map(s => s.trim()))]
                    : [];

                const newClass = await ClassSection.create({
                    school: schoolId,
                    class: c.className,
                    fee: c.fee ?? null,
                    order: c.order,
                    sections: uniqueSections.map(name => ({ name }))
                });

                results.push({
                    className: newClass.class,
                    status: "Created",
                    id: newClass._id,
                    sections: newClass.sections.map(s => ({
                        id: s._id,
                        name: s.name
                    }))
                });

            } catch (err) {
                results.push({
                    className: c.className,
                    status: "Failed",
                    error: err.message
                });
            }
        }

        for (const c of updateClasses) {
            const existingClass = c.existingClass;

            const updateData = {
                updatedAt: new Date()
            };

            if (c.fee !== undefined) {
                updateData.fee = c.fee;
            }

            if (c.order !== undefined && c.order !== existingClass.order) {
                const orderConflict = existingClasses.find(
                    cls =>
                        cls.order === c.order &&
                        cls._id.toString() !== existingClass._id.toString()
                );

                if (orderConflict) {
                    results.push({
                        className: c.className,
                        status: "Order Not Updated",
                        reason: `Order ${c.order} already used by ${orderConflict.class}`
                    });
                } else {
                    updateData.order = c.order;
                }
            }

            let sectionsAdded = [];

            if (c.sections && Array.isArray(c.sections)) {
                const existingSections = existingClass.sections;
                const existingNames = existingSections.map(s => s.name);

                const incomingSections = [
                    ...new Set(c.sections.map(s => s.trim()))
                ];

                const newSections = incomingSections.filter(
                    name => !existingNames.includes(name)
                );

                sectionsAdded = newSections;

                if (newSections.length > 0) {
                    updateData.sections = [
                        ...existingSections,
                        ...newSections.map(name => ({ name }))
                    ];
                }
            }

            const updatedClass = await ClassSection.findByIdAndUpdate(
                existingClass._id,
                updateData,
                { new: true }
            );

            results.push({
                className: updatedClass.class,
                status: "Updated",
                fee: updatedClass.fee,
                order: updatedClass.order,
                sectionsAdded,
                totalSections: updatedClass.sections.length
            });
        }


        return res.status(200).json({
            message: "Classes & sections updated safely",
            summary: results
        });

    } catch (err) {
        console.error("Error updating classes:", err);
        return res.status(500).json({
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

        const inchargeTeachers = await Staff.find({
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

        const teacher = await Staff.findById(teacherId);
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
        await Staff.updateMany(
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
        res.status(500).json({
            message: "Server error",
            error: err.message,
        });
    }
};

const removeSectionIncharge = async (req, res) => {
    try {
        const { teacherId } = req.body;
        console.log(teacherId);

        const teacher = await Staff.findById(teacherId);

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

        const existingStudents = await Student.find({
            school: schoolId,
            "classInfo.id": toClassId,
            "sectionInfo.id": toSectionId,
            status: 'active',
            isActive: true
        });

        if (existingStudents.length > 0) {
            return res.status(400).json({
                message: "Destination section already has active students.",
                count: existingStudents.length,
                students: existingStudents.map(s => ({ name: s.name, rollNo: s.rollNo }))
            });
        }

        const studentsToPromote = await Student.find({
            school: schoolId,
            "classInfo.id": fromClassId,
            "sectionInfo.id": fromSectionId,
            status: 'active',
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

        const promotedStudents = [];

        for (const student of studentsToPromote) {
            try {
                const { classInfo, sectionInfo } = await getClassSectionDetails(toClassId, toSectionId, schoolId);

                student.classInfo = classInfo;
                student.sectionInfo = sectionInfo;

                await student.save();

                results.successful++;
                promotedStudents.push({
                    id: student._id,
                    name: student.name,
                    rollNo: student.rollNo,
                    from: `${fromClass.class}-${fromSection.name}`,
                    to: `${toClass.class}-${toSection.name}`
                });
            } catch (error) {
                results.failed++;
                results.errors.push({
                    studentId: student._id,
                    name: student.name,
                    error: error.message,
                });
            }
        }

        return res.status(200).json({
            message: "Students promoted successfully",
            // total: studentsToPromote.length,
            // successful: results.successful,
            // failed: results.failed,
            // promotedStudents,
            // errors: results.errors,
        });

    } catch (err) {
        res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
};

const markStudentsAsPassout = async (req, res) => {
    try {
        const { classId, sectionId } = req.body;
        const schoolId = req.user.school;

        if (!classId || !sectionId) {
            return res.status(400).json({
                message: "Missing required fields. Need: classId, sectionId"
            });
        }

        const classDoc = await ClassSection.findOne({
            _id: classId,
            school: schoolId
        });

        if (!classDoc) {
            return res.status(404).json({ message: "Class not found" });
        }

        const section = classDoc.sections.id(sectionId);
        if (!section) {
            return res.status(404).json({ message: "Section not found in class" });
        }

        const studentsToPassout = await Student.find({
            school: schoolId,
            "classInfo.id": classId,
            "sectionInfo.id": sectionId,
            role: "student",
            status: 'active',
            isActive: true
        });

        if (studentsToPassout.length === 0) {
            return res.status(200).json({
                message: "No active students found to mark as passout",
            });
        }

        const results = { successful: 0, failed: 0, errors: [] };
        const passedOutStudents = [];

        for (const student of studentsToPassout) {
            try {
                student.historyInfo = {
                    classId: student.classInfo.id,
                    sectionId: student.sectionInfo.id,
                    date: new Date(),
                };

                student.status = 'passout';
                student.isActive = false;
                student.deactivatedAt = new Date();

                await student.save();

                results.successful++;
                passedOutStudents.push({
                    id: student._id,
                    name: student.name,
                    rollNo: student.rollNo
                });
            } catch (error) {
                results.failed++;
                results.errors.push({
                    studentId: student._id,
                    name: student.name,
                    error: error.message,
                });
            }
        }

        return res.status(200).json({
            message: `Successfully marked ${results.successful} students as passout`,
        });

    } catch (err) {
        console.error("markStudentsAsPassout error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const markStudentsAsLeftSchool = async (req, res) => {
    try {
        const { studentIds } = req.body;
        const schoolId = req.user.school;

        if (!studentIds || studentIds.length === 0) {
            return res.status(400).json({
                message: "Student IDs are required to mark as left school"
            });
        }

        const studentsToLeft = await Student.find({
            _id: { $in: studentIds },
            school: schoolId,
            role: "student",
            status: 'active',
            isActive: true
        });

        if (studentsToLeft.length === 0) {
            return res.status(404).json({
                message: "No active students found with the provided IDs"
            });
        }

        const results = { successful: 0, failed: 0, errors: [] };
        const leftStudents = [];

        for (const student of studentsToLeft) {
            try {
                student.historyInfo = {
                    classId: student.classInfo.id,
                    sectionId: student.sectionInfo.id,
                    date: new Date(),
                };

                student.status = 'left';
                student.isActive = false;
                student.deactivatedAt = new Date();

                await student.save();

                results.successful++;
                leftStudents.push({
                    id: student._id,
                    name: student.name,
                    rollNo: student.rollNo,
                    leavingDate: leavingDate || new Date(),
                });
            } catch (error) {
                results.failed++;
                results.errors.push({
                    studentId: student._id,
                    name: student.name,
                    error: error.message,
                });
            }
        }

        return res.status(200).json({
            message: `Successfully marked students as left school`,
            // total: studentsToLeft.length,
            // successful: results.successful,
            // failed: results.failed,
            // leftStudents,
            // errors: results.errors
        });

    } catch (err) {
        console.error("markStudentsAsLeftSchool error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
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
    markStudentsAsPassout,
    markStudentsAsLeftSchool,
    updateSectionName
};