const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require('crypto');
const User = require("../models/User");
const School = require("../models/School");
const ClassSection = require("../models/ClassSection");
const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");
const emailService = require("../services/email.service");
const { sendProfileUpdateNotification, sendEmailChangeNotification } = require("../utils/notificationService");

// Helper for S3 uploads
async function uploadFiles(files, existingImages = {}) {
    const images = { ...existingImages };
    for (const key of ["cnicFront", "cnicBack", "recentPic"]) {
        if (files?.[key]?.[0]) {
            if (images[key]) await deleteFileFromS3(images[key]);
            images[key] = await uploadFileToS3({
                fileBuffer: files[key][0].buffer,
                fileName: files[key][0].originalname,
                mimeType: files[key][0].mimetype,
            });
        }
    }
    return images;
}

// Helper: Auto-fill Class and Section from IDs WITH SCHOOL VALIDATION
async function getClassAndSection(classId, sectionId, schoolId) {
    if (!classId) return { classInfo: null, sectionInfo: null };

    const classDoc = await ClassSection.findOne({
        _id: classId,
        school: schoolId
    });

    if (!classDoc) {
        console.log("Class not found or school mismatch:", {
            classId,
            schoolId,
            classDocSchool: classDoc?.school,
            classDocId: classDoc?._id
        });
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
}

const checkEmailInOtherSchool = async (email, currentSchoolId) => {
    const existingInOtherSchool = await User.findOne({
        email: email.toLowerCase(),
        school: { $ne: currentSchoolId },
        role: "student"
    });

    return existingInOtherSchool;
};

const generateOTP = () => {
    return crypto.randomInt(100000, 999999).toString();
};

const calculateOTPExpiry = (minutes = 10) => {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + minutes);
    return expiry;
};

// Send OTP for user verification
const sendUserOTP = async (req, res) => {
    try {
        const { email, username } = req.body;

        const query = { email: email.toLowerCase() };

        if (username) {
            query.username = username.toLowerCase();
        }

        const existingUser = await User.findOne(query);

        if (existingUser && existingUser.verified) {
            return res.status(400).json({
                message: "User already verified. Please login instead."
            });
        }

        const otpCode = generateOTP();
        const otpExpiry = calculateOTPExpiry(10);

        if (existingUser) {
            existingUser.otp = {
                code: otpCode,
                expiresAt: otpExpiry,
                attempts: 0,
                lastAttempt: new Date()
            };
            await existingUser.save();
        } else {
            return res.status(404).json({
                message: "User not found. Please contact your school admin."
            });
        }

        // Send OTP email
        await emailService.sendUserOTPEmail(
            email,
            otpCode,
            existingUser.name || existingUser.tempData?.name || "User",
            existingUser.school,
            existingUser.username || null,
            existingUser.role
        );

        return res.status(200).json({
            message: "OTP sent to your email",
            email,
            otpExpiry,
            note: "OTP is valid for 10 minutes"
        });
    } catch (err) {
        console.error("Error sending OTP:", err);
        return res.status(500).json({
            message: "Server error while sending OTP",
            error: err.message,
        });
    }
};

// Verify OTP for user
const verifyUserOTP = async (req, res) => {
    try {
        const { email, otp, username } = req.body;

        const query = {
            email: email.toLowerCase(),
            verified: false
        };

        if (username) {
            query.username = username.toLowerCase();
        }

        const user = await User.findOne(query);

        if (!user) {
            return res.status(404).json({
                message: "No pending verification found for this user"
            });
        }

        if (user.otp.attempts >= 5) {
            return res.status(429).json({
                message: "Too many OTP attempts. Please request a new OTP."
            });
        }

        const isExpired = new Date() > new Date(user.otp.expiresAt);
        if (isExpired) {
            user.otp.attempts += 1;
            user.otp.lastAttempt = new Date();
            await user.save();

            return res.status(400).json({
                message: "OTP has expired. Please request a new OTP.",
                attemptsRemaining: 5 - user.otp.attempts
            });
        }

        if (otp !== user.otp.code) {
            user.otp.attempts += 1;
            user.otp.lastAttempt = new Date();
            await user.save();

            return res.status(400).json({
                message: "Invalid OTP",
                attemptsRemaining: 5 - user.otp.attempts
            });
        }

        // OTP verified successfully
        if (user.tempData) {
            for (const key in user.tempData) {
                if (key !== '_id' && user.tempData[key] !== undefined) {
                    user[key] = user.tempData[key];
                }
            }
            user.tempData = undefined;
        }

        user.verified = true;
        user.otp = undefined;
        await user.save();

        return res.status(200).json({
            message: "User verified successfully! You can now set your password.",
            data: {
                email: user.email,
                username: user.username,
                name: user.name,
                role: user.role,
                canSetPassword: true
            }
        });
    } catch (err) {
        console.error("Error verifying OTP:", err);
        return res.status(500).json({
            message: "Server error while verifying OTP",
            error: err.message,
        });
    }
};

// Resend OTP for user
const resendUserOTP = async (req, res) => {
    try {
        const { email, username } = req.body;

        const query = {
            email: email.toLowerCase(),
            verified: false
        };

        if (username) {
            query.username = username.toLowerCase();
        }

        const user = await User.findOne(query);

        if (!user) {
            return res.status(404).json({
                message: "No pending verification found for this user"
            });
        }

        if (user.otp.lastAttempt) {
            const cooldownTime = 60 * 1000;
            const timeSinceLastAttempt = new Date() - new Date(user.otp.lastAttempt);

            if (timeSinceLastAttempt < cooldownTime) {
                const waitTime = Math.ceil((cooldownTime - timeSinceLastAttempt) / 1000);
                return res.status(429).json({
                    message: `Please wait ${waitTime} seconds before requesting a new OTP`
                });
            }
        }

        // Generate new OTP
        const newOTP = generateOTP();
        const newExpiry = calculateOTPExpiry(10);

        // Update OTP
        user.otp.code = newOTP;
        user.otp.expiresAt = newExpiry;
        user.otp.attempts = 0;
        user.otp.lastAttempt = new Date();
        await user.save();

        // Send new OTP email
        await emailService.sendUserOTPEmail(
            email,
            newOTP,
            username ? username : null,
            user.name || user.tempData?.name || "User"
        );

        return res.status(200).json({
            message: "New OTP sent successfully",
            email,
            otpExpiry: newExpiry,
            note: "OTP is valid for 10 minutes"
        });
    } catch (err) {
        console.error("Error resending OTP:", err);
        return res.status(500).json({
            message: "Server error while resending OTP",
            error: err.message,
        });
    }
};

