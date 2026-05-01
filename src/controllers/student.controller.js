// controllers/student.controller.js
const Student = require("../models/Student");
const ClassSection = require("../models/ClassSection");
const School = require("../models/School");
const common = require("./common.controller");
const { sendProfileUpdateNotification, sendEmailChangeNotification } = require("../utils/notificationService");

// Get class and section info
const getClassAndSection = async (classId, sectionId, schoolId) => {
    if (!classId) return { classInfo: null, sectionInfo: null };

    const classDoc = await ClassSection.findOne({
        _id: classId,
        school: schoolId
    });

    if (!classDoc) {
        return { error: "Class not found or does not belong to your school" };
    }

    const classInfo = {
        id: classDoc._id,
        name: classDoc.class
    };

    let sectionInfo = null;

    if (sectionId) {
        const sectionObj = classDoc.sections.find(
            (sec) => sec._id.toString() === sectionId
        );
        if (!sectionObj) return { error: "Invalid section ID for this class" };

        sectionInfo = {
            id: sectionObj._id,
            name: sectionObj.name
        };
    }

    return { classInfo, sectionInfo };
};

// Helper function to get class fee and validate discount
const validateAndGetClassFee = async (classId, schoolId, discount, isFixed) => {
    const classDoc = await ClassSection.findOne({ _id: classId, school: schoolId });
    if (!classDoc) {
        throw new Error('Class not found');
    }

    const classFee = classDoc.fee || 0;

    if (isFixed === true) {
        if (discount >= classFee) {
            throw new Error(`Fixed students cannot have discount (${discount}) greater than or equal to class fee (${classFee})`);
        }
    } else {
        if (discount < 0 || discount > 100) {
            throw new Error(`Discount must be between 0 and 100 for non-fixed students`);
        }
    }

    return { classDoc, classFee };
};

// Generate unique username
const generateUniqueUsername = async (name, email, schoolId) => {
    const baseUsername = name.toLowerCase().replace(/\s+/g, '_');
    let username = baseUsername;
    let counter = 1;

    const existing = await Student.findOne({
        email: { $regex: new RegExp(`^${email}$`, 'i') },
        username: username,
        school: schoolId
    });

    if (!existing) {
        return username;
    }

    while (true) {
        username = `${baseUsername}_${counter}`;
        const existing = await Student.findOne({
            email: { $regex: new RegExp(`^${email}$`, 'i') },
            username: username,
            school: schoolId
        });

        if (!existing) {
            return username;
        }
        counter++;
    }
};

