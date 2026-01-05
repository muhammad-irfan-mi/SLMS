const School = require("../models/School");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { validationSchemas } = require("../validators/school.validation");

const superAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email, role: "superadmin" });
    if (!user)
      return res.status(404).json({ message: "SuperAdmin not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "SuperAdmin login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

const setPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    const school = await School.findOne({ email });
    if (!school) return res.status(404).json({ message: "School not found" });

    const hashedPassword = await bcrypt.hash(password, 10);
    school.password = hashedPassword;
    school.verified = true;
    await school.save();

    res.status(200).json({
      message: "Password set successfully. You can now log in.",
    });
  } catch (err) {
    console.error("Error setting password:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const schoolLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const school = await School.findOne({ email });
    if (!school) return res.status(404).json({ message: "School not found" });
    if (!school.verified)
      return res.status(401).json({ message: "Please set your password first." });

    const validPass = await bcrypt.compare(password, school.password);
    if (!validPass) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign(
      { id: school._id, role: "school" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      school: {
        id: school._id,
        name: school.name,
        email: school.email,
        schoolId: school.schoolId,
      },
    });
  } catch (err) {
    console.error("Error logging in:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const setPasswordForStudent = async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({
        message: "Please provide email, username, and password"
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      role: "student"
    });

    if (!user) {
      return res.status(404).json({
        message: "Student not found. Please check email and username."
      });
    }

    if (!user.verified) {
      return res.status(400).json({
        message: "Please verify OTP first before setting password."
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

    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        school: user.school
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: `Password set successfully for student ${user.name}`,
      token: token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        school: user.school,
        classInfo: user.classInfo,
        sectionInfo: user.sectionInfo
      }
    });
  } catch (err) {
    console.error("Error setting student password:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

const setPasswordForStaff = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Please provide email and password"
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      role: { $in: ["teacher", "admin_office", "superadmin"] }
    });

    if (!user) {
      return res.status(404).json({
        message: "Staff member not found. Please check email."
      });
    }

    if (!user.verified) {
      return res.status(400).json({
        message: "Please verify OTP first before setting password."
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

    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        school: user.school
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: `Password set successfully for ${user.role} ${user.name}`,
      token: token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        school: user.school,
        isIncharge: user.isIncharge,
        ...(user.classInfo?.id && { classInfo: user.classInfo })
      }
    });
  } catch (err) {
    console.error("Error setting staff password:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

const staffLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required for staff login"
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      role: { $in: ["teacher", "admin_office", "superadmin"] }
    });

    if (!user) {
      return res.status(404).json({
        message: "Staff member not found"
      });
    }

    if (!user.verified) {
      return res.status(401).json({
        message: "Please verify OTP and set password first",
        needsVerification: true
      });
    }

    if (!user.password) {
      return res.status(401).json({
        message: "Please set your password first",
        needsPassword: true
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        school: user.school
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        school: user.school,
        isIncharge: user.isIncharge,
        ...(user.classInfo?.id && { classInfo: user.classInfo })
      }
    });
  } catch (err) {
    console.error("Error in staff login:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

const studentLogin = async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username) {
      return res.status(400).json({
        message: "Both email and username are required for student login"
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      role: "student"
    });

    if (!user) {
      return res.status(404).json({
        message: "Student not found with provided email and username combination"
      });
    }

    if (!user.verified) {
      return res.status(401).json({
        message: "Please verify OTP and set password first",
        needsVerification: true
      });
    }

    if (!user.password) {
      return res.status(401).json({
        message: "Please set your password first",
        needsPassword: true
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        school: user.school
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        school: user.school,
        classInfo: user.classInfo,
        sectionInfo: user.sectionInfo,
        rollNo: user.rollNo
      }
    });
  } catch (err) {
    console.error("Error in student login:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};


module.exports = {
  superAdminLogin,
  setPassword,
  schoolLogin,
  // setPasswordForUser,
  setPasswordForStudent,
  setPasswordForStaff,
  // userLogin
  staffLogin,
  studentLogin
};