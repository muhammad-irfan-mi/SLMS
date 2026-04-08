const ClassSection = require("../models/ClassSection");
const School = require("../models/School");
const common = require("./common.controller");
const { sendProfileUpdateNotification, sendEmailChangeNotification } = require("../utils/notificationService");
const Staff = require("../models/Staff");

// Helper function to get class and section names
const getClassAndSectionNames = async (classId, sectionId, schoolId) => {
    if (!classId) return { classInfo: null, sectionInfo: null };

    const classDoc = await ClassSection.findOne({
        _id: classId,
        school: schoolId
    }).lean();

    if (!classDoc) {
        return { classInfo: null, sectionInfo: null };
    }

    const classInfo = {
        id: classDoc._id,
        name: classDoc.class
    };

    let sectionInfo = null;
    if (sectionId && classDoc.sections?.length) {
        const sectionObj = classDoc.sections.find(
            (sec) => sec._id.toString() === sectionId.toString()
        );
        if (sectionObj) {
            sectionInfo = {
                id: sectionObj._id,
                name: sectionObj.name
            };
        }
    }

    return { classInfo, sectionInfo };
};

// Get class and section info for staff
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

// Add staff
const addStaff = async (req, res) => {
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

        // Check if staff exists in this school
        const existing = await Staff.findOne({
            email: { $regex: new RegExp(`^${email}$`, 'i') },
            school: schoolId,
            isActive: true
        });

        if (existing) {
            return res.status(400).json({
                message: "Staff member with this email already exists in your school"
            });
        }

        let classInfo = null;
        let sectionInfo = null;

        if (classId) {
            const result = await getClassAndSection(classId, sectionId, schoolId);
            if (result.error) {
                return res.status(400).json({ message: result.error });
            }
            classInfo = result.classInfo;
            sectionInfo = result.sectionInfo;
        }

        const otpCode = common.generateOTP();
        const otpExpiry = common.calculateOTPExpiry(10);

        // Handle file uploads
        const images = await common.uploadFiles(req.files);

        const staff = new Staff({
            name,
            email: email.toLowerCase(),
            phone,
            address,
            cnic,
            role,
            salary: role === "teacher" ? salary : salary || null,
            joiningDate,
            isIncharge: isIncharge || false,
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
            },
            verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });

        await staff.save();

        // Send OTP email
        const emailService = require("../services/email.service");
        await emailService.sendUserOTPEmail(email, otpCode, name, schoolId, role);

        return res.status(201).json({
            message: "Staff added successfully. OTP sent for verification.",
            staffId: staff._id,
            employeeId: staff.employeeId,
            email,
            otpExpiry
        });

    } catch (err) {
        console.error("Error adding staff:", err);
        return res.status(500).json({
            message: err.message || "Server error while adding staff"
        });
    }
};

// Update staff
const updateStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.school;

        const existing = await Staff.findById(id);
        if (!existing || !["teacher", "admin_office"].includes(existing.role)) {
            return res.status(404).json({ message: "Staff not found" });
        }

        if (existing.school.toString() !== schoolId.toString()) {
            return res.status(403).json({ message: "Unauthorized to update staff" });
        }

        if (existing.isActive === false) {
            return res.status(400).json({
                message: "Staff not found in your school."
            });
        }

        const images = await common.uploadFiles(req.files, existing.images);
        const changes = [];

        // Track changes
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
        if (req.body.isIncharge !== undefined && req.body.isIncharge !== existing.isIncharge) {
            changes.push(`Incharge status changed`);
        }

        let otpData = existing.otp;
        let verified = existing.verified;
        let emailChanged = false;
        let oldEmail = null;

        // Handle email change
        if (req.body.email) {
            const newEmail = req.body.email.toLowerCase();

            if (newEmail !== existing.email.toLowerCase()) {
                oldEmail = existing.email;
                emailChanged = true;
                changes.push(`Email changed from ${existing.email} to ${newEmail}`);

                const emailExists = await Staff.findOne({
                    _id: { $ne: id },
                    email: { $regex: new RegExp(`^${newEmail}$`, 'i') },
                    school: schoolId,
                    isActive: true
                });

                if (emailExists) {
                    return res.status(400).json({
                        message: `Email "${newEmail}" already exists for another staff member`
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
                    newEmail,
                    otpCode,
                    req.body.name || existing.name,
                    schoolId,
                    existing.role
                );
            }
        }

        // Handle class/section update
        let classInfo = existing.classInfo;
        let sectionInfo = existing.sectionInfo;

        if (req.body.classId) {
            const result = await getClassAndSection(
                req.body.classId, 
                req.body.sectionId, 
                schoolId
            );
            if (result.error) {
                return res.status(400).json({ message: result.error });
            }
            classInfo = result.classInfo;
            sectionInfo = result.sectionInfo;
        }

        const updateFields = {
            name: req.body.name ?? existing.name,
            email: req.body.email ? req.body.email.toLowerCase() : existing.email,
            phone: req.body.phone ?? existing.phone,
            address: req.body.address ?? existing.address,
            cnic: req.body.cnic ?? existing.cnic,
            salary: req.body.salary ?? existing.salary,
            joiningDate: req.body.joiningDate ?? existing.joiningDate,
            isIncharge: req.body.isIncharge !== undefined ? req.body.isIncharge : existing.isIncharge,
            classInfo,
            sectionInfo,
            images,
            otp: otpData,
            verified,
            updatedAt: new Date()
        };

        if (req.body.password) {
            changes.push("Password reset requested");
            const bcrypt = require("bcryptjs");
            updateFields.password = await bcrypt.hash(req.body.password, 10);
        }

        const updatedStaff = await Staff.findByIdAndUpdate(
            id,
            updateFields,
            { new: true, runValidators: true }
        ).select("-password -otp -forgotPasswordOTP");

        // Send notifications
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
            }
        } catch (notificationError) {
            console.error('Error sending notifications:', notificationError.message);
        }

        return res.status(200).json({
            message: emailChanged
                ? "Staff updated successfully. OTP sent to new email for verification."
                : "Staff updated successfully.",
            staff: updatedStaff
        });

    } catch (err) {
        console.error("Error updating staff:", err);
        return res.status(500).json({
            message: err.message || "Server error while updating staff"
        });
    }
};