// Add student
const addStudent = async (req, res) => {
    try {
        const {
            name,
            username,
            email,
            phone,
            address,
            cnic,
            fatherName,
            classId,
            sectionId,
            rollNo,
            parentEmail,
            isFixed,
            discount
        } = req.body;

        const schoolId = req.user.school;

        let classDoc;
        try {
            const result = await validateAndGetClassFee(classId, schoolId, discount || 0, isFixed || false);
            classDoc = result.classDoc;
        } catch (error) {
            return res.status(400).json({ message: error.message });
        }

        const existingUsername = await Student.findOne({
            username: username.toLowerCase(),
            school: schoolId
        });

        if (existingUsername) {
            return res.status(400).json({
                message: "Username already taken"
            });
        }

        // const classDoc = await ClassSection.findOne({ _id: classId, school: schoolId });
        // if (!classDoc) {
        //     return res.status(400).json({ message: "Class not found" });
        // }

        if (sectionId) {
            const sectionExists = classDoc.sections.some(
                sec => sec._id.toString() === sectionId
            );
            if (!sectionExists) {
                return res.status(400).json({ message: "Section not found in this class" });
            }
        }

        if (rollNo) {
            const rollExists = await Student.findOne({
                school: schoolId,
                "classInfo.id": classId,
                "sectionInfo.id": sectionId,
                rollNo: rollNo,
                isActive: true
            });

            if (rollExists) {
                return res.status(400).json({
                    message: `Roll number "${rollNo}" already exists in this class/section`
                });
            }
        }

        const emailInOtherSchool = await Student.findOne({
            email: { $regex: new RegExp(`^${email}$`, 'i') },
            school: { $ne: schoolId },
            isActive: true
        });

        if (emailInOtherSchool) {
            return res.status(400).json({
                message: `Email ${email} is already registered as active student in another school`
            });
        }

        const existingSiblings = await Student.find({
            email: { $regex: new RegExp(`^${email}$`, 'i') },
            school: schoolId
        });

        let siblingGroupId = null;
        if (existingSiblings.length > 0) {
            siblingGroupId = existingSiblings[0].siblingGroupId || existingSiblings[0]._id;
        }

        const otpCode = common.generateOTP();
        const otpExpiry = common.calculateOTPExpiry(10);

        const images = await common.uploadFiles(req.files);

        const student = new Student({
            name,
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            phone,
            address,
            cnic,
            fatherName,
            role: "student",
            rollNo,
            classInfo: {
                id: classId,
            },
            sectionInfo: {
                id: sectionId,
            },
            school: schoolId,
            images,
            siblingGroupId,
            parentEmail: parentEmail?.toLowerCase(),
            isFixed: isFixed || false,
            discount: discount || 0,
            verified: false,
            isActive: true,
            otp: {
                code: otpCode,
                expiresAt: otpExpiry,
                attempts: 0,
                lastAttempt: new Date()
            },
            verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });

        await student.save();

        if (existingSiblings.length > 0) {
            await Student.updateMany(
                { email: { $regex: new RegExp(`^${email}$`, 'i') }, school: schoolId },
                { $set: { siblingGroupId: siblingGroupId || student._id } }
            );
        }

        await School.findByIdAndUpdate(schoolId, { $inc: { noOfStudents: 1 } });

        const emailService = require("../services/email.service");
        await emailService.sendStudentRegistrationEmail(
            email,
            otpCode,
            name,
            username,
            schoolId
        );

        return res.status(201).json({
            message: "Student added successfully. OTP sent for verification.",
            studentId: student._id,
            username: student.username,
        });

    } catch (err) {
        return res.status(500).json({
            message: err.message || "Server error while adding student"
        });
    }
};

