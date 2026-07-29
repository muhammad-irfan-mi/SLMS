const csv = require('csv-parser');
const { Readable } = require('stream');
const { promisify } = require('util');
const Student = require("../models/Student");
const ClassSection = require("../models/ClassSection");
const School = require("../models/School");
const common = require("./common.controller");
const emailService = require("../services/email.service");
const { sendProfileUpdateNotification, sendEmailChangeNotification } = require("../utils/notificationService");

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const calculateOTPExpiry = (minutes = 10) => {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + minutes);
    return expiry;
};

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
            // parentEmail,
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
            // parentEmail: parentEmail?.toLowerCase(),
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

const addStudentFromCSV = async (req, res) => {
    try {
        const schoolId = req.user.school;

        if (!req.file) {
            return res.status(400).json({ message: 'CSV file is required' });
        }

        const rows = [];
        await new Promise((resolve, reject) => {
            Readable.from(req.file.buffer)
                .pipe(csv())
                .on('data', (row) => rows.push(row))
                .on('end', resolve)
                .on('error', reject);
        });

        if (rows.length === 0) {
            return res.status(400).json({ message: 'CSV file is empty' });
        }

        if (rows.length > 100) {
            return res.status(400).json({
                message: 'Maximum 100 students allowed per upload'
            });
        }


        const normalizedRows = rows.map((row, index) => ({
            rowNumber: index + 2,
            name: row.name?.trim(),
            username: row.username?.trim()?.toLowerCase(),
            email: row.email?.trim()?.toLowerCase(),
            phone: row.phone?.trim() || null,
            address: row.address?.trim() || null,
            cnic: row.cnic?.trim() || null,
            fatherName: row.fatherName?.trim() || null,
            classId: row.classId?.trim(),
            sectionId: row.sectionId?.trim() || null,
            rollNo: row.rollNo?.trim() || null,
            isFixed: String(row.isFixed || '').toLowerCase() === 'true',
            discount: Number(row.discount || 0)
        }));

        const csvUsernameSet = new Set();
        const csvEmailSet = new Set();
        const csvRollSet = new Set();

        const errors = [];
        const validRows = [];

        for (const row of normalizedRows) {
            if (!row.name || !row.username || !row.email || !row.classId) {
                errors.push({
                    row: row.rowNumber,
                    message: 'name, username, email and classId are required'
                });
                continue;
            }

            if (csvUsernameSet.has(row.username)) {
                errors.push({
                    row: row.rowNumber,
                    field: 'username',
                    value: row.username,
                    message: 'Duplicate username in CSV'
                });
                continue;
            }
            csvUsernameSet.add(row.username);

            if (csvEmailSet.has(row.email)) {
                errors.push({
                    row: row.rowNumber,
                    field: 'email',
                    value: row.email,
                    message: 'Duplicate email in CSV'
                });
                continue;
            }
            csvEmailSet.add(row.email);

            if (row.rollNo) {
                const rollKey = `${row.classId}-${row.sectionId || 'none'}-${row.rollNo}`;
                if (csvRollSet.has(rollKey)) {
                    errors.push({
                        row: row.rowNumber,
                        field: 'rollNo',
                        value: row.rollNo,
                        message: 'Duplicate roll number in CSV for same class/section'
                    });
                    continue;
                }
                csvRollSet.add(rollKey);
            }

            validRows.push(row);
        }

        const usernames = validRows.map(r => r.username);
        const emails = validRows.map(r => r.email);
        const rollNos = validRows.filter(r => r.rollNo).map(r => r.rollNo);

        const [existingUsernames, existingEmails, existingRolls] = await Promise.all([
            Student.find({
                school: schoolId,
                username: { $in: usernames }
            }).select('username').lean(),

            Student.find({
                email: { $in: emails },
                school: { $ne: schoolId },
                isActive: true
            }).select('email').lean(),

            Student.find({
                school: schoolId,
                rollNo: { $in: rollNos },
                isActive: true
            }).select('rollNo classInfo sectionInfo').lean()
        ]);

        const usernameSet = new Set(existingUsernames.map(u => u.username));
        const emailSet = new Set(existingEmails.map(e => e.email.toLowerCase()));

        const rollSet = new Set(
            existingRolls.map(r =>
                `${r.classInfo?.id}-${r.sectionInfo?.id || 'none'}-${r.rollNo}`
            )
        );

        const studentDocs = [];
        const emailJobs = [];

        for (const row of validRows) {
            if (usernameSet.has(row.username)) {
                errors.push({
                    row: row.rowNumber,
                    field: 'username',
                    value: row.username,
                    message: 'Username already taken'
                });
                continue;
            }

            if (emailSet.has(row.email)) {
                errors.push({
                    row: row.rowNumber,
                    field: 'email',
                    value: row.email,
                    message: 'Email already registered as active student in another school'
                });
                continue;
            }

            let classDoc;
            try {
                const result = await validateAndGetClassFee(
                    row.classId,
                    schoolId,
                    row.discount || 0,
                    row.isFixed || false
                );
                classDoc = result.classDoc;
            } catch (error) {
                errors.push({
                    row: row.rowNumber,
                    field: 'classId',
                    value: row.classId,
                    message: error.message
                });
                continue;
            }

            if (row.sectionId) {
                const sectionExists = classDoc.sections.some(
                    sec => sec._id.toString() === row.sectionId
                );

                if (!sectionExists) {
                    errors.push({
                        row: row.rowNumber,
                        field: 'sectionId',
                        value: row.sectionId,
                        message: 'Section not found in this class'
                    });
                    continue;
                }
            }

            if (row.rollNo) {
                const rollKey = `${row.classId}-${row.sectionId || 'none'}-${row.rollNo}`;

                if (rollSet.has(rollKey)) {
                    errors.push({
                        row: row.rowNumber,
                        field: 'rollNo',
                        value: row.rollNo,
                        message: 'Roll number already exists in this class/section'
                    });
                    continue;
                }
            }

            const existingSibling = await Student.findOne({
                email: row.email,
                school: schoolId
            }).select('_id siblingGroupId').lean();

            const siblingGroupId = existingSibling
                ? (existingSibling.siblingGroupId || existingSibling._id)
                : null;

            const otpCode = common.generateOTP();
            const otpExpiry = common.calculateOTPExpiry(10);

            const student = {
                name: row.name,
                username: row.username,
                email: row.email,
                phone: row.phone,
                address: row.address,
                cnic: row.cnic,
                fatherName: row.fatherName,
                role: 'student',
                rollNo: row.rollNo,
                classInfo: { id: row.classId },
                sectionInfo: { id: row.sectionId },
                school: schoolId,
                images: {
                    cnicFront: null,
                    cnicBack: null,
                    recentPic: null
                },
                siblingGroupId,
                // parentEmail: row.parentEmail,
                isFixed: row.isFixed || false,
                discount: row.discount || 0,
                password: null,
                verified: false,
                isActive: true,
                otp: {
                    code: otpCode,
                    expiresAt: otpExpiry,
                    attempts: 0,
                    lastAttempt: new Date()
                },
                verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            };

            studentDocs.push(student);

            emailJobs.push({
                email: row.email,
                otpCode,
                name: row.name,
                username: row.username
            });
        }

        let insertedStudents = [];

        if (studentDocs.length > 0) {
            insertedStudents = await Student.insertMany(studentDocs, {
                ordered: false
            });

            await Promise.all(
                insertedStudents.map(async (student) => {
                    await Student.updateMany(
                        {
                            email: student.email,
                            school: schoolId
                        },
                        {
                            $set: {
                                siblingGroupId: student.siblingGroupId || student._id
                            }
                        }
                    );
                })
            );

            await School.findByIdAndUpdate(schoolId, {
                $inc: { noOfStudents: insertedStudents.length }
            });
        }

        if (insertedStudents.length > 0) {
            const insertedEmailSet = new Set(
                insertedStudents.map(s => s.email.toLowerCase())
            );

            const jobs = emailJobs.filter(job =>
                insertedEmailSet.has(job.email.toLowerCase())
            );

            setImmediate(async () => {
                await Promise.allSettled(
                    jobs.map(job =>
                        emailService.sendStudentRegistrationEmail(
                            job.email,
                            job.otpCode,
                            job.name,
                            job.username,
                            schoolId
                        )
                    )
                );
            });
        }

        return res.status(201).json({
            success: true,
            message: `Imported ${insertedStudents.length} student(s).`,
            summary: {
                totalRows: rows.length,
                imported: insertedStudents.length,
                failed: errors.length
            },
            importedStudents: insertedStudents.map(s => ({
                _id: s._id,
                name: s.name,
                username: s.username,
                email: s.email,
                rollNo: s.rollNo
            })),
            errors
        });

    } catch (err) {
        console.error('addStudentFromCSV error:', err);

        return res.status(500).json({
            success: false,
            message: err.message || 'Server error while importing students'
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
            // parentEmail,
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
        // if (parentEmail !== undefined) student.parentEmail = parentEmail?.toLowerCase();

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
            .populate('school', 'name images.logo permissions')
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
                logo: student.school.images?.logo || null,
                permissions: student.school.permissions || []
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


        const studentResponse = {
            ...student,
            classInfo: classInfoWithName,
            sectionInfo: sectionInfoWithName
        };

        return res.status(200).json({
            student: studentResponse,
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
// const getStudentsByParentEmail = async (req, res) => {
//     try {
//         const { email } = req.params;
//         const schoolId = req.user.school;

//         const students = await Student.find({
//             parentEmail: { $regex: new RegExp(`^${email}$`, 'i') },
//             school: schoolId,
//             role: "student",
//             isActive: true
//         })
//             .select("name username classInfo sectionInfo rollNo discount")
//             .sort({ "classInfo.id": 1, rollNo: 1 });

//         return res.status(200).json({
//             message: "Students fetched successfully",
//             total: students.length,
//             parentEmail: email,
//             students
//         });

//     } catch (err) {
//         console.error("Error fetching students by parent email:", err);
//         return res.status(500).json({
//             message: err.message || "Server error while fetching students by parent email"
//         });
//     }
// };

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

const getDeletedStudents = async (req, res) => {
    return common.getDeletedUsers(req, res, Student, 'student');
};

const restoreStudentAccount = async (req, res) => {
    return common.restoreUser(req, res, Student);
};

const deleteStudentAccount = async (req, res) => {
    const { role } = req.user;
    if (!['student', 'admin_office'].includes(role)) {
        return res.status(400).json({
            success: false,
            message: "Invalid user type for account deletion"
        });
    }
    return common.toggleUserStatus(req, res, Student, true);
};

const toggleStudentStatus = async (req, res) => {
    return common.toggleUserStatus(req, res, Student);
};

const updateStudentProfile = async (req, res) => {
    return common.updateOwnProfile(req, res, Student);
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
    addStudentFromCSV,
    updateStudent,
    getAllStudents,
    getStudentById,
    getStudentsBySection,
    // getStudentsByParentEmail,
    getStudentSiblingsByEmail,
    getDeletedStudents,
    updateStudentProfile,
    deleteStudentAccount,
    restoreStudentAccount,
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