// Get all staff
const getAllStaff = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const { role, page = 1, limit = 10 } = req.query;

        const filter = {
            school: schoolId,
            isActive: true
        };

        if (role) {
            filter.role = role;
        } else {
            filter.role = { $in: ["teacher", "admin_office"] };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [staff, total] = await Promise.all([
            Staff.find(filter)
                .select("-password -otp -forgotPasswordOTP -tokenVersion")
                .skip(skip)
                .limit(parseInt(limit))
                .sort({ role: 1, name: 1 })
                .lean(),
            Staff.countDocuments(filter)
        ]);

        // Fetch class and section names for each staff
        const staffWithNames = await Promise.all(staff.map(async (staffMember) => {
            const { classInfo, sectionInfo } = await getClassAndSectionNames(
                staffMember.classInfo?.id,
                staffMember.sectionInfo?.id,
                schoolId
            );
            
            return {
                ...staffMember,
                classInfo,
                sectionInfo
            };
        }));

        return res.status(200).json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
            staff: staffWithNames
        });

    } catch (err) {
        console.error("Error fetching staff:", err);
        return res.status(500).json({
            message: err.message || "Server error while fetching staff"
        });
    }
};

// Get staff by ID
const getStaffById = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.school;

        const staff = await Staff.findById(id)
            .select("-password -otp -forgotPasswordOTP")
            .populate('school', 'name logo')
            .lean();

        if (!staff || !["teacher", "admin_office"].includes(staff.role)) {
            return res.status(404).json({ message: "Staff not found" });
        }

        if (staff.school?._id.toString() !== schoolId.toString()) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        // Fetch class and section names
        const { classInfo, sectionInfo } = await getClassAndSectionNames(
            staff.classInfo?.id,
            staff.sectionInfo?.id,
            schoolId
        );

        const formattedStaff = {
            ...staff,
            classInfo,
            sectionInfo
        };

        return res.status(200).json({ staff: formattedStaff });

    } catch (err) {
        console.error("Error fetching staff:", err);
        return res.status(500).json({
            message: err.message || "Server error while fetching staff"
        });
    }
};

// Update own profile
const updateOwnProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const existing = await Staff.findById(userId);

        if (!existing) {
            return res.status(404).json({ message: "User not found" });
        }

        const updatedImages = await common.uploadFiles(req.files, existing.images);

        const updatableFields = {
            name: req.body.name ?? existing.name,
            phone: req.body.phone ?? existing.phone,
            address: req.body.address ?? existing.address,
            cnic: req.body.cnic ?? existing.cnic,
            images: updatedImages,
            salary: req.body.salary ?? existing.salary,
            joiningDate: req.body.joiningDate ?? existing.joiningDate,
            updatedAt: new Date()
        };

        const updated = await Staff.findByIdAndUpdate(
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

// Toggle staff status
const toggleStaffStatus = async (req, res) => {
    return common.toggleUserStatus(req, res, Staff);
};

// Auth functions using common controller
const sendOTP = (req, res) => common.sendOTP(req, res, Staff, 'staff');
const verifyOTP = (req, res) => common.verifyOTP(req, res, Staff, 'staff');
const resendOTP = (req, res) => common.resendOTP(req, res, Staff, 'staff');
const setPasswordAfterOTP = (req, res) => common.setPasswordAfterOTP(req, res, Staff, 'staff');
const forgotPassword = (req, res) => common.forgotPassword(req, res, Staff, 'staff');
const verifyForgotPasswordOTP = (req, res) => common.verifyForgotPasswordOTP(req, res, Staff, 'staff');
const resetPasswordWithOTP = (req, res) => common.resetPasswordWithOTP(req, res, Staff, 'staff');
const resetPassword = (req, res) => common.resetPassword(req, res, Staff, 'staff');
const resendForgotPasswordOTP = (req, res) => common.resendForgotPasswordOTP(req, res, Staff, 'staff');
const login = (req, res) => common.login(req, res, Staff, 'staff');

module.exports = {
    addStaff,
    updateStaff,
    getAllStaff,
    getStaffById,
    updateOwnProfile,
    toggleStaffStatus,
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