// Update student
const updateStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.school;

        const student = await Student.findOne({
            _id: id,
            school: schoolId,
            isActive: true
        });

        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        const {
            name,
            username,
            email,
            phone,
            address,
            cnic,
            fatherName,
            classId,
            sectionId,
            rollNo,
            parentEmail,
            isFixed,
            discount
        } = req.body;

        const changes = [];

        let finalIsFixed = student.isFixed;
        let finalDiscount = student.discount;

        if (isFixed !== undefined) {
            finalIsFixed = isFixed;
        }

        if (discount !== undefined) {
            finalDiscount = discount;
        }

        if (classId) {
            try {
                await validateAndGetClassFee(classId, schoolId, finalDiscount, finalIsFixed);
            } catch (error) {
                return res.status(400).json({ message: error.message });
            }
        } else if (student.classInfo?.id) {
            try {
                await validateAndGetClassFee(student.classInfo.id, schoolId, finalDiscount, finalIsFixed);
            } catch (error) {
                return res.status(400).json({ message: error.message });
            }
        }

        // Track changes
        if (name && name !== student.name) {
            changes.push(`Name changed from "${student.name}" to "${name}"`);
        }
        if (phone && phone !== student.phone) {
            changes.push(`Phone number updated`);
        }
        if (address && address !== student.address) {
            changes.push(`Address updated`);
        }
        if (fatherName && fatherName !== student.fatherName) {
            changes.push(`Father's name updated`);
        }
        if (cnic && cnic !== student.cnic) {
            changes.push(`CNIC updated`);
        }
        if (discount && discount !== student.discount) {
            changes.push(`Discount updated`);
        }
        if (isFixed !== undefined && isFixed !== student.isFixed) {
            changes.push(`Fixed status changed from ${student.isFixed} to ${isFixed}`);
        }

        // Check username uniqueness if changed
        if (username && username.toLowerCase() !== student.username) {
            const existingUsername = await Student.findOne({
                username: username.toLowerCase(),
                school: schoolId,
                _id: { $ne: id }
            });

            if (existingUsername) {
                return res.status(400).json({ message: "Username already taken" });
            }
            changes.push(`Username changed from "${student.username}" to "${username}"`);
            student.username = username.toLowerCase();
        }

        // Handle class/section change
        let classInfo = student.classInfo;
        let sectionInfo = student.sectionInfo;

        if (classId) {
            const result = await getClassAndSection(classId, sectionId, schoolId);
            if (result.error) {
                return res.status(400).json({ message: result.error });
            }

            if (classInfo?.id?.toString() !== classId) {
                changes.push(`Class changed from ${student.classInfo?.name || 'Previous class'} to ${result.classInfo.name}`);
            }

            if (sectionId && sectionInfo?.id?.toString() !== sectionId) {
                changes.push(`Section changed from ${student.sectionInfo?.name || 'Previous section'} to ${result.sectionInfo.name}`);
            }

            classInfo = result.classInfo;
            sectionInfo = result.sectionInfo;
        }

        // Check roll number uniqueness if changed
        if (rollNo && rollNo !== student.rollNo) {
            const rollExists = await Student.findOne({
                school: schoolId,
                "classInfo.id": classInfo?.id || student.classInfo.id,
                "sectionInfo.id": sectionInfo?.id || student.sectionInfo.id,
                rollNo: rollNo,
                isActive: true,
                _id: { $ne: id }
            });

            if (rollExists) {
                return res.status(400).json({
                    message: `Roll number "${rollNo}" already exists in this class/section`
                });
            }
            changes.push(`Roll number changed from "${student.rollNo || 'Not set'}" to "${rollNo}"`);
            student.rollNo = rollNo;
        }

        let otpData = student.otp;
        let verified = student.verified;
        let emailChanged = false;
        let oldEmail = null;

        if (email && email.toLowerCase() !== student.email.toLowerCase()) {
            oldEmail = student.email;
            emailChanged = true;
            changes.push(`Email changed from ${student.email} to ${email}`);

            const emailExists = await Student.findOne({
                _id: { $ne: id },
                email: { $regex: new RegExp(`^${email}$`, 'i') },
                school: schoolId,
                isActive: true
            });

            if (emailExists) {
                return res.status(400).json({
                    message: `Email "${email}" already exists for another student`
                });
            }

            const otpCode = common.generateOTP();
            otpData = {
                code: otpCode,
                expiresAt: common.calculateOTPExpiry(10),
                attempts: 0,
                lastAttempt: new Date()
            };
            verified = false;

            const emailService = require("../services/email.service");
            await emailService.sendUserOTPEmail(
                email.toLowerCase(),
                otpCode,
                name || student.name,
                schoolId,
                student.role
            );
        }

        if (name) student.name = name;
        if (email) student.email = email.toLowerCase();
        if (phone !== undefined) student.phone = phone;
        if (address !== undefined) student.address = address;
        if (cnic !== undefined) student.cnic = cnic;
        if (discount !== undefined) student.discount = discount;
        if (isFixed !== undefined) student.isFixed = isFixed;
        if (fatherName !== undefined) student.fatherName = fatherName;
        if (parentEmail !== undefined) student.parentEmail = parentEmail?.toLowerCase();

        student.classInfo = classInfo;
        student.sectionInfo = sectionInfo;

        if (req.files && Object.keys(req.files).length > 0) {
            student.images = await common.uploadFiles(req.files, student.images);
        }

        if (emailChanged) {
            student.otp = otpData;
            student.verified = verified;
        }

        student.updatedAt = new Date();
        await student.save();

        try {
            if (changes.length > 0) {
                await sendProfileUpdateNotification({
                    user: {
                        _id: student._id,
                        name: name || student.name,
                        email: email || student.email,
                        school: schoolId,
                        role: student.role
                    },
                    updatedBy: req.user._id,
                    changes,
                    updateType: 'selected_students'
                });
            }

            if (emailChanged && oldEmail) {
                await sendEmailChangeNotification({
                    user: {
                        _id: student._id,
                        name: name || student.name,
                        school: schoolId,
                        role: student.role
                    },
                    oldEmail,
                    newEmail: email.toLowerCase(),
                    updatedBy: req.user._id
                });
            }
        } catch (notificationError) {
            console.error('Error sending notifications:', notificationError.message);
        }

        return res.status(200).json({
            message: emailChanged
                ? "Student updated successfully. OTP sent to new email for verification."
                : "Student updated successfully",
            student: {
                id: student._id,
                name: student.name,
                username: student.username,
                email: student.email,
            }
        });

    } catch (err) {
        console.error("Error updating student:", err);
        return res.status(500).json({
            message: err.message || "Server error while updating student"
        });
    }
};

