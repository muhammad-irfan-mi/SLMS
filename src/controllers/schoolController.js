const School = require("../models/School");
const emailService = require("../services/email.service");
const otpService = require("../services/otp.service");
const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");
const crypto = require('crypto');
const bcrypt = require("bcryptjs");


const addSchoolBySuperAdmin = async (req, res) => {
  try {
    const { name, email, phone, address, cnic, lat, lon, noOfStudents } = req.body;
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

    let cnicFront = null, cnicBack = null, nocDoc = null;

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

    const tempSchoolId = "SCH-" + Date.now().toString().slice(-6);
    const pendingSchool = await School.findOne({ email, verified: false });

    if (pendingSchool) {
      pendingSchool.tempData = {
        name,
        email,
        phone: phone || null,
        address: address || null,
        cnic: cnic || null,
        images: { cnicFront, cnicBack, nocDoc },
        location: (lat && lon) ? { lat: Number(lat), lon: Number(lon) } : null,
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
        images: { cnicFront, cnicBack, nocDoc },
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
          images: { cnicFront, cnicBack, nocDoc },
          location: (lat && lon) ? { lat: Number(lat), lon: Number(lon) } : null,
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
    console.error("Error adding school:", err);

    try {
    } catch (cleanupError) {
      console.error("Error cleaning up files:", cleanupError);
    }

    return res.status(500).json({
      message: "Server error while adding school",
      error: err.message,
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
    if (updates.noOfStudents !== undefined) school.noOfStudents = Number(updates.noOfStudents) || 0;

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

    await school.save();

    return res.status(200).json({
      message: "School updated successfully",
      school: {
        id: school._id,
        name: school.name,
        email: school.email,
        schoolId: school.schoolId,
        verified: school.verified,
      },
    });
  } catch (err) {
    console.error("Error updating school:", err);
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

const getAllSchools = async (req, res) => {
  try {
    let { page = 1, limit = 20 } = req.query;

    page = Number(page) || 1;
    limit = Number(limit) || 20;
    const skip = (page - 1) * limit;

    const total = await School.countDocuments();
    const schools = await School.find()
      .select("-password -otp")
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      message: "All schools fetched successfully",
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      count: schools.length,
      schools,
    });
  } catch (err) {
    console.error("Error fetching schools:", err);
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
    const school = await School.findById(id).select("-password -otp");

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    return res.status(200).json({
      message: "School fetched successfully",
      school,
    });
  } catch (err) {
    console.error("Error fetching school:", err);
    return res.status(500).json({
      message: "Server error while fetching school",
      error: err.message,
    });
  }
};

module.exports = {
  addSchoolBySuperAdmin,
  verifySchoolOTP,
  resendSchoolOTP,
  setSchoolPassword,
  deleteSchoolBySuperAdmin,
  editSchoolBySuperAdmin,
  getAllSchools,
  getSchoolById,
  getPendingRegistrations
};