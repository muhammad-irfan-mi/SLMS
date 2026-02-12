const ClassSection = require("../models/ClassSection");
const Subject = require("../models/Subject");
const User = require("../models/User");
const School = require("../models/School");
const Syllabus = require("../models/Syllabus");
const Schedule = require("../models/Schedule");

// Helper: Get class and section info
const getClassSectionInfo = async (classId, sectionId, schoolId) => {
    const classSection = await ClassSection.findOne({
        _id: classId,
        school: schoolId
    }).lean();

    if (!classSection) {
        return { class: null, section: null };
    }

    const classInfo = {
        _id: classSection._id,
        name: classSection.class
    };

    let sectionInfo = null;
    if (sectionId && classSection.sections) {
        const section = classSection.sections.find(
            sec => sec._id.toString() === sectionId.toString()
        );
        if (section) {
            sectionInfo = {
                _id: section._id,
                name: section.name
            };
        }
    }

    return { class: classInfo, section: sectionInfo };
};

// Helper: Batch get class section info
const getBatchClassSectionInfo = async (records, schoolId) => {
    const classIds = [...new Set(
        records.map(r => r.classId?.toString()).filter(Boolean)
    )];

    const classSections = await ClassSection.find({
        _id: { $in: classIds },
        school: schoolId
    }).lean();

    const classSectionMap = new Map();
    classSections.forEach(cs => {
        classSectionMap.set(cs._id.toString(), cs);
    });

    return records.map(record => {
        const classSection = classSectionMap.get(record.classId?.toString());

        if (!classSection) {
            return {
                ...record,
                class: null,
                section: null
            };
        }

        let sectionInfo = null;
        if (record.sectionId && classSection.sections) {
            const section = classSection.sections.find(
                sec => sec._id.toString() === record.sectionId.toString()
            );
            if (section) {
                sectionInfo = {
                    _id: section._id,
                    name: section.name
                };
            }
        }

        const classInfo = {
            _id: classSection._id,
            name: classSection.class
        };

        return {
            ...record,
            class: classInfo,
            section: sectionInfo
        };
    });
};

// Helper: Resolve uploader info
const resolveUploader = async (uploadedById, uploadedByModel) => {
    if (!uploadedById) return null;

    try {
        if (uploadedByModel === 'User') {
            const user = await User.findById(uploadedById)
                .select("name email role")
                .lean();

            if (user) {
                return {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    type: "user",
                    role: user.role
                };
            }
        } else if (uploadedByModel === 'School') {
            const school = await School.findById(uploadedById)
                .select("name email")
                .lean();

            if (school) {
                return {
                    _id: school._id,
                    name: school.name,
                    email: school.email,
                    type: "school"
                };
            }
        }
    } catch (error) {
        console.error("Error resolving uploader:", error);
    }

    return null;
};

// Helper: Validate subject belongs to class and school
const validateSubjectAssignment = async (subjectId, classId, schoolId) => {
    console.log("ids",subjectId, classId, schoolId);
    const subject = await Subject.findOne({
        _id: subjectId,
        class: classId,
        school: schoolId,
        isActive: true
    }).lean();

    if (!subject) {
        return {
            valid: false,
            message: "Subject not found or not assigned to this class in your school"
        };
    }

    return {
        valid: true,
        subject
    };
};

// Helper: Validate class and section belong to school
const validateClassSection = async (classId, sectionId, schoolId) => {
    const classSection = await ClassSection.findOne({
        _id: classId,
        school: schoolId
    }).lean();

    if (!classSection) {
        return {
            valid: false,
            message: "Class not found in your school"
        };
    }

    if (sectionId && classSection.sections) {
        const section = classSection.sections.find(
            sec => sec._id.toString() === sectionId.toString()
        );
        if (!section) {
            return {
                valid: false,
                message: "Section not found in this class"
            };
        }
    }

    return {
        valid: true,
        classSection
    };
};

// Helper: Check if teacher is assigned to subject in schedule
const checkTeacherSubjectAccess = async (teacherId, subjectId, classId, sectionId, schoolId) => {
    const schedule = await Schedule.findOne({
        school: schoolId,
        teacherId: teacherId,
        subjectId: subjectId,
        classId: classId,
        sectionId: sectionId
    }).lean();

    if (!schedule) {
        return {
            hasAccess: false,
            message: "You are not assigned to teach this subject in the schedule"
        };
    }

    return {
        hasAccess: true,
        schedule
    };
};