// Get all students
const getAllStudents = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const {
            page = 1,
            limit = 10,
            classId,
            sectionId,
            search
        } = req.query;

        const filter = {
            school: schoolId,
            role: "student",
            isActive: true
        };

        if (classId) {
            filter["classInfo.id"] = classId;
        }

        if (sectionId) {
            filter["sectionInfo.id"] = sectionId;
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { rollNo: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [students, total] = await Promise.all([
            Student.find(filter)
                .select("-password -otp -forgotPasswordOTP -tokenVersion")
                .skip(skip)
                .limit(parseInt(limit))
                .sort({ "classInfo.id": 1, "sectionInfo.id": 1, rollNo: 1 })
                .lean(),
            Student.countDocuments(filter)
        ]);

        const classIds = [...new Set(students.map(s => s.classInfo?.id).filter(id => id))];

        const classes = await ClassSection.find({
            _id: { $in: classIds },
            school: schoolId
        }).lean();

        const classMap = new Map();
        classes.forEach(cls => {
            classMap.set(cls._id.toString(), cls);
        });

        const formattedStudents = students.map(student => {
            const studentObj = { ...student };

            if (studentObj.classInfo?.id) {
                const classDoc = classMap.get(studentObj.classInfo.id.toString());
                if (classDoc) {
                    studentObj.classInfo = {
                        id: classDoc._id,
                        name: classDoc.class
                    };

                    if (studentObj.sectionInfo?.id && classDoc.sections) {
                        const section = classDoc.sections.find(
                            sec => sec._id.toString() === studentObj.sectionInfo.id.toString()
                        );
                        if (section) {
                            studentObj.sectionInfo = {
                                id: section._id,
                                name: section.name
                            };
                        }
                    }
                }
            }

            return studentObj;
        });

        return res.status(200).json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
            students: formattedStudents
        });

    } catch (err) {
        console.error("Error fetching students:", err);
        return res.status(500).json({
            message: err.message || "Server error while fetching students"
        });
    }
};

