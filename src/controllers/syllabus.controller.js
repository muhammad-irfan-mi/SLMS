const ClassSection = require("../models/ClassSection");
const Subject = require("../models/Subject");
const User = require("../models/User");
const School = require("../models/School");
const Syllabus = require("../models/Syllabus");

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

// Resolve uploader (user or school)
const resolveUploader = async (uploadedById) => {
    if (!uploadedById) return null;

    // Try to find as User first
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

    // Try to find as School
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

    return null;
};

// Validate subject belongs to class and school
const validateSubjectAssignment = async (subjectId, classId, schoolId) => {
    const subject = await Subject.findOne({
        _id: subjectId,
        class: classId,
        school: schoolId
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

// Validate class and section belong to school
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

// Format date
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

// Normalize pagination
const normalizePagination = (query) => {
    const page = Math.max(parseInt(query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    return { page, limit, skip };
};


// Create syllabus with school boundary check
const createSyllabus = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const userRole = req.user.role;

        const { classId, sectionId, subjectId, title, description, detail, expireDate, status } = req.body;

        const classSectionCheck = await validateClassSection(classId, sectionId, schoolId);
        if (!classSectionCheck.valid) {
            return res.status(400).json({ message: classSectionCheck.message });
        }

        const subjectCheck = await validateSubjectAssignment(subjectId, classId, schoolId);
        if (!subjectCheck.valid) {
            return res.status(400).json({ message: subjectCheck.message });
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
                // current date is before expiry
                {
                    expireDate: { $gte: formattedPublishDate }
                },
                // Syllabus has no expire date 
                {
                    expireDate: null
                },
                // Current date falls within existing syllabus date range
                {
                    publishDate: { $lte: formattedPublishDate },
                    expireDate: { $gte: formattedPublishDate }
                }
            ]
        }).select('title publishDate expireDate status').lean();

        if (existingActiveSyllabus) {
            let message = '';
            let suggestedDate = null;

            if (existingActiveSyllabus.expireDate) {
                const nextDate = new Date(existingActiveSyllabus.expireDate);
                nextDate.setDate(nextDate.getDate() + 1);
                suggestedDate = formatDate(nextDate);

                message = `Cannot create syllabus. Current date (${formattedPublishDate}) is before the expiry date (${existingActiveSyllabus.expireDate}) of existing syllabus`;
            } else {
                message = `Cannot create new syllabus for this subject.`;
            }
        }

        const futureSyllabus = await Syllabus.findOne({
            school: schoolId,
            classId,
            sectionId,
            subjectId,
            publishDate: { $gt: formattedPublishDate }
        }).select('title publishDate expireDate status').lean();

        if (futureSyllabus) {
            const message = `Cannot create syllabus. There's already a future syllabus`;

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

        const syllabus = await Syllabus.create({
            school: schoolId,
            classId,
            sectionId,
            subjectId,
            title,
            description,
            detail,
            // uploadedBy: uploadedById,
            publishDate: formattedPublishDate,
            expireDate: formattedExpireDate,
            status: status || "draft",
        });

        const subject = await Subject.findById(subjectId)
            .select("name code")
            .lean();

        const classSectionInfo = await getClassSectionInfo(classId, sectionId, schoolId);

        // const uploader = await resolveUploader(uploadedById);

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
                // uploader,
                publishDate: syllabus.publishDate,
                expireDate: syllabus.expireDate,
                status: syllabus.status,
                createdAt: syllabus.createdAt
            }
        });

    } catch (err) {
        console.error("Create Syllabus Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Get syllabus with filters (admin/office view)
const getSyllabus = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const { classId, sectionId, subjectId, status } = req.query;
        const { page, limit, skip } = normalizePagination(req.query);

        const filter = { school: schoolId };
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;
        if (subjectId) filter.subjectId = subjectId;
        if (status) filter.status = status;

        const [total, syllabi] = await Promise.all([
            Syllabus.countDocuments(filter),
            Syllabus.find(filter)
                .populate("subjectId", "name code")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const enhancedSyllabi = await getBatchClassSectionInfo(syllabi, schoolId);

        const syllabiWithUploaders = await Promise.all(
            enhancedSyllabi.map(async (item) => {

                return {
                    _id: item._id,
                    title: item.title,
                    description: item.description,
                    detail: item.detail,
                    subject: item.subjectId,
                    class: item.class,
                    section: item.section,
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
            syllabi: syllabiWithUploaders
        });

    } catch (err) {
        console.error("Get Syllabus Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Get syllabus by section (student/teacher view)
const getSyllabusBySection = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const { sectionId } = req.params;
        const { status = "published" } = req.query;
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

                return {
                    _id: item._id,
                    title: item.title,
                    description: item.description,
                    detail: item.detail,
                    subject: item.subjectId,
                    class: item.class,
                    section: item.section,
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
            syllabi: syllabiWithUploaders
        });

    } catch (err) {
        console.error("Get Syllabus By Section Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Update syllabus with school boundary check
const updateSyllabus = async (req, res) => {
    try {
        const { syllabusId } = req.params;
        const schoolId = req.user.school;
        const updateData = { ...req.body };

        const syllabus = await Syllabus.findById(syllabusId);
        if (!syllabus) {
            return res.status(404).json({ message: "Syllabus not found" });
        }

        if (syllabus.school.toString() !== schoolId.toString()) {
            return res.status(403).json({ message: "You can only update syllabi from your school" });
        }

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
        }

        let formattedExpireDate = updateData.expireDate;

        if (updateData.publishDate) {
            return res.status(400).json({
                message: "Publish date cannot be changed. It is automatically set to the creation date."
            });
        }

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

        if (updateData.subjectId || updateData.expireDate) {
            const today = formatDate(new Date());

            const existingActiveSyllabus = await Syllabus.findOne({
                _id: { $ne: syllabusId }, 
                school: schoolId,
                classId,
                sectionId,
                subjectId,
                $or: [
                    {
                        expireDate: { $gte: finalPublishDate }
                    },
                    {
                        expireDate: null
                    },
                    {
                        publishDate: { $lte: finalPublishDate },
                        expireDate: { $gte: finalPublishDate }
                    }
                ]
            }).select('title publishDate expireDate status').lean();

            if (existingActiveSyllabus) {
                let message = '';

                if (existingActiveSyllabus.expireDate) {
                    message = `Cannot update syllabus. Original publish date (${finalPublishDate}) is before the expiry date (${existingActiveSyllabus.expireDate}) of existing syllabus "${existingActiveSyllabus.title}".`;
                } else {
                    message = `Cannot update syllabus. Existing syllabus "${existingActiveSyllabus.title}" has no expiry date and is permanently active.`;
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
        }

        // Update syllabus (excluding publishDate)
        delete updateData.publishDate; // Ensure publishDate cannot be updated

        const updatedSyllabus = await Syllabus.findByIdAndUpdate(
            syllabusId,
            updateData,
            { new: true, runValidators: true }
        ).populate("subjectId", "name code");

        // Get class and section info using helper
        const classSectionInfo = await getClassSectionInfo(
            updatedSyllabus.classId,
            updatedSyllabus.sectionId,
            schoolId
        );

        const uploader = await resolveUploader(updatedSyllabus.uploadedBy);

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
        console.error("Update Syllabus Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Delete syllabus with school boundary check
const deleteSyllabus = async (req, res) => {
    try {
        const { syllabusId } = req.params;
        const schoolId = req.user.school;

        const syllabus = await Syllabus.findById(syllabusId);
        if (!syllabus) {
            return res.status(404).json({ message: "Syllabus not found" });
        }

        if (syllabus.school.toString() !== schoolId.toString()) {
            return res.status(403).json({ message: "You can only delete syllabi from your school" });
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
        console.error("Delete Syllabus Error:", err);
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