// Helper: Get teacher's assigned subjects
const getTeacherAssignedSubjects = async (teacherId, schoolId) => {
    const schedules = await Schedule.find({
        school: schoolId,
        "schedule.teacher": teacherId,
        status: "active"
    }).distinct("schedule.subject");

    return schedules;
};

// Helper: Format date
const formatDate = (date) => {
    if (!date) return null;

    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) {
        throw new Error("Invalid date");
    }

    return d.toISOString().split("T")[0];
};

// Helper: Normalize pagination
const normalizePagination = (query) => {
    const page = Math.max(parseInt(query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    return { page, limit, skip };
};

// Helper: Check syllabus update permissions
const checkSyllabusUpdatePermission = async (syllabus, userId, userRole, schoolId) => {
    if (userId.toString() === schoolId.toString()) {
        return { canUpdate: true };
    }

    if (userRole === 'admin_office') {
        return { canUpdate: true };
    }

    if (userRole === 'teacher') {

        if (syllabus.uploadedBy && syllabus.uploadedBy.toString() === userId.toString() &&
            syllabus.uploadedByModel === 'User') {
            return { canUpdate: true };
        }

        const scheduleAccess = await checkTeacherSubjectAccess(
            userId,
            syllabus.subjectId,
            syllabus.classId,
            syllabus.sectionId,
            schoolId
        );

        if (scheduleAccess.hasAccess) {
            return { canUpdate: true };
        }

        return {
            canUpdate: false,
            message: "You are not authorized to update this syllabus"
        };
    }

    return {
        canUpdate: false,
        message: "You are not authorized to update syllabus"
    };
};

// Create syllabus with teacher schedule validation
const createSyllabus = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role || 'school';

        const { classId, sectionId, subjectId, title, description, detail, expireDate, status } = req.body;

        const classSectionCheck = await validateClassSection(classId, sectionId, schoolId);
        if (!classSectionCheck.valid) {
            return res.status(400).json({ message: classSectionCheck.message });
        }

        const subjectCheck = await validateSubjectAssignment(subjectId, classId, schoolId);
        if (!subjectCheck.valid) {
            return res.status(400).json({ message: subjectCheck.message });
        }

        if (userRole === 'teacher') {
            const teacherAccess = await checkTeacherSubjectAccess(
                userId,
                subjectId,
                classId,
                sectionId,
                schoolId
            );

            if (!teacherAccess.hasAccess) {
                return res.status(403).json({
                    message: teacherAccess.message
                });
            }
        }

        let uploadedById, uploadedByModel;
        if (userRole === 'school') {
            uploadedById = schoolId;
            uploadedByModel = 'School';
        } else {
            uploadedById = userId;
            uploadedByModel = 'User';
        }

        const today = new Date();
        const formattedPublishDate = formatDate(today);
        let formattedExpireDate = null;

        try {
            if (expireDate) formattedExpireDate = formatDate(expireDate);
        } catch (error) {
            return res.status(400).json({ message: error.message });
        }

        if (formattedExpireDate && formattedExpireDate <= formattedPublishDate) {
            return res.status(400).json({
                message: `Expire date must be after publish date (${formattedPublishDate})`
            });
        }

        const existingActiveSyllabus = await Syllabus.findOne({
            school: schoolId,
            classId,
            sectionId,
            subjectId,
            $or: [
                {
                    expireDate: { $gte: formattedPublishDate }
                },
                {
                    expireDate: null
                },
                {
                    publishDate: { $lte: formattedPublishDate },
                    expireDate: { $gte: formattedPublishDate }
                }
            ]
        }).select('title publishDate expireDate status').lean();

        if (existingActiveSyllabus) {
            let message = '';

            if (existingActiveSyllabus.expireDate) {
                message = `Cannot create syllabus. Current date (${formattedPublishDate}) is before the expiry date (${existingActiveSyllabus.expireDate}) of existing syllabus "${existingActiveSyllabus.title}"`;
            } else {
                message = `Cannot create new syllabus for this subject.`;
            }

            return res.status(409).json({
                message,
                existingSyllabus: {
                    _id: existingActiveSyllabus._id,
                    title: existingActiveSyllabus.title,
                    publishDate: existingActiveSyllabus.publishDate,
                    expireDate: existingActiveSyllabus.expireDate,
                    status: existingActiveSyllabus.status
                }
            });
        }

        const futureSyllabus = await Syllabus.findOne({
            school: schoolId,
            classId,
            sectionId,
            subjectId,
            publishDate: { $gt: formattedPublishDate }
        }).select('title publishDate expireDate status').lean();

        if (futureSyllabus) {
            const message = `Cannot create syllabus. There's already a future syllabus "${futureSyllabus.title}" scheduled for ${futureSyllabus.publishDate}`;

            return res.status(409).json({
                message,
                existingSyllabus: {
                    _id: futureSyllabus._id,
                    title: futureSyllabus.title,
                    publishDate: futureSyllabus.publishDate,
                    expireDate: futureSyllabus.expireDate,
                    status: futureSyllabus.status
                }
            });
        }

        // Create syllabus
        const syllabus = await Syllabus.create({
            school: schoolId,
            classId,
            sectionId,
            subjectId,
            title,
            description,
            detail,
            uploadedBy: uploadedById,
            uploadedByModel: uploadedByModel,
            publishDate: formattedPublishDate,
            expireDate: formattedExpireDate,
            status: status || "draft",
        });

        const subject = await Subject.findById(subjectId)
            .select("name code")
            .lean();

        const classSectionInfo = await getClassSectionInfo(classId, sectionId, schoolId);

        const uploader = await resolveUploader(uploadedById, uploadedByModel);

        res.status(201).json({
            message: "Syllabus created successfully",
            syllabus: {
                _id: syllabus._id,
                title: syllabus.title,
                description: syllabus.description,
                detail: syllabus.detail,
                subject: {
                    _id: subjectId,
                    name: subject?.name || "Unknown",
                    code: subject?.code
                },
                class: classSectionInfo.class,
                section: classSectionInfo.section,
                uploader,
                publishDate: syllabus.publishDate,
                expireDate: syllabus.expireDate,
                status: syllabus.status,
                createdAt: syllabus.createdAt
            }
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// Get syllabus with filters 
const getSyllabus = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;

        const { classId, sectionId, subjectId, status, uploader } = req.query;
        const { page, limit, skip } = normalizePagination(req.query);

        const filter = { school: schoolId };

        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;
        if (subjectId) filter.subjectId = subjectId;
        if (status) filter.status = status;

        if (userRole === 'teacher') {
            const schedules = await Schedule.find({
                school: schoolId,
                teacherId: userId,
            }).lean();


            const teacherSubjects = [...new Set(
                schedules.map(s => s.subjectId?.toString()).filter(Boolean)
            )];

            if (classId || sectionId) {
                const filteredSchedules = schedules.filter(schedule => {
                    if (classId && schedule.classId?.toString() !== classId) return false;
                    if (sectionId && schedule.sectionId?.toString() !== sectionId) return false;
                    return true;
                });

                const filteredSubjects = [...new Set(
                    filteredSchedules.map(s => s.subjectId?.toString()).filter(Boolean)
                )];

                if (filteredSubjects.length > 0) {
                    filter.subjectId = { $in: filteredSubjects };
                } else {
                    return res.status(200).json({
                        total: 0,
                        page: 1,
                        limit,
                        totalPages: 0,
                        syllabus: []
                    });
                }
            } else if (teacherSubjects.length > 0) {
                filter.subjectId = { $in: teacherSubjects };
            } else {
                filter.uploadedBy = userId;
                filter.uploadedByModel = 'User';
            }

        } else if (userRole === 'admin_office') {
            if (uploader) {
                filter.uploadedBy = uploader;
            }
        } else if (userId.toString() === schoolId.toString()) {
            if (uploader) {
                filter.uploadedBy = uploader;
            }
        } else {
            filter.uploadedBy = userId;
            filter.uploadedByModel = 'User';
        }

        const [total, syllabus] = await Promise.all([
            Syllabus.countDocuments(filter),
            Syllabus.find(filter)
                .populate("subjectId", "name code")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const enhancedSyllabus = await getBatchClassSectionInfo(syllabus, schoolId);
        const syllabusWithUploaders = await Promise.all(
            enhancedSyllabus.map(async (item) => {
                const uploader = await resolveUploader(item.uploadedBy, item.uploadedByModel);

                return {
                    _id: item._id,
                    title: item.title,
                    description: item.description,
                    detail: item.detail,
                    subjectInfo: item.subjectId,
                    classInfo: item.class,
                    sectionInfo: item.section,
                    uploader,
                    publishDate: item.publishDate,
                    expireDate: item.expireDate,
                    status: item.status,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt
                };
            })
        );

        res.status(200).json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            syllabus: syllabusWithUploaders
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// Get syllabus by section (student/teacher view)
const getSyllabusBySection = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;
        const { sectionId } = req.params;

        const { status = "published", subjectId } = req.query;
        const { page, limit, skip } = normalizePagination(req.query);

        const classSection = await ClassSection.findOne({
            "sections._id": sectionId,
            school: schoolId
        }).lean();

        if (!classSection) {
            return res.status(404).json({ message: "Section not found in your school" });
        }

        const filter = {
            school: schoolId,
            sectionId,
            status
        };

        if (userRole === 'teacher' && !subjectId) {
            const teacherSubjects = await getTeacherAssignedSubjects(userId, schoolId);
            if (teacherSubjects.length > 0) {
                filter.subjectId = { $in: teacherSubjects };
            } else {
                return res.status(200).json({
                    total: 0,
                    page: 1,
                    limit,
                    totalPages: 0,
                    syllabi: []
                });
            }
        }

        if (subjectId) {
            filter.subjectId = subjectId;

            if (userRole === 'teacher') {
                const teacherAccess = await checkTeacherSubjectAccess(
                    userId,
                    subjectId,
                    classSection._id,
                    sectionId,
                    schoolId
                );

                if (!teacherAccess.hasAccess) {
                    return res.status(403).json({
                        message: "You don't have access to this subject's syllabus"
                    });
                }
            }
        }

        const [total, syllabi] = await Promise.all([
            Syllabus.countDocuments(filter),
            Syllabus.find(filter)
                .populate("subjectId", "name code")
                .sort({ publishDate: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const enhancedSyllabi = await getBatchClassSectionInfo(syllabi, schoolId);

        const syllabiWithUploaders = await Promise.all(
            enhancedSyllabi.map(async (item) => {
                const uploader = await resolveUploader(item.uploadedBy, item.uploadedByModel);

                return {
                    _id: item._id,
                    title: item.title,
                    description: item.description,
                    detail: item.detail,
                    subjectInfo: item.subjectId,
                    classInfo: item.class,
                    sectionInfo: item.section,
                    uploader,
                    publishDate: item.publishDate,
                    expireDate: item.expireDate
                };
            })
        );

        res.status(200).json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            syllabus: syllabiWithUploaders
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// Update syllabus with permission checks
const updateSyllabus = async (req, res) => {
    try {
        const { syllabusId } = req.params;
        const schoolId = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;
        const updateData = { ...req.body };

        const syllabus = await Syllabus.findById(syllabusId);
        if (!syllabus) {
            return res.status(404).json({ message: "Syllabus not found" });
        }

        if (syllabus.school.toString() !== schoolId.toString()) {
            return res.status(403).json({ message: "You can only update syllabi from your school" });
        }

        if (userRole === 'teacher') {
            if (
                syllabus.uploadedByModel !== 'User' ||
                syllabus.uploadedBy.toString() !== userId.toString()
            ) {
                return res.status(403).json({
                    message: "You can only update syllabus uploaded by you"
                });
            }
        }

        // const permissionCheck = await checkSyllabusUpdatePermission(syllabus, userId, userRole, schoolId);
        // if (!permissionCheck.canUpdate) {
        //     return res.status(403).json({ message: permissionCheck.message });
        // }

        const classId = updateData.classId || syllabus.classId;
        const sectionId = updateData.sectionId || syllabus.sectionId;
        const subjectId = updateData.subjectId || syllabus.subjectId;

        if (updateData.classId || updateData.sectionId) {
            const classSectionCheck = await validateClassSection(classId, sectionId, schoolId);
            if (!classSectionCheck.valid) {
                return res.status(400).json({ message: classSectionCheck.message });
            }
        }

        if (updateData.subjectId) {
            const subjectCheck = await validateSubjectAssignment(subjectId, classId, schoolId);
            if (!subjectCheck.valid) {
                return res.status(400).json({ message: subjectCheck.message });
            }

            // if (userRole === 'teacher') {
            //     const teacherAccess = await checkTeacherSubjectAccess(
            //         userId,
            //         subjectId,
            //         classId,
            //         sectionId,
            //         schoolId
            //     );

            //     if (!teacherAccess.hasAccess) {
            //         return res.status(403).json({
            //             message: "You are not assigned to teach the new subject"
            //         });
            //     }
            // }
        }

        let formattedExpireDate = updateData.expireDate;

        if (updateData.expireDate) {
            try {
                formattedExpireDate = formatDate(updateData.expireDate);
                updateData.expireDate = formattedExpireDate;
            } catch (error) {
                return res.status(400).json({ message: error.message });
            }
        }

        const finalPublishDate = syllabus.publishDate;
        const finalExpireDate = formattedExpireDate || syllabus.expireDate;

        if (finalExpireDate && finalExpireDate <= finalPublishDate) {
            return res.status(400).json({
                message: `Expire date must be after original publish date (${finalPublishDate})`
            });
        }

        // if (updateData.subjectId || updateData.expireDate) {
        //     const existingActiveSyllabus = await Syllabus.findOne({
        //         _id: { $ne: syllabusId },
        //         school: schoolId,
        //         classId,
        //         sectionId,
        //         subjectId,
        //         $or: [
        //             {
        //                 expireDate: { $gte: finalPublishDate }
        //             },
        //             {
        //                 expireDate: null
        //             },
        //             {
        //                 publishDate: { $lte: finalPublishDate },
        //                 expireDate: { $gte: finalPublishDate }
        //             }
        //         ]
        //     }).select('title publishDate expireDate status').lean();

        //     if (existingActiveSyllabus) {
        //         let message = '';

        //         if (existingActiveSyllabus.expireDate) {
        //             message = `Cannot update syllabus. Original publish date (${finalPublishDate}) is before the expiry date (${existingActiveSyllabus.expireDate}) of existing syllabus "${existingActiveSyllabus.title}".`;
        //         } else {
        //             message = `Cannot update syllabus. Existing syllabus "${existingActiveSyllabus.title}" has no expiry date and is permanently active.`;
        //         }

        //         return res.status(409).json({
        //             message,
        //             existingSyllabus: {
        //                 _id: existingActiveSyllabus._id,
        //                 title: existingActiveSyllabus.title,
        //                 publishDate: existingActiveSyllabus.publishDate,
        //                 expireDate: existingActiveSyllabus.expireDate,
        //                 status: existingActiveSyllabus.status
        //             }
        //         });
        //     }
        // }

        delete updateData.uploadedBy;
        delete updateData.uploadedByModel;
        delete updateData.publishDate;

        const updatedSyllabus = await Syllabus.findByIdAndUpdate(
            syllabusId,
            updateData,
            { new: true, runValidators: true }
        ).populate("subjectId", "name code");

        const classSectionInfo = await getClassSectionInfo(
            updatedSyllabus.classId,
            updatedSyllabus.sectionId,
            schoolId
        );

        const uploader = await resolveUploader(
            updatedSyllabus.uploadedBy,
            updatedSyllabus.uploadedByModel
        );

        res.status(200).json({
            message: "Syllabus updated successfully",
            syllabus: {
                _id: updatedSyllabus._id,
                title: updatedSyllabus.title,
                description: updatedSyllabus.description,
                detail: updatedSyllabus.detail,
                subject: updatedSyllabus.subjectId,
                class: classSectionInfo.class,
                section: classSectionInfo.section,
                uploader,
                publishDate: updatedSyllabus.publishDate,
                expireDate: updatedSyllabus.expireDate,
                status: updatedSyllabus.status,
                updatedAt: updatedSyllabus.updatedAt
            }
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// Delete syllabus with permission checks
const deleteSyllabus = async (req, res) => {
    try {
        const { syllabusId } = req.params;
        const schoolId = req.user.school;
        const userId = req.user._id;
        const userRole = req.user.role;

        const syllabus = await Syllabus.findById(syllabusId);
        if (!syllabus) {
            return res.status(404).json({ message: "Syllabus not found" });
        }

        if (syllabus.school.toString() !== schoolId.toString()) {
            return res.status(403).json({ message: "You can only delete syllabus from your school" });
        }

        if (userRole === 'teacher') {
            if (
                syllabus.uploadedByModel !== 'User' ||
                syllabus.uploadedBy.toString() !== userId.toString()
            ) {
                return res.status(403).json({
                    message: "You can only update syllabus uploaded by you"
                });
            }
        }

        await syllabus.deleteOne();

        res.status(200).json({
            message: "Syllabus deleted successfully",
            deletedSyllabus: {
                _id: syllabus._id,
                title: syllabus.title,
                classId: syllabus.classId,
                subjectId: syllabus.subjectId
            }
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    createSyllabus,
    getSyllabus,
    getSyllabusBySection,
    updateSyllabus,
    deleteSyllabus
};