// Get student by ID
const getStudentById = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.school;

        const student = await Student.findById(id)
            .select("-password -otp -forgotPasswordOTP")
            .populate('school', 'name images.logo')
            .lean();

        if (!student || student.role !== "student") {
            return res.status(404).json({ message: "Student not found" });
        }

        if (student.school?._id.toString() !== schoolId.toString()) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        if (student.school) {
            student.school = {
                _id: student.school._id,
                name: student.school.name,
                logo: student.school.images?.logo || null
            };
        }

        // Get class and section names
        let classInfoWithName = student.classInfo;
        let sectionInfoWithName = student.sectionInfo;

        if (student.classInfo?.id) {
            const classDoc = await ClassSection.findOne({
                _id: student.classInfo.id,
                school: schoolId
            }).lean();

            if (classDoc) {
                classInfoWithName = {
                    id: classDoc._id,
                    name: classDoc.class
                };

                if (student.sectionInfo?.id) {
                    const section = classDoc.sections?.find(
                        sec => sec._id.toString() === student.sectionInfo.id.toString()
                    );
                    if (section) {
                        sectionInfoWithName = {
                            id: section._id,
                            name: section.name
                        };
                    }
                }
            }
        }

        // Get siblings with their class/section names
        // const siblings = await Student.find({
        //     $or: [
        //         { siblingGroupId: student.siblingGroupId },
        //         { email: student.email, school: schoolId, _id: { $ne: id } }
        //     ]
        // })
        //     .select("name username classInfo sectionInfo rollNo email discount isFixed")
        //     .lean();

        // const enrichedSiblings = await Promise.all(siblings.map(async (sibling) => {
        //     let siblingClassInfo = sibling.classInfo;
        //     let siblingSectionInfo = sibling.sectionInfo;

        //     if (sibling.classInfo?.id) {
        //         const classDoc = await ClassSection.findOne({
        //             _id: sibling.classInfo.id,
        //             school: schoolId
        //         }).lean();

        //         if (classDoc) {
        //             siblingClassInfo = {
        //                 id: classDoc._id,
        //                 name: classDoc.class
        //             };

        //             if (sibling.sectionInfo?.id) {
        //                 const section = classDoc.sections?.find(
        //                     sec => sec._id.toString() === sibling.sectionInfo.id.toString()
        //                 );
        //                 if (section) {
        //                     siblingSectionInfo = {
        //                         id: section._id,
        //                         name: section.name
        //                     };
        //                 }
        //             }
        //         }
        //     }

        //     return {
        //         ...sibling,
        //         classInfo: siblingClassInfo,
        //         sectionInfo: siblingSectionInfo
        //     };
        // }));

        const studentResponse = {
            ...student,
            classInfo: classInfoWithName,
            sectionInfo: sectionInfoWithName
        };

        return res.status(200).json({
            student: studentResponse,
            // siblings: enrichedSiblings,
            // siblingCount: enrichedSiblings.length
        });

    } catch (err) {
        console.error("Error fetching student:", err);
        return res.status(500).json({
            message: err.message || "Server error while fetching student"
        });
    }
};

// Get students by section
const getStudentsBySection = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const { sectionId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const filter = {
            school: schoolId,
            role: "student",
            isActive: true,
            "sectionInfo.id": sectionId
        };

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [students, total] = await Promise.all([
            Student.find(filter)
                .select("-password -otp -forgotPasswordOTP -tokenVersion")
                .skip(skip)
                .limit(parseInt(limit))
                .sort({ rollNo: 1 }),
            Student.countDocuments(filter)
        ]);

        return res.status(200).json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
            students
        });

    } catch (err) {
        console.error("Error fetching students by section:", err);
        return res.status(500).json({
            message: err.message || "Server error while fetching students by section"
        });
    }
};

// Get students by parent email
const getStudentsByParentEmail = async (req, res) => {
    try {
        const { email } = req.params;
        const schoolId = req.user.school;

        const students = await Student.find({
            parentEmail: { $regex: new RegExp(`^${email}$`, 'i') },
            school: schoolId,
            role: "student",
            isActive: true
        })
            .select("name username classInfo sectionInfo rollNo discount")
            .sort({ "classInfo.id": 1, rollNo: 1 });

        return res.status(200).json({
            message: "Students fetched successfully",
            total: students.length,
            parentEmail: email,
            students
        });

    } catch (err) {
        console.error("Error fetching students by parent email:", err);
        return res.status(500).json({
            message: err.message || "Server error while fetching students by parent email"
        });
    }
};

