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

module.exports = { protect, isSuperAdmin, isAdminOffice, isTeacher };