// Set password after OTP verification
const setPasswordAfterOTP = async (req, res) => {
    try {
        const { email, password, username } = req.body;

        const query = {
            email: email.toLowerCase(),
            verified: true
        };

        if (username) {
            query.username = username.toLowerCase();
        }

        const user = await User.findOne(query);

        if (!user) {
            return res.status(404).json({
                message: "User not found or not verified. Please verify OTP first."
            });
        }

        if (user.password) {
            return res.status(400).json({
                message: "Password already set. Please login instead."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        await user.save();

        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                role: user.role,
                school: user.school,
                ...(user.username && { username: user.username })
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(200).json({
            message: "Password set successfully! You are now logged in.",
            data: {
                token: token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    username: user.username,
                    role: user.role,
                    school: user.school,
                    classInfo: user.classInfo,
                    sectionInfo: user.sectionInfo
                }
            }
        });
    } catch (err) {
        console.error("Error setting password:", err);
        return res.status(500).json({
            message: "Server error while setting password",
            error: err.message,
        });
    }
};

// Helper: Generate unique username
async function generateUniqueUsername(name, email, schoolId) {
    const baseUsername = name.toLowerCase().replace(/\s+/g, '_');
    let username = baseUsername;
    let counter = 1;

    // Check if this username already exists for this email in the same school
    const existing = await User.findOne({
        email: email.toLowerCase(),
        username: username,
        school: schoolId,
        role: "student"
    });

    // If not exists, return it
    if (!existing) {
        return username;
    }

    // If exists, try with numbers
    while (true) {
        username = `${baseUsername}_${counter}`;
        const existing = await User.findOne({
            email: email.toLowerCase(),
            username: username,
            school: schoolId,
            role: "student"
        });

        if (!existing) {
            return username;
        }
        counter++;
    }
}

async function getClassSectionInfo(classId, sectionId, schoolId) {
    if (!classId) return { className: null, sectionName: null };

    try {
        const classDoc = await ClassSection.findOne({
            _id: classId,
            school: schoolId
        });

        if (!classDoc) {
            return { className: null, sectionName: null };
        }

        const result = {
            className: classDoc.class
        };

        if (sectionId && classDoc.sections) {
            const section = classDoc.sections.find(
                sec => sec._id.toString() === sectionId.toString()
            );
            result.sectionName = section ? section.name : null;
        } else {
            result.sectionName = null;
        }

        return result;
    } catch (error) {
        console.error("Error getting class/section info:", error);
        return { className: null, sectionName: null };
    }
}

const addEmployeeBySchool = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            address,
            cnic,
            role,
            salary,
            joiningDate,
            isIncharge,
            classId,
            sectionId,
        } = req.body;

        const schoolId = req.user.school;

        const existing = await User.findOne({
            email: email.toLowerCase(),
            role: { $in: ["teacher", "admin_office"] }
        });

        let classInfo = null;
        let sectionInfo = null;

        if (role === "teacher" && isIncharge === "true" && classId) {
            const result = await getClassAndSection(classId, sectionId);
            if (result.error) {
                return res.status(400).json({ message: result.error });
            }
            classInfo = result.classInfo;
            sectionInfo = result.sectionInfo;
        }

        const inchargeFlag = role === "teacher" ? isIncharge === "true" : undefined;
        const otpCode = generateOTP();
        const otpExpiry = calculateOTPExpiry(10);

        if (existing) {
            if (existing.isActive === true) {
                return res.status(400).json({
                    message: "Active user with this email already exists"
                });
            }

            const images = await uploadFiles(req.files, existing.images);

            existing.password = undefined;
            existing.name = name;
            existing.phone = phone;
            existing.address = address;
            existing.cnic = cnic;
            existing.role = role;
            existing.salary = role === "teacher" ? salary : salary || null;
            existing.joiningDate = joiningDate;
            existing.isIncharge = inchargeFlag ?? false;
            existing.classInfo = classInfo;
            existing.sectionInfo = sectionInfo;
            existing.school = schoolId;
            existing.images = images;
            existing.isActive = true;
            existing.tokenVersion = (existing.tokenVersion || 0) + 1;
            existing.verified = false;
            existing.createdAt = new Date();
            existing.otp = {
                code: otpCode,
                expiresAt: otpExpiry,
                attempts: 0,
                lastAttempt: new Date()
            };
            existing.tempData = undefined;
            existing.forgotPasswordOTP = undefined;

            await existing.save();

            await emailService.sendUserOTPEmail(email, otpCode, name, schoolId, null, role);

            return res.status(201).json({
                message: "Employee added successfully. OTP sent for verification.",
                email,
                otpExpiry,
            });
        }

        const images = await uploadFiles(req.files);
        const newUser = new User({
            name,
            email: email.toLowerCase(),
            phone,
            address,
            cnic,
            role,
            salary: role === "teacher" ? salary : salary || null,
            joiningDate,
            isIncharge: inchargeFlag ?? false,
            classInfo,
            sectionInfo,
            school: schoolId,
            images,
            verified: false,
            isActive: true,
            otp: {
                code: otpCode,
                expiresAt: otpExpiry,
                attempts: 0,
                lastAttempt: new Date()
            }
        });

        await newUser.save();

        await emailService.sendUserOTPEmail(email, otpCode, name, schoolId, null, role);

        return res.status(201).json({
            message: "Employee added successfully. OTP sent to email for verification.",
            email,
            otpExpiry,
            note: "User must verify OTP before setting password"
        });
    } catch (err) {
        return res.status(500).json({
            message: err.message || "Server error while adding employee"
        });
    }
};