// Get student siblings by email
const getStudentSiblingsByEmail = async (req, res) => {
    try {
        const { email } = req.params;
        const schoolId = req.user.school;

        const siblings = await Student.find({
            email: { $regex: new RegExp(`^${email}$`, 'i') },
            role: "student",
            isActive: true,
            school: schoolId
        }).select("name username email classInfo sectionInfo rollNo discount");

        return res.status(200).json({
            message: "Student siblings fetched successfully",
            total: siblings.length,
            siblings
        });

    } catch (err) {
        console.error("Error fetching student siblings:", err);
        return res.status(500).json({
            message: err.message || "Server error while fetching student siblings"
        });
    }
};

// Get deleted students
const getDeletedStudents = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const {
            page = 1,
            limit = 10,
            classId,
            sectionId,
            year,
            status,
            search
        } = req.query;

        const filter = {
            school: schoolId,
            isActive: false
        };

        if (status === 'passout') {
            filter.status = 'passout';
        } else if (status === 'left') {
            filter.status = 'left';
        } else if (status === 'deactivated') {
            filter.status = { $ne: 'active' };
        } else {
            filter.status = { $in: ['passout', 'left'] };
        }

        if (classId) {
            filter["classInfo.id"] = classId;
        }
        if (sectionId) {
            filter["sectionInfo.id"] = sectionId;
        }

        if (year) {
            const startDate = new Date(`${year}-01-01`);
            const endDate = new Date(`${year}-12-31`);
            filter["historyInfo.date"] = { $gte: startDate, $lte: endDate };
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { rollNo: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [students, total] = await Promise.all([
            Student.find(filter)
                .select("-password -otp -forgotPasswordOTP -tokenVersion")
                .skip(skip)
                .limit(parseInt(limit))
                .sort({ deactivatedAt: -1, createdAt: -1 })
                .lean(),
            Student.countDocuments(filter)
        ]);

        const classIds = new Set();

        students.forEach(student => {
            if (student.classInfo?.id) {
                classIds.add(student.classInfo.id.toString());
            }
            if (student.historyInfo?.classId) {
                classIds.add(student.historyInfo.classId.toString());
            }
        });

        const classes = await ClassSection.find({
            _id: { $in: Array.from(classIds) },
            school: schoolId
        }).lean();

        const classMap = new Map();
        classes.forEach(cls => {
            classMap.set(cls._id.toString(), cls);
        });

        const getClassSectionInfo = (classId, sectionId) => {
            if (!classId) return { classInfo: null, sectionInfo: null };

            const classDoc = classMap.get(classId.toString());
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

        const studentsWithNames = students.map(student => {
            const studentObj = { ...student };

            if (studentObj.classInfo?.id) {
                const { classInfo, sectionInfo } = getClassSectionInfo(
                    studentObj.classInfo.id,
                    studentObj.sectionInfo?.id
                );
                studentObj.classInfo = classInfo;
                studentObj.sectionInfo = sectionInfo;
            }

            if (studentObj.historyInfo?.classId) {
                const { classInfo, sectionInfo } = getClassSectionInfo(
                    studentObj.historyInfo.classId,
                    studentObj.historyInfo.sectionId
                );

                studentObj.historyInfo = {
                    classInfo: classInfo,
                    sectionInfo: sectionInfo,
                    date: studentObj.historyInfo.date,
                    reason: studentObj.historyInfo.reason
                };
            }

            return studentObj;
        });


        return res.status(200).json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
            students: studentsWithNames
        });

    } catch (err) {
        console.error("Error fetching students:", err);
        return res.status(500).json({
            message: err.message || "Server error while fetching students"
        });
    }
};

// Update own profile
const updateOwnProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const student = await Student.findById(userId);

        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        const updatedImages = await common.uploadFiles(req.files, student.images);

        const updatableFields = {
            name: req.body.name ?? student.name,
            phone: req.body.phone ?? student.phone,
            address: req.body.address ?? student.address,
            cnic: req.body.cnic ?? student.cnic,
            fatherName: req.body.fatherName ?? student.fatherName,
            images: updatedImages,
            updatedAt: new Date()
        };

        const updated = await Student.findByIdAndUpdate(
            userId,
            updatableFields,
            { new: true }
        ).select("-password -otp -forgotPasswordOTP");

        return res.status(200).json({
            message: "Profile updated successfully",
            user: updated
        });

    } catch (err) {
        console.error("Error updating profile:", err);
        return res.status(500).json({
            message: err.message || "Server error while updating profile"
        });
    }
};

