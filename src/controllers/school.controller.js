const School = require("../models/School");
const emailService = require("../services/email.service");
const otpService = require("../services/otp.service");
const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");
const crypto = require('crypto');
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Student = require("../models/Student");


const addSchoolBySuperAdmin = async (req, res) => {
  try {
    const { name, email, phone, address, remainVideo, cnic, lat, lon, noOfStudents } = req.body;
    const existingSchool = await School.findOne({
      $or: [
        { email },
        {
          name: { $regex: `^${name}$`, $options: "i" },
          verified: true
        }
      ]
    });
    if (existingSchool) {
      if (existingSchool.email === email) {
        return res.status(400).json({
          message: existingSchool.verified
            ? "A school with this email already exists"
            : "A verification is already pending for this email. Please verify the OTP or wait for it to expire."
        });
      }
      if (existingSchool.name.toLowerCase() === name.toLowerCase() && existingSchool.verified) {
        return res.status(400).json({ message: "School name already exists" });
      }
    }

    // const existingByEmail = await School.findOne({ email });
    // if (existingByEmail) {
    //   return res.status(400).json({ message: "A school with this email already exists" });
    // }

    const otpCode = otpService.generateOTP();
    const otpExpiry = otpService.calculateExpiry(10);

    let cnicFront = null, cnicBack = null, nocDoc = null, logo = null;

    if (req.files?.cnicFront?.[0]) {
      const file = req.files.cnicFront[0];
      cnicFront = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
    }

    if (req.files?.cnicBack?.[0]) {
      const file = req.files.cnicBack[0];
      cnicBack = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
    }

    if (req.files?.nocDoc?.[0]) {
      const file = req.files.nocDoc[0];
      nocDoc = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
    }

    if (req.files?.logo?.[0]) {
      const file = req.files.logo[0];
      logo = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
    }

    const tempSchoolId = "SCH-" + Date.now().toString().slice(-6);
    const pendingSchool = await School.findOne({ email, verified: false });

    if (pendingSchool) {
      pendingSchool.tempData = {
        name,
        email,
        phone: phone || null,
        address: address || null,
        cnic: cnic || null,
        images: { cnicFront, cnicBack, nocDoc, logo },
        location: (lat && lon) ? { lat: Number(lat), lon: Number(lon) } : null,
        remainVideo: Number(remainVideo) || 4,
        noOfStudents: Number(noOfStudents) || 0,
      };
      pendingSchool.otp = {
        code: otpCode,
        expiresAt: otpExpiry,
        attempts: 0,
        lastAttempt: new Date()
      };
      await pendingSchool.save();
    } else {
      const newSchool = new School({
        name,
        email,
        phone: phone || null,
        address: address || null,
        cnic: cnic || null,
        images: { cnicFront, cnicBack, nocDoc, logo },
        schoolId: tempSchoolId,
        location: (lat && lon) ? { lat: Number(lat), lon: Number(lon) } : null,
        noOfStudents: Number(noOfStudents) || 0,
        verified: false,
        tempData: {
          name,
          email,
          phone: phone || null,
          address: address || null,
          cnic: cnic || null,
          images: { cnicFront, cnicBack, nocDoc, logo },
          location: (lat && lon) ? { lat: Number(lat), lon: Number(lon) } : null,
          remainVideo: Number(remainVideo) || 4,
          noOfStudents: Number(noOfStudents) || 0,
        },
        otp: {
          code: otpCode,
          expiresAt: otpExpiry,
          attempts: 0,
          lastAttempt: new Date()
        }
      });
      await newSchool.save();
    }

    await emailService.sendOTPEmail(email, otpCode, name);

    return res.status(201).json({
      message: "OTP sent to school email. Please verify to complete registration.",
      email,
      otpExpiry: otpExpiry,
      note: "OTP is valid for 10 minutes"
    });
  } catch (err) {

    return res.status(500).json({
      message: "Server error while adding school",
      error: err.message,
    });
  }
};

const generateSchoolOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const calculateSchoolOTPExpiry = (minutes = 10) => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + minutes);
  return expiry;
};

const schoolForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    const school = await School.findOne({
      email: { $regex: new RegExp(`^${email}$`, 'i') },
      verified: true,
      isDeleted: false
    });

    if (!school) {
      return res.status(404).json({
        message: "School not found with this email"
      });
    }

    // Check if school has password set
    if (!school.password) {
      return res.status(400).json({
        message: "Password not set. Please complete your registration first."
      });
    }

    // Generate OTP
    const otpCode = generateSchoolOTP();
    const otpExpiry = calculateSchoolOTPExpiry(10);

    // Save OTP in school document
    school.forgotPasswordOTP = {
      code: otpCode,
      expiresAt: otpExpiry,
      attempts: 0,
      lastAttempt: new Date(),
      verified: false
    };

    await school.save();

    // Send OTP email
    await emailService.sendSchoolForgotPasswordOTPEmail(
      school.email,
      otpCode,
      school.name
    );

    return res.status(200).json({
      message: "OTP sent to registered email",
      email: school.email,
      otpExpiry: otpExpiry,
      note: "OTP is valid for 10 minutes"
    });

  } catch (err) {
    console.error("School forgot password error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

const verifySchoolForgotPasswordOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required"
      });
    }

    const school = await School.findOne({
      email: { $regex: new RegExp(`^${email}$`, 'i') },
      verified: true,
      isDeleted: false
    });

    if (!school) {
      return res.status(404).json({
        message: "School not found"
      });
    }

    if (!school.forgotPasswordOTP) {
      return res.status(400).json({
        message: "No password reset request found. Please request a new OTP."
      });
    }

    if (school.forgotPasswordOTP.attempts >= 5) {
      return res.status(429).json({
        message: "Too many OTP attempts. Please request a new OTP."
      });
    }

    const isExpired = new Date() > new Date(school.forgotPasswordOTP.expiresAt);
    if (isExpired) {
      school.forgotPasswordOTP.attempts += 1;
      school.forgotPasswordOTP.lastAttempt = new Date();
      await school.save();

      return res.status(400).json({
        message: "OTP has expired. Please request a new OTP.",
        attemptsRemaining: 5 - school.forgotPasswordOTP.attempts
      });
    }

    if (otp !== school.forgotPasswordOTP.code) {
      school.forgotPasswordOTP.attempts += 1;
      school.forgotPasswordOTP.lastAttempt = new Date();
      await school.save();

      return res.status(400).json({
        message: "Invalid OTP",
        attemptsRemaining: 5 - school.forgotPasswordOTP.attempts
      });
    }

    school.forgotPasswordOTP.verified = true;
    await school.save();

    return res.status(200).json({
      message: "OTP verified successfully. You can now reset your password.",
      canResetPassword: true,
      email: school.email
    });

  } catch (err) {
    console.error("Verify school forgot password OTP error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

const schoolResetPasswordWithOTP = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        message: "Email, OTP, and new password are required"
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long"
      });
    }

    const school = await School.findOne({
      email: { $regex: new RegExp(`^${email}$`, 'i') },
      verified: true,
      isDeleted: false
    });

    if (!school) {
      return res.status(404).json({
        message: "School not found"
      });
    }

    if (!school.forgotPasswordOTP || !school.forgotPasswordOTP.verified) {
      return res.status(400).json({
        message: "Please verify OTP first before resetting password."
      });
    }

    if (otp !== school.forgotPasswordOTP.code) {
      return res.status(400).json({
        message: "Invalid OTP"
      });
    }

    const isExpired = new Date() > new Date(school.forgotPasswordOTP.expiresAt);
    if (isExpired) {
      school.forgotPasswordOTP = undefined;
      await school.save();

      return res.status(400).json({
        message: "OTP has expired. Please request a new password reset."
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    school.password = hashedPassword;
    school.forgotPasswordOTP = undefined;
    await school.save();

    // Send password changed notification
    try {
      await emailService.sendSchoolPasswordChangedNotification(
        school.email,
        school.name
      );
    } catch (emailError) {
      console.error('Failed to send password changed notification:', emailError);
    }

    return res.status(200).json({
      message: "Password reset successfully! You can now login."
    });

  } catch (err) {
    console.error("School reset password error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

const resendSchoolForgotPasswordOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    const school = await School.findOne({
      email: { $regex: new RegExp(`^${email}$`, 'i') },
      verified: true,
      isDeleted: false
    });

    if (!school) {
      return res.status(404).json({
        message: "School not found"
      });
    }

    if (!school.forgotPasswordOTP) {
      return res.status(400).json({
        message: "No password reset request found. Please use forgot password first."
      });
    }

    if (school.forgotPasswordOTP.verified) {
      return res.status(400).json({
        message: "OTP already verified. Please reset your password or request a new OTP."
      });
    }

    if (school.forgotPasswordOTP.lastAttempt) {
      const cooldownTime = 60 * 1000;
      const timeSinceLastAttempt = new Date() - new Date(school.forgotPasswordOTP.lastAttempt);

      if (timeSinceLastAttempt < cooldownTime) {
        const waitTime = Math.ceil((cooldownTime - timeSinceLastAttempt) / 1000);
        return res.status(429).json({
          message: `Please wait ${waitTime} seconds before requesting a new OTP`
        });
      }
    }

    const newOTP = generateSchoolOTP();
    const newExpiry = calculateSchoolOTPExpiry(10);

    school.forgotPasswordOTP.code = newOTP;
    school.forgotPasswordOTP.expiresAt = newExpiry;
    school.forgotPasswordOTP.attempts = 0;
    school.forgotPasswordOTP.verified = false;
    school.forgotPasswordOTP.lastAttempt = new Date();
    await school.save();

    try {
      await emailService.sendSchoolForgotPasswordOTPEmail(
        school.email,
        newOTP,
        school.name
      );
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
    }

    return res.status(200).json({
      message: "New OTP sent successfully",
      email: school.email,
      otpExpiry: newExpiry,
      note: "OTP is valid for 10 minutes"
    });

  } catch (err) {
    console.error("Resend school forgot password OTP error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

const verifySchoolOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const school = await School.findOne({ email, verified: false });

    if (!school) {
      return res.status(404).json({
        message: "No pending registration found for this email"
      });
    }

    if (school.otp.attempts >= 5) {
      return res.status(429).json({
        message: "Too many OTP attempts. Please request a new OTP."
      });
    }

    const validation = otpService.validateOTP(
      otp,
      school.otp.code,
      school.otp.expiresAt
    );

    if (!validation.valid) {
      school.otp.attempts += 1;
      school.otp.lastAttempt = new Date();
      await school.save();

      return res.status(400).json({
        message: validation.message,
        attemptsRemaining: 5 - school.otp.attempts
      });
    }

    const finalSchoolId = "SCH-" + crypto.randomBytes(3).toString('hex').toUpperCase();

    school.name = school.tempData.name;
    school.email = school.tempData.email;
    school.phone = school.tempData.phone;
    school.address = school.tempData.address;
    school.cnic = school.tempData.cnic;
    school.images = school.tempData.images;
    school.location = school.tempData.location;
    school.noOfStudents = school.tempData.noOfStudents;
    school.schoolId = finalSchoolId;
    school.verified = true;
    school.otp = undefined;
    school.tempData = undefined;

    await school.save();

    // Send password setup email
    // await emailService.sendPasswordSetupEmail(email, school.name, finalSchoolId);

    return res.status(200).json({
      message: "School verified successfully! Password setup link sent to email.",
      school: {
        id: school._id,
        name: school.name,
        email: school.email,
        schoolId: finalSchoolId,
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

const resendSchoolOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const school = await School.findOne({ email, verified: false });

    if (!school) {
      return res.status(404).json({
        message: "No pending registration found for this email"
      });
    }

    if (!otpService.canResendOTP(school.otp.lastAttempt)) {
      const waitTime = Math.ceil((new Date(school.otp.lastAttempt.getTime() + 60000) - new Date()) / 1000);
      return res.status(429).json({
        message: `Please wait ${waitTime} seconds before requesting a new OTP`
      });
    }

    const newOTP = otpService.generateOTP();
    const newExpiry = otpService.calculateExpiry(10);

    school.otp.code = newOTP;
    school.otp.expiresAt = newExpiry;
    school.otp.attempts = 0;
    school.otp.lastAttempt = new Date();
    await school.save();

    await emailService.sendOTPEmail(email, newOTP, school.tempData.name);

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

const setSchoolPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    const school = await School.findOne({ email, verified: true, password: { $exists: false } });

    if (!school) {
      return res.status(404).json({
        message: "School not found or not verified"
      });
    }

    if (school.password) {
      return res.status(400).json({
        message: "Password already set. Please use login instead."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    school.password = hashedPassword;
    await school.save();

    return res.status(200).json({
      message: "Password set successfully. You can now login.",
      school: {
        id: school._id,
        name: school.name,
        email: school.email,
        schoolId: school.schoolId,
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

const editSchoolBySuperAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const school = await School.findById(id);
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    if (updates.name && updates.name !== school.name) {
      const existingByName = await School.findOne({
        name: { $regex: `^${updates.name}$`, $options: "i" },
        _id: { $ne: id }
      });
      if (existingByName) {
        return res.status(400).json({ message: "School name already exists" });
      }
      school.name = updates.name;
    }

    if (updates.email && updates.email !== school.email) {
      const existingByEmail = await School.findOne({
        email: updates.email,
        _id: { $ne: id }
      });
      if (existingByEmail) {
        return res.status(400).json({ message: "A school with this email already exists" });
      }
      school.email = updates.email;
    }

    if (updates.phone !== undefined) school.phone = updates.phone || null;
    if (updates.address !== undefined) school.address = updates.address || null;
    if (updates.cnic !== undefined) school.cnic = updates.cnic || null;
    if (updates.remainVideo !== undefined) {
      const additionalVideos = Number(updates.remainVideo);
      if (!isNaN(additionalVideos) && additionalVideos > 0) {
        school.remainVideo += additionalVideos;
      } else if (additionalVideos < 0) {
        return res.status(400).json({
          message: "Cannot subtract videos. Use positive numbers only."
        });
      }
    } if (updates.noOfStudents !== undefined) school.noOfStudents = Number(updates.noOfStudents) || 0;

    if (updates.lat !== undefined) school.location.lat = Number(updates.lat) || null;
    if (updates.lon !== undefined) school.location.lon = Number(updates.lon) || null;

    if (req.files?.cnicFront?.[0]) {
      if (school.images?.cnicFront) {
        await deleteFileFromS3(school.images.cnicFront);
      }
      const file = req.files.cnicFront[0];
      school.images.cnicFront = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
    }

    if (req.files?.cnicBack?.[0]) {
      if (school.images?.cnicBack) {
        await deleteFileFromS3(school.images.cnicBack);
      }
      const file = req.files.cnicBack[0];
      school.images.cnicBack = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
    }

    if (req.files?.nocDoc?.[0]) {
      if (school.images?.nocDoc) {
        await deleteFileFromS3(school.images.nocDoc);
      }
      const file = req.files.nocDoc[0];
      school.images.nocDoc = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
    }

    if (req.files?.logo?.[0]) {
      if (school.images?.logo) {
        await deleteFileFromS3(school.images.logo);
      }
      const file = req.files.logo[0];
      school.images.logo = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
    }

    await school.save();

    return res.status(200).json({
      message: "School updated successfully",
      school: {
        id: school._id,
        name: school.name,
        email: school.email,
        schoolId: school.schoolId,
        verified: school.verified,
        remainVideo: school.remainVideo,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error while updating school",
      error: err.message,
    });
  }
};

const deleteSchoolBySuperAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const school = await School.findById(id);

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    if (school.isDeleted) {
      return res.status(400).json({ message: "School already deleted" });
    }

    school.isDeleted = true;
    school.deletedAt = new Date();
    school.tokenVersion += 1;

    await school.save();

    return res.status(200).json({
      message: "School deleted successfully",
      school: {
        _id: school._id,
        name: school.name,
        isDeleted: school.isDeleted,
        deletedAt: school.deletedAt
      }
    });
  } catch (err) {
    console.error("Error deleting school:", err);
    return res.status(500).json({
      message: "Server error while deleting school",
      error: err.message,
    });
  }
};

const restoreSchoolBySuperAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const school = await School.findById(id);

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    if (!school.isDeleted) {
      return res.status(400).json({ message: "School is already active" });
    }

    school.isDeleted = false;
    school.deletedAt = null;

    school.tokenVersion += 1;

    await school.save();

    return res.status(200).json({
      message: "School restored successfully",
      school: {
        _id: school._id,
        name: school.name,
        isDeleted: school.isDeleted,
        deletedAt: school.deletedAt
      }
    });
  } catch (err) {
    console.error("Error restoring school:", err);
    return res.status(500).json({
      message: "Server error while restoring school",
      error: err.message,
    });
  }
};

const getAllSchools = async (req, res) => {
  try {
    let { page = 1, limit = 20 } = req.query;

    page = Number(page) || 1;
    limit = Number(limit) || 20;
    const skip = (page - 1) * limit;

    const total = await School.countDocuments();
    const schools = await School.find()
      .select("-password -otp -noOfStudents")
      .skip(skip)
      .limit(limit)
      .lean();

    const schoolData = await Promise.all(
      schools.map(async (school) => {
        const activeStudentsCount = await Student.countDocuments({
          school: school._id,
          // role: 'student',
          isActive: true
        });

        return {
          ...school,
          noOfStudents: activeStudentsCount,
        };
      })
    );

    return res.status(200).json({
      message: "All schools fetched successfully",
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      count: schools.length,
      schools: schoolData,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error while fetching schools",
      error: err.message,
    });
  }
};

const getPendingRegistrations = async (req, res) => {
  try {
    const pendingSchools = await School.find({ verified: false })
      .select("name email createdAt otp.expiresAt tempData.phone tempData.address")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Pending registrations fetched successfully",
      count: pendingSchools.length,
      pendingSchools,
    });
  } catch (err) {
    console.error("Error fetching pending registrations:", err);
    return res.status(500).json({
      message: "Server error while fetching pending registrations",
      error: err.message,
    });
  }
};

const getSchoolById = async (req, res) => {
  try {
    const { id } = req.params;
    const school = await School.findById(id).select("-password -otp -noOfStudents").lean();

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const activeStudentsCount = await Student.countDocuments({
      school: school._id,
      // role: 'student',
      isActive: true
    });

    return res.status(200).json({
      message: "School fetched successfully",
      school: {
        ...school,
        noOfStudents: activeStudentsCount
      }
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error while fetching school",
      error: err.message,
    });
  }
};

const updateSchoolLogo = async (req, res) => {
  try {
    const schoolId = req.params.id;
    const school = await School.findById(schoolId);

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const isSchoolOwner = String(school._id) === String(req.user.school);
    console.log("Is School Owner:", isSchoolOwner);

    if (!isSchoolOwner) {
      return res.status(403).json({
        message: "You don't have permission to update this school's logo"
      });
    }

    if (!req.files?.logo?.[0]) {
      return res.status(400).json({ message: "No logo file provided" });
    }

    if (req.files?.logo?.[0]) {
      if (school.images?.logo) {
        await deleteFileFromS3(school.images.logo);
      }
      const file = req.files.logo[0];
      school.images.logo = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
    }

    school.logo = school.images.logo;
    await school.save();

    return res.status(200).json({
      message: "School logo updated successfully",
      logo: school.images.logo
    });

  } catch (err) {
    return res.status(500).json({
      message: "Server error while updating school logo",
      error: err.message,
    });
  }
};


module.exports = {
  addSchoolBySuperAdmin,
  schoolForgotPassword,
  verifySchoolForgotPasswordOTP,
  schoolResetPasswordWithOTP,
  resendSchoolForgotPasswordOTP,
  verifySchoolOTP,
  resendSchoolOTP,
  setSchoolPassword,
  deleteSchoolBySuperAdmin,
  restoreSchoolBySuperAdmin,
  editSchoolBySuperAdmin,
  getAllSchools,
  getSchoolById,
  getPendingRegistrations,
  updateSchoolLogo
};