// UPDATE EMPLOYEE
const editEmployeeBySchool = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.school;

        const existing = await User.findById(id);
        if (!existing || !["teacher", "admin_office"].includes(existing.role))
            return res.status(404).json({ message: "Employee not found" });

        if (existing.school.toString() !== schoolId.toString())
            return res.status(403).json({ message: "Unauthorized to Update Employee" });

        if (existing.isActive === false) {
            return res.status(400).json({
                message: "Employee not found in your school."
            });
        }

        const images = await uploadFiles(req.files, existing.images);

        let classInfo = existing.classInfo;
        let sectionInfo = existing.sectionInfo;

        const changes = [];

        if (existing.role === "teacher" && req.body.classId) {
            const result = await getClassAndSection(req.body.classId, req.body.sectionId);
            if (result.error) {
                return res.status(400).json({ message: result.error });
            }

            if (classInfo && classInfo.id && classInfo.id.toString() !== req.body.classId) {
                changes.push(`Class assignment changed to ${result.classInfo.name}`);
            }
            if (sectionInfo && sectionInfo.id && sectionInfo.id.toString() !== req.body.sectionId) {
                changes.push(`Section assignment changed to ${result.sectionInfo.name}`);
            }

            classInfo = result.classInfo;
            sectionInfo = result.sectionInfo;
        }

        if (req.body.name && req.body.name !== existing.name) {
            changes.push(`Name changed from "${existing.name}" to "${req.body.name}"`);
        }
        if (req.body.phone && req.body.phone !== existing.phone) {
            changes.push(`Phone number updated`);
        }
        if (req.body.address && req.body.address !== existing.address) {
            changes.push(`Address updated`);
        }
        if (req.body.cnic && req.body.cnic !== existing.cnic) {
            changes.push(`CNIC updated`);
        }
        if (req.body.salary && req.body.salary !== existing.salary) {
            changes.push(`Salary updated`);
        }
        if (req.body.joiningDate && req.body.joiningDate !== existing.joiningDate) {
            changes.push(`Joining date updated`);
        }

        // const isInchargeValue = req.body.isIncharge !== undefined
        //     ? req.body.isIncharge === "true"
        //     : existing.isIncharge;

        // if (isInchargeValue !== existing.isIncharge) {
        //     changes.push(`In-charge status: ${existing.isIncharge ? 'Removed' : 'Assigned'}`);
        // }

        let otpData = existing.otp;
        let verified = existing.verified;
        let emailChanged = false;
        let oldEmail = null;

        if (req.body.email) {
            const newEmail = req.body.email.toLowerCase();

            if (newEmail !== existing.email.toLowerCase()) {
                oldEmail = existing.email;
                emailChanged = true;
                changes.push(`Email changed from ${existing.email} to ${newEmail}`);

                const emailExists = await User.findOne({
                    _id: { $ne: id },
                    email: newEmail,
                    school: schoolId,
                    role: existing.role,
                    isActive: true
                });

                if (emailExists) {
                    return res.status(400).json({
                        message: `Email "${newEmail}" already exists for another ${existing.role}`
                    });
                }
                const otpCode = generateOTP();
                otpData = {
                    code: otpCode,
                    expiresAt: calculateOTPExpiry(10),
                    attempts: 0,
                    lastAttempt: new Date()
                };

                verified = false;

                await emailService.sendUserOTPEmail(
                    newEmail,
                    otpCode,
                    req.body.name || existing.name
                );
            }
        }

        const updateFields = {
            name: req.body.name ?? existing.name,
            email: req.body.email
                ? req.body.email.toLowerCase()
                : existing.email,
            phone: req.body.phone ?? existing.phone,
            address: req.body.address ?? existing.address,
            cnic: req.body.cnic ?? existing.cnic,
            salary: req.body.salary ?? existing.salary,
            joiningDate: req.body.joiningDate ?? existing.joiningDate,
            // isIncharge: isInchargeValue,
            classInfo,
            sectionInfo,
            images,
            otp: otpData,
            verified,
            updatedAt: new Date()
        };

        if (req.body.password) {
            changes.push("Password reset requested");
            updateFields.password = await bcrypt.hash(req.body.password, 10);
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            updateFields,
            { new: true, runValidators: true }
        );

        let notificationsSent = {
            profileUpdate: false,
            emailChange: false
        };

        try {
            if (changes.length > 0) {
                await sendProfileUpdateNotification({
                    user: {
                        _id: existing._id,
                        name: req.body.name || existing.name,
                        email: req.body.email || existing.email,
                        school: schoolId,
                        role: existing.role
                    },
                    updatedBy: req.user._id,
                    changes,
                    updateType: existing.role === 'teacher' ? 'selected_teachers' : 'all'
                });
                notificationsSent.profileUpdate = true;
            }

            if (emailChanged && oldEmail) {
                await sendEmailChangeNotification({
                    user: {
                        _id: existing._id,
                        name: req.body.name || existing.name,
                        school: schoolId,
                        role: existing.role
                    },
                    oldEmail,
                    newEmail: req.body.email.toLowerCase(),
                    updatedBy: req.user._id
                });
                notificationsSent.emailChange = true;
            }
        } catch (notificationError) {
            console.error('Error sending notifications:', notificationError.message);
        }

        return res.status(200).json({
            message: emailChanged
                ? `${existing.role.charAt(0).toUpperCase() + existing.role.slice(1)} updated. OTP sent to new email for verification.`
                : `${existing.role.charAt(0).toUpperCase() + existing.role.slice(1)} updated successfully.`,
        });

    } catch (err) {
        console.error("Error updating employee:", err);
        return res.status(500).json({
            message: err.message || "Server error while updating employee"
        });
    }
};