const deleteOwnAccount = async (req, res) => {
    const { role } = req.user;
    let Model;

    if (['student', 'admin_office'].includes(role)) {
        Model = Student;
    } else {
        return res.status(400).json({
            success: false,
            message: "Invalid user type for account deletion"
        });
    }

    return common.toggleUserStatus(req, res, Model, true);
};

const restoreOwnAccount = async (req, res) => {
    try {
        const userId = req.params.userId;
        const schoolId = req.user.school;
        const role = req.user.role || 'school';

        let Model = Student;
        if (['school', 'admin_office'].includes(!role)) {
            return res.status(400).json({
                success: false,
                message: "You are not eligible to restore this account."
            });
        }

        const user = await Model.findOne({
            _id: userId,
            school: schoolId,
            isActive: false
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No deactivated account found"
            });
        }

        if (user.isActive !== false) {
            return res.status(400).json({
                success: false,
                message: "User account is already active"
            });
        }

        if (!user.deactivatedAt) {
            return res.status(400).json({
                success: false,
                message: "User account is not marked for deletion"
            });
        }

        const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
        const timeSinceDeactivation = Date.now() - new Date(user.deactivatedAt).getTime();

        if (timeSinceDeactivation >= sevenDaysInMs) {
            return res.status(400).json({
                success: false,
                message: "Account cannot be restored. 7 days have already passed. Account is permanently deactivated.",
                canRestore: false,
                deactivatedAt: user.deactivatedAt,
                daysPassed: Math.floor(timeSinceDeactivation / (24 * 60 * 60 * 1000))
            });
        }

        if (user.isRestorable === false) {
            return res.status(400).json({
                success: false,
                message: "Account is not eligible for restoration."
            });
        }

        user.isActive = true;
        user.deactivatedAt = null;
        user.isRestorable = true;
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();

        return res.status(200).json({
            success: true,
            message: `Account restored successfully for ${user.name}`,
        });

    } catch (err) {
        console.error("restoreOwnAccount error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

// Toggle student status
const toggleStudentStatus = async (req, res) => {
    return common.toggleUserStatus(req, res, Student);
};

// Auth functions using common controller
const sendOTP = (req, res) => common.sendOTP(req, res, Student, 'student');
const verifyOTP = (req, res) => common.verifyOTP(req, res, Student, 'student');
const resendOTP = (req, res) => common.resendOTP(req, res, Student, 'student');
const setPasswordAfterOTP = (req, res) => common.setPasswordAfterOTP(req, res, Student, 'student');
const forgotPassword = (req, res) => common.forgotPassword(req, res, Student, 'student');
const verifyForgotPasswordOTP = (req, res) => common.verifyForgotPasswordOTP(req, res, Student, 'student');
const resetPasswordWithOTP = (req, res) => common.resetPasswordWithOTP(req, res, Student, 'student');
const resetPassword = (req, res) => common.resetPassword(req, res, Student, 'student');
const resendForgotPasswordOTP = (req, res) => common.resendForgotPasswordOTP(req, res, Student, 'student');
const login = (req, res) => common.login(req, res, Student, 'student');

module.exports = {
    addStudent,
    updateStudent,
    getAllStudents,
    getStudentById,
    getStudentsBySection,
    getStudentsByParentEmail,
    getStudentSiblingsByEmail,
    getDeletedStudents,
    updateOwnProfile,
    deleteOwnAccount,
    restoreOwnAccount,
    toggleStudentStatus,
    sendOTP,
    verifyOTP,
    resendOTP,
    setPasswordAfterOTP,
    forgotPassword,
    verifyForgotPasswordOTP,
    resetPasswordWithOTP,
    resetPassword,
    resendForgotPasswordOTP,
    login
};