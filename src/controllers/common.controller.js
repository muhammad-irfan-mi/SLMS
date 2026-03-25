const bcrypt = require("bcryptjs");
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const emailService = require("../services/email.service");
const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");
const School = require("../models/School");

// Generate OTP
const generateOTP = () => {
    return crypto.randomInt(100000, 999999).toString();
};

// Calculate OTP expiry
const calculateOTPExpiry = (minutes = 10) => {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + minutes);
    return expiry;
};

const uploadFiles = async (files, existingImages = {}) => {
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
};

// Send OTP for verification
const sendOTP = async (req, res, Model, userType) => {
    try {
        const { email, username } = req.body;

        const query = { email: { $regex: new RegExp(`^${email}$`, 'i') } };

        // For students, username is required in query
        if (username && userType === 'student') {
            query.username = { $regex: new RegExp(`^${username}$`, 'i') };
        }

        const existingUser = await Model.findOne(query);

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
            existingUser.name || "User",
            existingUser.school,
            username || null,
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

// Verify OTP
const verifyOTP = async (req, res, Model, userType) => {
    try {
        const { email, otp, username } = req.body;

        const query = {
            email: { $regex: new RegExp(`^${email}$`, 'i') },
            verified: false
        };

        if (username && userType === 'student') {
            query.username = { $regex: new RegExp(`^${username}$`, 'i') };
        }

        const user = await Model.findOne(query);

        if (!user) {
            return res.status(404).json({
                message: "No pending verification found for this user"
            });
        }

        if (!user.otp) {
            return res.status(400).json({
                message: "No OTP found. Please request a new OTP."
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

        user.verified = true;
        user.otp = undefined;
        user.verificationExpiresAt = undefined;
        await user.save();

        return res.status(200).json({
            message: "User verified successfully! You can now set your password.",
            data: {
                email: user.email,
                username: user.username,
                name: user.name,
                role: user.role,
                userType: user.userType,
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

// Resend OTP
const resendOTP = async (req, res, Model, userType) => {
    try {
        const { email, username } = req.body;

        const query = {
            email: { $regex: new RegExp(`^${email}$`, 'i') },
            verified: false
        };

        if (username && userType === 'student') {
            query.username = { $regex: new RegExp(`^${username}$`, 'i') };
        }

        const user = await Model.findOne(query);

        if (!user) {
            return res.status(404).json({
                message: "No pending verification found for this user"
            });
        }

        if (!user.otp) {
            return res.status(400).json({
                message: "No OTP found. Please request a new OTP."
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

        const newOTP = generateOTP();
        const newExpiry = calculateOTPExpiry(10);

        user.otp.code = newOTP;
        user.otp.expiresAt = newExpiry;
        user.otp.attempts = 0;
        user.otp.lastAttempt = new Date();
        await user.save();

        await emailService.sendUserOTPEmail(
            email,
            newOTP,
            user.name || "User",
            user.school,
            username || null,
            user.role
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

// Set password after OTP
const setPasswordAfterOTP = async (req, res, Model, userType) => {
    try {
        const { email, password, username } = req.body;

        const query = {
            email: { $regex: new RegExp(`^${email}$`, 'i') },
            verified: true
        };

        if (username && userType === 'student') {
            query.username = { $regex: new RegExp(`^${username}$`, 'i') };
        }

        const user = await Model.findOne(query).select('+password');

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

        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                userType: user.userType || (userType === 'staff' ? 'Staff' : 'Student'),
                role: user.role,
                school: user.school,
                ...(user.username && { username: user.username })
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Prepare user response based on type
        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            userType: user.userType || (userType === 'staff' ? 'Staff' : 'Student'),
            role: user.role,
            school: user.school
        };

        // Add type-specific fields
        if (userType === 'student') {
            userResponse.username = user.username;
            userResponse.rollNo = user.rollNo;
            userResponse.discount = user.discount;
        } else {
            userResponse.employeeId = user.employeeId;
            userResponse.isIncharge = user.isIncharge;
        }

        return res.status(200).json({
            message: "Password set successfully! You are now logged in.",
            data: {
                token: token,
                user: userResponse
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

// Forgot password
const forgotPassword = async (req, res, Model, userType) => {
    console.log('usertype', userType)
    try {
        const { email, username } = req.body;

        let user;

        if (userType === 'student') {
            if (username && email) {
                user = await Model.findOne({
                    username: username.toLowerCase(),
                    email: { $regex: new RegExp(`^${email}$`, "i") }
                }).select('+password');;
            } else if (username) {
                user = await Model.findOne({
                    username: username.toLowerCase()
                }).select('+password');
            } else if (email) {
                user = await Model.findOne({
                    email: { $regex: new RegExp(`^${email}$`, 'i') }
                }).select('+password');
            }

            if (!user) {
                return res.status(404).json({
                    message: "Student not found. Please provide valid username and email."
                });
            }
        } else {
            if (!email) {
                return res.status(400).json({
                    message: "Email is required for staff password reset"
                });
            }

            user = await Model.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } }).select('+password');;

            if (!user) {
                return res.status(404).json({ message: "Staff not found with this email" });
            }
        }

        console.log('user', user)
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
            attempts: 0,
            lastAttempt: new Date(),
            verified: false
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
        return res.status(500).json({ message: "Server error" });
    }
};

// Verify forgot password OTP
const verifyForgotPasswordOTP = async (req, res, Model, userType) => {
    try {
        const { email, otp, username } = req.body;

        let user = null;

        if (userType === 'student') {
            if (email && username) {
                user = await Model.findOne({
                    email: { $regex: new RegExp(`^${email}$`, "i") },
                    username: username.toLowerCase(),
                });
            } else if (username) {
                user = await Model.findOne({
                    username: username.toLowerCase(),
                });
            } else if (email) {
                user = await Model.findOne({
                    email: { $regex: new RegExp(`^${email}$`, "i") },
                });
            }
        } else {
            if (email) {
                user = await Model.findOne({
                    email: { $regex: new RegExp(`^${email}$`, "i") },
                });
            }
        }

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        if (!user.forgotPasswordOTP) {
            return res.status(400).json({
                message: "No password reset request found. Please request a new OTP.",
            });
        }

        if (user.forgotPasswordOTP.attempts >= 5) {
            return res.status(429).json({
                message: "Too many OTP attempts. Please request a new OTP.",
            });
        }

        const isExpired = new Date() > new Date(user.forgotPasswordOTP.expiresAt);

        if (isExpired) {
            user.forgotPasswordOTP.attempts += 1;
            user.forgotPasswordOTP.lastAttempt = new Date();
            await user.save();

            return res.status(400).json({
                message: "OTP has expired. Please request a new OTP.",
                attemptsRemaining: 5 - user.forgotPasswordOTP.attempts,
            });
        }

        if (otp !== user.forgotPasswordOTP.code) {
            user.forgotPasswordOTP.attempts += 1;
            user.forgotPasswordOTP.lastAttempt = new Date();
            await user.save();

            return res.status(400).json({
                message: "Invalid OTP",
                attemptsRemaining: 5 - user.forgotPasswordOTP.attempts,
            });
        }

        user.forgotPasswordOTP.verified = true;
        await user.save();

        return res.status(200).json({
            message: "OTP verified successfully. You can now reset your password.",
            canResetPassword: true,
            email: user.email,
            username: user.username || null,
            role: user.role,
        });
    } catch (err) {
        console.error("Verify forgot password OTP error:", err);
        return res.status(500).json({
            message: "Server error while verifying OTP",
            error: err.message,
        });
    }
};

// Reset password with OTP
const resetPasswordWithOTP = async (req, res, Model, userType) => {
    try {
        const { email, otp, newPassword, username } = req.body;

        let user = null;

        if (userType === 'student') {
            if (username && email) {
                user = await Model.findOne({
                    username: username.toLowerCase(),
                    email: { $regex: new RegExp(`^${email}$`, "i") }
                });
            } else if (username) {
                user = await Model.findOne({
                    username: username.toLowerCase(),
                });
            } else if (email) {
                user = await Model.findOne({
                    email: { $regex: new RegExp(`^${email}$`, "i") }
                });
            }
        } else {
            if (email) {
                user = await Model.findOne({
                    email: { $regex: new RegExp(`^${email}$`, 'i') }
                });
            }
        }

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
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

        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                userType: user.userType || (userType === 'staff' ? 'Staff' : 'Student'),
                role: user.role,
                school: user.school,
                ...(user.username && { username: user.username })
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        try {
            await emailService.sendPasswordChangedNotification(
                user.email,
                user.name || "User",
                user.school
            );
        } catch (emailError) {
            console.error('Failed to send password changed notification:', emailError);
        }

        // Prepare user response based on type
        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            userType: user.userType || (userType === 'staff' ? 'Staff' : 'Student'),
            role: user.role,
            school: user.school
        };

        if (userType === 'student') {
            userResponse.username = user.username;
            userResponse.rollNo = user.rollNo;
        } else {
            userResponse.employeeId = user.employeeId;
        }

        return res.status(200).json({
            message: "Password reset successfully!",
            data: {
                token: token,
                user: userResponse
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

// Resend forgot password OTP
const resendForgotPasswordOTP = async (req, res, Model, userType) => {
    try {
        const { email, username } = req.body;

        let user = null;

        if (userType === 'student') {
            if (username) {
                user = await Model.findOne({ username: username.toLowerCase() });
            } else if (email) {
                user = await Model.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
            }
        } else {
            if (email) {
                user = await Model.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
            }
        }

        if (!user) {
            return res.status(404).json({
                message: "No user found"
            });
        }

        if (!user.forgotPasswordOTP) {
            return res.status(400).json({
                message: "No password reset request found. Please use forgot password first."
            });
        }

        if (user.forgotPasswordOTP.verified) {
            return res.status(400).json({
                message: "OTP already verified. Please reset your password or request a new OTP."
            });
        }

        if (user.forgotPasswordOTP.lastAttempt) {
            const cooldownTime = 60 * 1000;
            const timeSinceLastAttempt = new Date() - new Date(user.forgotPasswordOTP.lastAttempt);

            if (timeSinceLastAttempt < cooldownTime) {
                const waitTime = Math.ceil((cooldownTime - timeSinceLastAttempt) / 1000);
                return res.status(429).json({
                    message: `Please wait ${waitTime} seconds before requesting a new OTP`
                });
            }
        }

        const newOTP = generateOTP();
        const newExpiry = calculateOTPExpiry(10);

        user.forgotPasswordOTP.code = newOTP;
        user.forgotPasswordOTP.expiresAt = newExpiry;
        user.forgotPasswordOTP.attempts = 0;
        user.forgotPasswordOTP.verified = false;
        user.forgotPasswordOTP.lastAttempt = new Date();
        await user.save();

        try {
            await emailService.sendForgotPasswordOTPEmail(
                user.email,
                newOTP,
                user.name || "User"
            );
        } catch (emailError) {
            console.error('Failed to send email:', emailError);
        }

        return res.status(200).json({
            message: "New OTP sent successfully",
            email: user.email,
            username: user.username,
            role: user.role,
            otpExpiry: newExpiry,
            note: "OTP is valid for 10 minutes"
        });
    } catch (err) {
        console.error("Error resending forgot password OTP:", err);
        return res.status(500).json({
            message: "Server error while resending OTP",
            error: err.message,
        });
    }
};

// Reset password with old password
const resetPassword = async (req, res, Model, userType) => {
    try {
        const { email, username, oldPassword, newPassword } = req.body;

        let user;

        if (userType === 'student') {
            if (username && email) {
                user = await Model.findOne({
                    username: username.toLowerCase(),
                    email: { $regex: new RegExp(`^${email}$`, "i") }
                }).select('+password');
            } else if (username) {
                user = await Model.findOne({
                    username: username.toLowerCase()
                }).select('+password');
            } else if (email) {
                user = await Model.findOne({
                    email: { $regex: new RegExp(`^${email}$`, 'i') }
                }).select('+password');
            }
        } else {
            if (email) {
                user = await Model.findOne({
                    email: { $regex: new RegExp(`^${email}$`, 'i') }
                }).select('+password');
            }
        }

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!user.password) {
            return res.status(400).json({
                message: "Password not set. Please use OTP verification first."
            });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({
                message: "Current password is incorrect"
            });
        }

        const isSame = await bcrypt.compare(newPassword, user.password);
        if (isSame) {
            return res.status(400).json({
                message: "New password must be different from current password"
            });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

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

// Toggle user status
const toggleUserStatus = async (req, res, Model) => {
    try {
        const { userId } = req.params;
        const schoolId = req.user.school;

        const user = await Model.findOne({
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

        if (!newStatus) {
            user.deactivatedAt = new Date();
        } else {
            user.deactivatedAt = null;
        }

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
        console.error("Toggle user status error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};

// Login
const login = async (req, res, Model, userType) => {
    try {
        const { email, username, password } = req.body;

        let user = null;

        if (userType === 'student') {
            // Students require both username and email for login
            if (!username || !email) {
                return res.status(400).json({
                    message: "Both email and username are required for student login"
                });
            }

            user = await Model.findOne({
                username: username.toLowerCase(),
                email: email.toLowerCase()
            }).select('+password');
        } else {
            // Staff login with email only
            if (!email) {
                return res.status(400).json({
                    message: "Email is required for staff login"
                });
            }

            user = await Model.findOne({
                email: email.toLowerCase()
            }).select('+password');
        }

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        if (!user.isActive) {
            return res.status(401).json({ message: "Account is deactivated" });
        }

        if (!user.password) {
            return res.status(401).json({
                message: "Password not set. Please use OTP verification first."
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        let schoolTokenVersion = null;
        if (user.school) {
            const school = await School.findById(user.school).select('tokenVersion');
            if (school) {
                schoolTokenVersion = school.tokenVersion;
            }
        }

        const tokenPayload = {
            id: user._id,
            email: user.email,
            role: user.role,
            school: user.school
        };

        if (user.tokenVersion !== undefined) {
            tokenPayload.tokenVersion = user.tokenVersion;
        }

        if (schoolTokenVersion !== null) {
            tokenPayload.schoolTokenVersion = schoolTokenVersion;
        }

        if (user.username) {
            tokenPayload.username = user.username;
        }
        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Prepare user response based on type
        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            school: user.school
        };

        // Add type-specific fields (only existing fields)
        if (userType === 'student') {
            if (user.username) userResponse.username = user.username;
            if (user.rollNo) userResponse.rollNo = user.rollNo;
            if (user.classInfo) userResponse.classInfo = user.classInfo;
            if (user.sectionInfo) userResponse.sectionInfo = user.sectionInfo;
            if (user.discount !== undefined) userResponse.discount = user.discount;
        } else {
            if (user.employeeId) userResponse.employeeId = user.employeeId;
            if (user.isIncharge !== undefined) userResponse.isIncharge = user.isIncharge;
            if (user.classInfo) userResponse.classInfo = user.classInfo;
            if (user.sectionInfo) userResponse.sectionInfo = user.sectionInfo;
        }

        return res.status(200).json({
            token,
            user: userResponse
        });
    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: err.message });
    }
};

module.exports = {
    generateOTP,
    calculateOTPExpiry,
    uploadFiles,
    sendOTP,
    verifyOTP,
    resendOTP,
    setPasswordAfterOTP,
    forgotPassword,
    verifyForgotPasswordOTP,
    resetPasswordWithOTP,
    resetPassword,
    resendForgotPasswordOTP,
    toggleUserStatus,
    login
};