// ADD STUDENT
const addStudentBySchool = async (req, res) => {
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
            rollNo
        } = req.body;

        const schoolId = req.user.school;

        const emailInOtherSchool = await User.findOne({
            email: email.toLowerCase(),
            school: { $ne: schoolId },
            role: "student",
            isActive: true
        });

        if (emailInOtherSchool) {
            return res.status(400).json({
                message: `Email ${email} is already registered as active student in another school`
            });
        }

        const classDoc = await ClassSection.findOne({ _id: classId, school: schoolId });
        if (!classDoc) {
            return res.status(403).json({ message: "Class not found" });
        }

        if (sectionId) {
            const sectionExists = classDoc.sections.some(
                sec => sec._id.toString() === sectionId
            );
            if (!sectionExists) {
                return res.status(403).json({ message: "Section not found in this class" });
            }
        }

        const result = await getClassAndSection(classId, sectionId, schoolId);
        if (result.error) {
            return res.status(400).json({ message: result.error });
        }

        const { classInfo, sectionInfo } = result;

        if (rollNo) {
            const rollExists = await User.findOne({
                school: schoolId,
                role: "student",
                rollNo,
                "classInfo.id": classInfo.id,
                "sectionInfo.id": sectionInfo?.id || null,
                isActive: true
            });

            if (rollExists) {
                return res.status(400).json({
                    message: `Roll number "${rollNo}" already exists for active student in this class/section`
                });
            }
        }

        const activeSiblings = await User.find({
            email: email.toLowerCase(),
            school: schoolId,
            role: "student",
            isActive: true
        });

        const allSiblings = await User.find({
            email: email.toLowerCase(),
            school: schoolId,
            role: "student"
        });

        let finalUsername = username
            ? username.toLowerCase()
            : await generateUniqueUsername(name, email, schoolId);

        if (username && activeSiblings.some(s => s.username === finalUsername)) {
            return res.status(400).json({
                message: `Username "${username}" already used by active sibling`
            });
        }

        const inactiveStudent = allSiblings.find(s => s.isActive === false);

        let finalRollNo = rollNo;
        if (!rollNo) {
            if (activeSiblings.length > 0) {
                finalRollNo = `${email.split("@")[0]}-${activeSiblings.length + 1}`;
            } else {
                finalRollNo = `${email.split("@")[0]}-1`;
            }
        }

        let siblingGroupId = null;
        if (allSiblings.length > 0) {
            siblingGroupId = allSiblings[0].siblingGroupId || allSiblings[0]._id;
        }

        const images = await uploadFiles(req.files);
        const otpCode = generateOTP();
        const otpExpiry = calculateOTPExpiry(10);

        if (inactiveStudent) {
            inactiveStudent.password = undefined;
            inactiveStudent.name = name;
            inactiveStudent.username = finalUsername;
            inactiveStudent.phone = phone;
            inactiveStudent.address = address;
            inactiveStudent.cnic = cnic;
            inactiveStudent.fatherName = fatherName;
            inactiveStudent.rollNo = finalRollNo;
            inactiveStudent.classInfo = classInfo;
            inactiveStudent.sectionInfo = sectionInfo;
            inactiveStudent.images = images;
            inactiveStudent.siblingGroupId = siblingGroupId;
            inactiveStudent.isActive = true;
            inactiveStudent.tokenVersion = (inactiveStudent.tokenVersion || 0) + 1;
            inactiveStudent.verified = false;
            inactiveStudent.createdAt = new Date();
            inactiveStudent.otp = {
                code: otpCode,
                expiresAt: otpExpiry,
                attempts: 0,
                lastAttempt: new Date()
            };

            inactiveStudent.forgotPasswordOTP = undefined;

            await inactiveStudent.save();

            if (allSiblings.length > 1) {
                await User.updateMany(
                    {
                        email: email.toLowerCase(),
                        school: schoolId,
                        role: "student"
                    },
                    { $set: { siblingGroupId: siblingGroupId } }
                );
            }

            await School.findByIdAndUpdate(schoolId, { $inc: { noOfStudents: 1 } });

            await emailService.sendStudentRegistrationEmail(
                email,
                otpCode,
                name,
                finalUsername,
                schoolId
            );

            return res.status(201).json({
                message: "student added successfully. OTP sent.",
            });
        }

        const student = new User({
            name,
            username: finalUsername,
            email: email.toLowerCase(),
            phone,
            address,
            cnic,
            fatherName,
            role: "student",
            rollNo: finalRollNo,
            classInfo,
            sectionInfo,
            school: schoolId,
            images,
            siblingGroupId,
            verified: false,
            isActive: true,
            otp: {
                code: otpCode,
                expiresAt: otpExpiry,
                attempts: 0,
                lastAttempt: new Date()
            }
        });

        await student.save();

        if (allSiblings.length > 0) {
            siblingGroupId = siblingGroupId || student._id;
            await User.updateMany(
                {
                    email: email.toLowerCase(),
                    school: schoolId,
                    role: "student"
                },
                { $set: { siblingGroupId: siblingGroupId } }
            );
        }

        await School.findByIdAndUpdate(schoolId, { $inc: { noOfStudents: 1 } });

        await emailService.sendStudentRegistrationEmail(
            email,
            otpCode,
            name,
            finalUsername,
            schoolId
        );

        return res.status(201).json({
            message: "Student added successfully. OTP sent.",
            student
        });

    } catch (err) {
        return res.status(500).json({
            message: err.message || "Server error"
        });
    }
};

