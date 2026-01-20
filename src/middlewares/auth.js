const jwt = require("jsonwebtoken");
const User = require("../models/User");
const School = require("../models/School");
const logger = require("../utils/logger");

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try to find user in both collections
    let user = await User.findById(decoded.id).select("-password");
    if (!user) {
      user = await School.findById(decoded.id).select("-password");
    }

    if (!user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error("Protect middleware error:", error);
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};

const isSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "superadmin") {
    return res.status(403).json({ message: "Access denied: SuperAdmin only" });
  }
  next();
};

const isAdminOffice = async (req, res, next) => {
  try {
    const user = req.user;

    if (user.role === "admin_office") {
      if (!user.school) {
        return res.status(400).json({ message: "Admin Office is not linked to any school" });
      }
      return next();
    }

    if (user.verified && user.schoolId) {
      req.user.school = user._id;
      return next();
    }

    return res.status(403).json({ message: "Access denied: Admin Office or School only" });
  } catch (err) {
    console.error("isAdminOffice error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const isTeacher = (req, res, next) => {
  if (!req.user || req.user.role !== "teacher") {
    return res.status(403).json({ message: "Access denied: Teacher only" });
  }
  next();
};

const isStudent = (req, res, next) => {
  if (!req.user || req.user.role !== "student") {
    return res.status(403).json({ message: "Access denied: student only" });
  }
  next();
};

const isTeacherOrStudent = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const allowedRoles = ["student", "teacher"];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied: Students or Teachers only" });
    }

    next();
  } catch (err) {
    console.error("isStudentOrTeacher error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const editProfile = (req, res, next) => {
  try {
    const userId = req.params.id;
    const loggedInUser = req.user;

    if (loggedInUser._id.toString() === userId.toString()) {
      return next();
    }

    if (loggedInUser.role === "admin_office") {
      return next();
    }

    return res.status(403).json({ message: "Access denied: Not allowed to edit this profile" });
  } catch (err) {
    console.error("canEditOwnProfile error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const isAuthorizedUser = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized: No user found" });
    }

    if (user.role === "admin_office") {
      if (!user.school) {
        return res.status(400).json({ message: "Admin Office is not linked to any school" });
      }
      return next();
    }

    if (user.role === "school" && user.verified && user.schoolId) {
      req.user.school = user._id;
      return next();
    }

    if (user.role === "teacher") {
      return next();
    }

    if (user.role === "student") {
      return next();
    }

    return res.status(403).json({ message: "Access denied: Admin Office, School, or Teacher only" });
  } catch (err) {
    console.error("isAuthorizedUser error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const isTeacherOrAdminOfficeOrSchool = (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized user" });
    }

    // 1. ADMIN OFFICE
    if (user.role === "admin_office") {
      if (!user.school) {
        return res.status(400).json({ message: "Admin Office is not linked to any school" });
      }
      req.user.school = user.school;
      return next();
    }

    // 2. TEACHER
    if (user.role === "teacher") {
      if (!user.school) {
        return res.status(400).json({ message: "Teacher is not linked to any school" });
      }
      req.user.school = user.school;
      return next();
    }

    // 3. SCHOOL (NO ROLE, but has verified + schoolId)
    if (user.verified && user.schoolId) {
      req.user.school = user._id; // school _id is the school itself
      return next();
    }

    return res.status(403).json({
      message: "Access denied: Only teacher, admin office, or school can access"
    });

  } catch (err) {
    console.error("Middleware error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const allowedRoles = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized: No user found" });
    }

    if (user.role === "admin_office") {
      if (!user.school) {
        return res.status(400).json({ message: "Admin Office is not linked to any school" });
      }
      req.user.school = user.school;
      return next();
    }

    if (user.role === "teacher") {
      if (!user.school) {
        return res.status(400).json({ message: "Teacher is not linked to any school" });
      }
      req.user.school = user.school;
      return next();
    }

    if (user.role === "student") {
      if (!user.school) {
        return res.status(400).json({ message: "Student is not linked to any school" });
      }
      req.user.school = user.school;
      return next();
    }

    if (user.verified && user.schoolId) {
      req.user.school = user._id;
      return next();
    }
    
    if (user.role === "superadmin") {
      return next();
    }

    if (req.user || req.user.role == "superadmin") {
      next();
    }

    return res.status(403).json({ message: "Access denied: Invalid role" });

  } catch (err) {
    console.error("checkUserRoleAndSchool error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { protect, isSuperAdmin, isAdminOffice, isTeacher, isStudent, isTeacherOrStudent, editProfile, isAuthorizedUser, isTeacherOrAdminOfficeOrSchool, allowedRoles };