// UPDATE STUDENT
const editStudentBySchool = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.school;

        const existing = await User.findById(id);
        if (!existing || existing.role !== "student") {
            return res.status(404).json({ message: "Student not found" });
        }

        if (existing.school.toString() !== schoolId.toString()) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        if (existing.isActive === false) {
            return res.status(400).json({
                message: "User not found in your school."
            });
        }

        const { email, rollNo, classId, sectionId, username } = req.body;

        const changes = [];

        let classInfo = existing.classInfo;
        let sectionInfo = existing.sectionInfo;

        if (classId) {

            if (!sectionId) {
                return res.status(400).json({
                    message: "Section ID is required when changing class"
                });
            }

            const result = await getClassAndSection(classId, sectionId, schoolId);
            if (result.error) {
                return res.status(400).json({ message: result.error });
            }

            if (classInfo && classInfo.id && classInfo.id.toString() !== classId) {
                changes.push(`Class changed from ${existing.classInfo?.name || 'Previous class'} to ${result.classInfo.name}`);
            }

            if (sectionInfo && sectionInfo.id && sectionInfo.id.toString() !== sectionId) {
                changes.push(`Section changed from ${existing.sectionInfo?.name || 'Previous section'} to ${result.sectionInfo.name}`);
            }

            classInfo = result.classInfo;
            sectionInfo = result.sectionInfo;
        }

        if (rollNo && rollNo !== existing.rollNo) {
            changes.push(`Roll number changed from "${existing.rollNo || 'Not set'}" to "${rollNo}"`);
        }

        if (username && username.toLowerCase() !== existing.username?.toLowerCase()) {
            changes.push(`Username changed from "${existing.username || 'Not set'}" to "${username}"`);
        }

        if (req.body.name && req.body.name !== existing.name) {
            changes.push(`Name changed from "${existing.name}" to "${req.body.name}"`);
        }
        if (req.body.phone && req.body.phone !== existing.phone) {
            changes.push(`Phone number updated`);
        }
        if (req.body.address && req.body.address !== existing.address) {
            changes.push(`Address updated`);
        }
        if (req.body.fatherName && req.body.fatherName !== existing.fatherName) {
            changes.push(`Father's name updated`);
        }
        if (req.body.cnic && req.body.cnic !== existing.cnic) {
            changes.push(`CNIC updated`);
        }

        if (rollNo) {
            const rollExists = await User.findOne({
                _id: { $ne: id },
                school: schoolId,
                role: "student",
                rollNo,
                "classInfo.id": classInfo.id,
                "sectionInfo.id": sectionInfo?.id || null,
                isActive: true
            });

            if (rollExists) {
                return res.status(400).json({
                    message: `Roll number "${rollNo}" already exists in this class/section`
                });
            }
        }

        if (rollNo && !classId) {
            const rollExists = await User.findOne({
                _id: { $ne: id },
                school: schoolId,
                role: "student",
                rollNo,
                "classInfo.id": existing.classInfo?.id,
                "sectionInfo.id": existing.sectionInfo?.id || null,
                isActive: true
            });

            if (rollExists) {
                return res.status(400).json({
                    message: `Roll number "${rollNo}" already exists for active student in this class/section`
                });
            }
        }

        const images = await uploadFiles(req.files, existing.images);

        let otpData = existing.otp;
        let verified = existing.verified;
        let emailChanged = false;
        let oldEmail = null;

        if (email && email.toLowerCase() !== existing.email.toLowerCase()) {

            oldEmail = existing.email;
            emailChanged = true;
            changes.push(`Email changed from ${existing.email} to ${email}`);

            const emailExists = await User.findOne({
                _id: { $ne: id },
                email: email.toLowerCase(),
                school: schoolId,
                role: "student",
                isActive: true
            });

            if (emailExists) {
                return res.status(400).json({
                    message: `Email "${email}" already exists for another student`
                });
            }

            const otpCode = generateOTP();
            otpData = {
                code: otpCode,
                expiresAt: calculateOTPExpiry(10),
                attempts: 0,
                lastAttempt: new Date()
            };
            verified = false;

            await emailService.sendUserOTPEmail(
                email.toLowerCase(),
                otpCode,
                req.body.name || existing.name
            );
        }

        const updateData = {
            name: req.body.name ?? existing.name,
            email: email ? email.toLowerCase() : existing.email,
            phone: req.body.phone ?? existing.phone,
            address: req.body.address ?? existing.address,
            cnic: req.body.cnic ?? existing.cnic,
            fatherName: req.body.fatherName ?? existing.fatherName,
            username: username ? username.toLowerCase() : existing.username,
            rollNo: rollNo ?? existing.rollNo,
            classInfo,
            sectionInfo,
            images,
            otp: otpData,
            verified,
            updatedAt: new Date()
        };

        const updated = await User.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        let notificationsSent = {
            profileUpdate: false,
            emailChange: false
        };

        try {
            if (changes.length > 0) {
                await sendProfileUpdateNotification({
                    user: {
                        _id: existing._id,
                        name: req.body.name || existing.name,
                        email: req.body.email || existing.email,
                        school: schoolId,
                        role: existing.role
                    },
                    updatedBy: req.user._id,
                    changes,
                    updateType: existing.role === 'student' ? 'selected_students' : 'all_students'
                });
                notificationsSent.profileUpdate = true;
            }

            if (emailChanged && oldEmail) {
                await sendEmailChangeNotification({
                    user: {
                        _id: existing._id,
                        name: req.body.name || existing.name,
                        school: schoolId,
                        role: existing.role
                    },
                    oldEmail,
                    newEmail: req.body.email.toLowerCase(),
                    updatedBy: req.user._id
                });
                notificationsSent.emailChange = true;
            }
        } catch (notificationError) {
            console.error('Error sending notifications:', notificationError.message);
        }

        return res.status(200).json({
            message: emailChanged
                ? "Student updated successfully. OTP sent to new email for verification."
                : "Student updated successfully",
        });

    } catch (err) {
        console.error("Error updating student:", err);
        return res.status(500).json({
            message: err.message || "Server error"
        });
    }
};

// GET STUDENT SIBLINGS - NEW FUNCTION
const getStudentSiblingsByEmail = async (req, res) => {
    try {
        const { email } = req.params;
        const schoolId = req.user.school;

        const siblings = await User.find({
            email,
            role: "student",
            isActive: true,
            school: schoolId
        }).select("name email phone classInfo sectionInfo rollNo verified");

        if (!siblings.length) {
            return res.status(404).json({ message: "No students found with this email" });
        }

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

// GET STUDENT BY ID
const getStudentById = async (req, res) => {
    try {
        const { id } = req.params;
        const student = await User.findById(id).select("-password -otp -forgotPasswordOTP");

        if (!student || student.role !== "student")
            return res.status(404).json({ message: "Student not found" });

        if (student.school.toString() !== req.user.school.toString())
            return res.status(403).json({ message: "Unauthorized" });

        const classSectionInfo = await getClassSectionInfo(
            student.classInfo?.id,
            student.sectionInfo?.id,
            req.user.school
        );

        const studentResponse = {
            ...student.toObject(),
            classInfo: {
                ...student.classInfo,
                className: classSectionInfo.className
            },
            sectionInfo: {
                ...student.sectionInfo,
                sectionName: classSectionInfo.sectionName
            }
        };

        const siblings = await User.find({
            email: student.email.toLowerCase(),
            school: req.user.school,
            role: "student",
            _id: { $ne: id }
        }).select("name username classInfo sectionInfo rollNo email");

        const enrichedSiblings = await Promise.all(
            siblings.map(async (sibling) => {
                const siblingClassSectionInfo = await getClassSectionInfo(
                    sibling.classInfo?.id,
                    sibling.sectionInfo?.id,
                    req.user.school
                );

                return {
                    ...sibling.toObject(),
                    classInfo: {
                        ...sibling.classInfo,
                        className: siblingClassSectionInfo.className
                    },
                    sectionInfo: {
                        ...sibling.sectionInfo,
                        sectionName: siblingClassSectionInfo.sectionName
                    }
                };
            })
        );

        return res.status(200).json({
            student: studentResponse,
            siblings: enrichedSiblings,
            siblingCount: enrichedSiblings.length
        });
    } catch (err) {
        console.error("Error fetching student:", err);
        return res.status(500).json({ message: err.message || "Server error while fetching student" });
    }
};

const getStudentsByParentEmail = async (req, res) => {
    try {
        const { email } = req.params;
        const schoolId = req.user.school;

        const students = await User.find({
            email,
            role: "student",
            isActive: true,
            school: schoolId
        }).select("name classInfo sectionInfo rollNo verified")
            .populate('classInfo.id', 'className')
            .sort({ "classInfo.id": 1, rollNo: 1 });

        if (!students.length) {
            return res.status(404).json({ message: "No students found for this parent email" });
        }

        // Group by class for better organization
        const studentsByClass = students.reduce((acc, student) => {
            const className = student.classInfo.id?.className || 'Unassigned';
            if (!acc[className]) {
                acc[className] = [];
            }
            acc[className].push(student);
            return acc;
        }, {});

        return res.status(200).json({
            message: "Students fetched successfully",
            total: students.length,
            parentEmail: email,
            studentsByClass,
            allStudents: students
        });
    } catch (err) {
        console.error("Error fetching students by parent email:", err);
        return res.status(500).json({
            message: err.message || "Server error while fetching students by parent email"
        });
    }
};

const getAllEmployeesBySchool = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const employees = await User.find({
            school: schoolId,
            role: { $in: ["teacher", "admin_office"] },
            isActive: true
        }).select("-password");
        return res.status(200).json({ employees });
    } catch (err) {
        console.error("Error fetching employees:", err);
        return res.status(500).json({ message: err.message || "Server error while fetching employees" });
    }
};

const getEmployeeById = async (req, res) => {
    try {
        const { id } = req.params;
        const employee = await User.findById(id).select("-password -otp -forgotPasswordOTP");
        if (!employee || !["teacher", "admin_office"].includes(employee.role))
            return res.status(404).json({ message: "Employee not found" });

        if (employee.school.toString() !== req.user.school.toString())
            return res.status(403).json({ message: "Unauthorized" });

        const classSectionInfo = await getClassSectionInfo(
            employee.classInfo?.id,
            employee.sectionInfo?.id,
            req.user.school
        );

        const employeeResponse = {
            ...employee.toObject(),
            classInfo: {
                ...employee.classInfo,
                className: classSectionInfo.className
            },
            sectionInfo: {
                ...employee.sectionInfo,
                sectionName: classSectionInfo.sectionName
            }
        };

        return res.status(200).json({ employee: employeeResponse });
    } catch (err) {
        console.error("Error fetching employee:", err);
        return res.status(500).json({ message: err.message || "Server error while fetching employee" });
    }
};

const deleteEmployeeBySchool = async (req, res) => {
    try {
        const { id } = req.params;
        const employee = await User.findById(id);
        if (!employee || !["teacher", "admin_office"].includes(employee.role))
            return res.status(404).json({ message: "Employee not found" });

        if (employee.school.toString() !== req.user.school.toString())
            return res.status(403).json({ message: "Unauthorized" });

        const { cnicFront, cnicBack, recentPic } = employee.images || {};
        for (const fileUrl of [cnicFront, cnicBack, recentPic].filter(Boolean))
            await deleteFileFromS3(fileUrl);

        await employee.deleteOne();
        return res.status(200).json({ message: "Employee deleted successfully" });
    } catch (err) {
        console.error("Error deleting employee:", err);
        return res.status(500).json({ message: err.message || "Server error while deleting employee" });
    }
};

const getAllStudentsBySchool = async (req, res) => {
    try {
        const schoolId = req.user.school;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [students, total] = await Promise.all([
            User.find({
                school: schoolId,
                role: "student",
                isActive: true
            })
                .select("-password -forgotPasswordOTP -otp -tokenVersion -isActive -isIncharge")
                .skip(skip)
                .limit(limit)
                .lean(),

            User.countDocuments({
                school: schoolId,
                role: "student",
                isActive: true
            })
        ]);

        const formattedStudents = [];
        for (const student of students) {
            const classId = student.classInfo?.id || null;
            const sectionId = student.sectionInfo?.id || null;

            const { className, sectionName } =
                await getClassSectionInfo(classId, sectionId, schoolId);

            formattedStudents.push({
                ...student,
                classInfo: {
                    id: classId,
                    className
                },
                sectionInfo: {
                    id: sectionId,
                    sectionName
                }
            });

        }

        return res.status(200).json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            students: formattedStudents
        });
    } catch (err) {
        console.error("Error fetching students:", err);
        return res.status(500).json({ message: err.message || "Server error while fetching students" });
    }
};

const getStudentsBySection = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const { sectionId } = req.params;

        if (!sectionId) {
            return res.status(400).json({ message: "sectionId is required" });
        }

        const students = await User.find({
            school: schoolId,
            role: "student",
            isActive: true,
            "sectionInfo.id": sectionId,
        }).select("-password -forgotPasswordOTP -otp -tokenVersion -isActive -isIncharge");

        if (!students.length) {
            return res.status(404).json({ message: "No students found in this section" });
        }

        return res.status(200).json({
            total: students.length,
            students,
        });
    } catch (err) {
        console.error("Error fetching students by section:", err);
        return res.status(500).json({
            message: err.message || "Server error while fetching students by section",
        });
    }
};

const deleteStudentBySchool = async (req, res) => {
    try {
        const { id } = req.params;
        const student = await User.findById(id);
        if (!student || student.role !== "student")
            return res.status(404).json({ message: "Student not found" });

        if (student.school.toString() !== req.user.school.toString())
            return res.status(403).json({ message: "Unauthorized" });

        const { cnicFront, cnicBack, recentPic } = student.images || {};
        for (const fileUrl of [cnicFront, cnicBack, recentPic].filter(Boolean))
            await deleteFileFromS3(fileUrl);

        await student.deleteOne();
        await School.findByIdAndUpdate(req.user.school, { $inc: { noOfStudents: -1 } });

        return res.status(200).json({ message: "Student deleted successfully" });
    } catch (err) {
        console.error("Error deleting student:", err);
        return res.status(500).json({ message: err.message || "Server error while deleting student" });
    }
};

const editOwnProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const existing = await User.findById(userId);

        if (!existing)
            return res.status(404).json({ message: "User not found" });

        const updatedImages = await uploadFiles(req.files, existing.images);

        const updatableFields = {
            name: req.body.name ?? existing.name,
            email: req.body.email ?? existing.email,
            phone: req.body.phone ?? existing.phone,
            address: req.body.address ?? existing.address,
            cnic: req.body.cnic ?? existing.cnic,
            images: updatedImages,
        };

        if (existing.role === "teacher" || existing.role === "admin_office") {
            updatableFields.salary = req.body.salary ?? existing.salary;
            updatableFields.joiningDate = req.body.joiningDate ?? existing.joiningDate;
        } else if (existing.role === "student") {
            updatableFields.fatherName = req.body.fatherName ?? existing.fatherName;
        }

        const updated = await User.findByIdAndUpdate(userId, updatableFields, { new: true });

        return res.status(200).json({
            message: "Profile updated successfully",
            user: updated
        });

    } catch (err) {
        console.error("Error updating profile:", err);
        return res.status(500).json({ message: err.message || "Server error while updating profile" });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email, username } = req.body;

        let user;

        if (username) {
            user = await User.findOne({ username: username.toLowerCase() });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            // If email provided, ensure it matches
            if (email && user.email.toLowerCase() !== email.toLowerCase()) {
                return res.status(400).json({ message: "Email does not match username" });
            }
        } else if (email) {
            user = await User.findOne({ email: email.toLowerCase() });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            if (user.role === "student") {
                return res.status(400).json({
                    message: "Students must provide username with email"
                });
            }
        } else {
            return res.status(400).json({
                message: "Please provide email or username"
            });
        }

        if (!user.password) {
            return res.status(400).json({
                message: "Password not set. Use initial setup flow."
            });
        }

        const otpCode = generateOTP();
        const otpExpiry = calculateOTPExpiry(10);

        user.forgotPasswordOTP = {
            code: otpCode,
            expiresAt: otpExpiry,
            attempts: 0
        };

        await user.save();

        await emailService.sendForgotPasswordOTPEmail(
            user.email,
            otpCode,
            username || user.name,
        );

        return res.status(200).json({
            message: "OTP sent to registered email",
            email: user.email,
            username: user.username,
            role: user.role,
            otpExpiry
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
};

// Verify Forgot Password OTP
const verifyForgotPasswordOTP = async (req, res) => {
    try {
        const { email, otp, username } = req.body;

        if (!email && !username) {
            return res.status(400).json({
                message: "Please provide either email or username"
            });
        }

        const query = {};
        let user = null;

        if (username) {
            query.username = username.toLowerCase();
            user = await User.findOne(query);

            if (!user) {
                return res.status(404).json({
                    message: "No user found with this username"
                });
            }

            if (email && user.email.toLowerCase() !== email.toLowerCase()) {
                return res.status(400).json({
                    message: "Email does not match the provided username"
                });
            }
        } else if (email) {
            // If only email is provided
            query.email = email.toLowerCase();

            // Find user by email
            user = await User.findOne(query);

            if (!user) {
                return res.status(404).json({
                    message: "No user found with this email"
                });
            }

            // For students, require username when using email
            if (user.role === 'student') {
                return res.status(400).json({
                    message: "For students, please provide username along with email. Multiple students may share the same email.",
                    suggestion: "Provide username parameter in your request"
                });
            }
        }

        // Check if forgotPasswordOTP exists
        if (!user.forgotPasswordOTP) {
            return res.status(400).json({
                message: "No password reset request found. Please request a new OTP."
            });
        }

        // Check OTP attempts
        if (user.forgotPasswordOTP.attempts >= 5) {
            return res.status(429).json({
                message: "Too many OTP attempts. Please request a new OTP."
            });
        }

        // Validate OTP
        const isExpired = new Date() > new Date(user.forgotPasswordOTP.expiresAt);
        if (isExpired) {
            user.forgotPasswordOTP.attempts += 1;
            user.forgotPasswordOTP.lastAttempt = new Date();
            await user.save();

            return res.status(400).json({
                message: "OTP has expired. Please request a new OTP.",
                attemptsRemaining: 5 - user.forgotPasswordOTP.attempts
            });
        }

        if (otp !== user.forgotPasswordOTP.code) {
            user.forgotPasswordOTP.attempts += 1;
            user.forgotPasswordOTP.lastAttempt = new Date();
            await user.save();

            return res.status(400).json({
                message: "Invalid OTP",
                attemptsRemaining: 5 - user.forgotPasswordOTP.attempts
            });
        }

        // Mark OTP as verified for password reset
        user.forgotPasswordOTP.verified = true;
        await user.save();

        return res.status(200).json({
            message: "OTP verified successfully. You can now set new password.",
            canResetPassword: true,
            email: user.email,
            username: user.username,
            role: user.role
        });
    } catch (err) {
        console.error("Error verifying forgot password OTP:", err);
        return res.status(500).json({
            message: "Server error while verifying OTP",
            error: err.message,
        });
    }
};

// Reset Password with OTP 
const resetPasswordWithOTP = async (req, res) => {
    try {
        const { email, otp, newPassword, username } = req.body;

        // Validate input
        if (!email && !username) {
            return res.status(400).json({
                message: "Please provide either email or username"
            });
        }

        const query = {};
        let user = null;

        if (username) {
            query.username = username.toLowerCase();
            user = await User.findOne(query);

            if (!user) {
                return res.status(404).json({
                    message: "No user found with this username"
                });
            }

            if (email && user.email.toLowerCase() !== email.toLowerCase()) {
                return res.status(400).json({
                    message: "Email does not match the provided username"
                });
            }
        } else if (email) {
            query.email = email.toLowerCase();

            user = await User.findOne(query);

            if (!user) {
                return res.status(404).json({
                    message: "No user found with this email"
                });
            }

            if (user.role === 'student') {
                return res.status(400).json({
                    message: "For students, please provide username along with email. Multiple students may share the same email.",
                    suggestion: "Provide username parameter in your request"
                });
            }
        }

        if (!user.forgotPasswordOTP || !user.forgotPasswordOTP.verified) {
            return res.status(400).json({
                message: "Please verify OTP first before resetting password."
            });
        }

        if (otp !== user.forgotPasswordOTP.code) {
            return res.status(400).json({
                message: "Invalid OTP"
            });
        }

        const isExpired = new Date() > new Date(user.forgotPasswordOTP.expiresAt);
        if (isExpired) {
            user.forgotPasswordOTP = undefined;
            await user.save();

            return res.status(400).json({
                message: "OTP has expired. Please request a new password reset."
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;

        user.forgotPasswordOTP = undefined;

        await user.save();

        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                role: user.role,
                school: user.school,
                ...(user.username && { username: user.username })
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Send password changed notification email
        try {
            await emailService.sendPasswordChangedNotification(
                user.email,
                user.name || "User",
                user.school
            );
        } catch (emailError) {
            console.error('Failed to send password changed notification:', emailError);
        }

        return res.status(200).json({
            message: "Password reset successfully!",
            data: {
                token: token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    username: user.username,
                    role: user.role,
                    school: user.school
                }
            }
        });
    } catch (err) {
        console.error("Error resetting password with OTP:", err);
        return res.status(500).json({
            message: "Server error while resetting password",
            error: err.message,
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, username, oldPassword, newPassword } = req.body;

        let user;

        if (username) {
            user = await User.findOne({ username: username.toLowerCase() });

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            // If email provided, ensure it matches
            if (email && user.email.toLowerCase() !== email.toLowerCase()) {
                return res.status(400).json({
                    message: "Email does not match the provided username"
                });
            }
        }
        else if (email) {
            user = await User.findOne({ email: email.toLowerCase() });

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            // Students MUST provide username
            if (user.role === "student") {
                return res.status(400).json({
                    message: "Students must provide username with email"
                });
            }
        }
        else {
            return res.status(400).json({
                message: "Please provide email or username"
            });
        }

        // ---------------- VERIFY OLD PASSWORD ----------------
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({
                message: "Current password is incorrect"
            });
        }

        // Prevent reusing same password
        const isSame = await bcrypt.compare(newPassword, user.password);
        if (isSame) {
            return res.status(400).json({
                message: "New password must be different from current password"
            });
        }

        // ---------------- UPDATE PASSWORD ----------------
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        // ---------------- NOTIFY USER ----------------
        try {
            await emailService.sendPasswordChangedNotification(
                user.email,
                user.name || "User"
            );
        } catch (e) {
            console.error("Password changed email failed:", e);
        }

        return res.status(200).json({
            message: "Password updated successfully",
            data: {
                email: user.email,
                username: user.username,
                role: user.role
            }
        });

    } catch (err) {
        console.error("Reset password error:", err);
        return res.status(500).json({
            message: "Server error while resetting password",
            error: err.message
        });
    }
};

// Resend Forgot Password OTP
const resendForgotPasswordOTP = async (req, res) => {
    try {
        const { email, username } = req.body;

        // Validate input
        if (!email && !username) {
            return res.status(400).json({
                message: "Please provide either email or username"
            });
        }

        const query = {};
        let user = null;

        if (username) {
            query.username = username.toLowerCase();
            user = await User.findOne(query);

            if (!user) {
                return res.status(404).json({
                    message: "No user found with this username"
                });
            }

            // If email was also provided, verify it matches
            if (email && user.email.toLowerCase() !== email.toLowerCase()) {
                return res.status(400).json({
                    message: "Email does not match the provided username"
                });
            }
        } else if (email) {
            // If only email is provided
            query.email = email.toLowerCase();

            // Find user by email
            user = await User.findOne(query);

            if (!user) {
                return res.status(404).json({
                    message: "No user found with this email"
                });
            }

            // For students, require username when using email
            if (user.role === 'student') {
                return res.status(400).json({
                    message: "For students, please provide username along with email. Multiple students may share the same email.",
                    suggestion: "Provide username parameter in your request"
                });
            }
        }

        // Check if password reset was requested
        if (!user.forgotPasswordOTP) {
            return res.status(400).json({
                message: "No password reset request found. Please use forgot password first."
            });
        }

        // Check if OTP is already verified
        if (user.forgotPasswordOTP.verified) {
            return res.status(400).json({
                message: "OTP already verified. Please reset your password or request a new OTP."
            });
        }

        // Check cooldown (1 minute)
        if (user.forgotPasswordOTP.lastAttempt) {
            const cooldownTime = 60 * 1000; // 1 minute
            const timeSinceLastAttempt = new Date() - new Date(user.forgotPasswordOTP.lastAttempt);

            if (timeSinceLastAttempt < cooldownTime) {
                const waitTime = Math.ceil((cooldownTime - timeSinceLastAttempt) / 1000);
                return res.status(429).json({
                    message: `Please wait ${waitTime} seconds before requesting a new OTP`
                });
            }
        }

        // Generate new OTP
        const newOTP = generateOTP();
        const newExpiry = calculateOTPExpiry(10);

        // Update OTP
        user.forgotPasswordOTP.code = newOTP;
        user.forgotPasswordOTP.expiresAt = newExpiry;
        user.forgotPasswordOTP.attempts = 0;
        user.forgotPasswordOTP.verified = false;
        user.forgotPasswordOTP.lastAttempt = new Date();
        await user.save();

        // Send new OTP email
        try {
            await emailService.sendForgotPasswordOTPEmail(
                user.email,
                newOTP,
                user.name || "User"
            );
        } catch (emailError) {
            console.error('Failed to send email, but OTP is still generated:', emailError);
            // Don't fail the request - OTP is still stored
        }

        return res.status(200).json({
            message: "New OTP sent successfully",
            email: user.email,
            username: user.username,
            role: user.role,
            otpExpiry: newExpiry,
            note: "OTP is valid for 10 minutes",
            ...(process.env.NODE_ENV === 'development' && { otpCode: newOTP })
        });
    } catch (err) {
        console.error("Error resending forgot password OTP:", err);
        return res.status(500).json({
            message: "Server error while resending OTP",
            error: err.message,
        });
    }
};

const toggleUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const schoolId = req.user.school;

        const user = await User.findOne({
            _id: userId,
            school: schoolId
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found in your school"
            });
        }

        const newStatus = !user.isActive;
        user.isActive = newStatus;

        user.tokenVersion = (user.tokenVersion || 0) + 1;

        await user.save();

        return res.status(200).json({
            success: true,
            message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                tokenVersion: user.tokenVersion
            }
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};

module.exports = {
    sendUserOTP,
    verifyUserOTP,
    resendUserOTP,
    setPasswordAfterOTP,
    addEmployeeBySchool,
    editEmployeeBySchool,
    getAllEmployeesBySchool,
    getEmployeeById,
    deleteEmployeeBySchool,
    addStudentBySchool,
    getAllStudentsBySchool,
    getStudentsBySection,
    getStudentById,
    getStudentsByParentEmail,
    getStudentSiblingsByEmail,
    editStudentBySchool,
    deleteStudentBySchool,
    editOwnProfile,
    forgotPassword,
    verifyForgotPasswordOTP,
    resetPasswordWithOTP,
    resetPassword,
    resendForgotPasswordOTP,
    toggleUserStatus,
};