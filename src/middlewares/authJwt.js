const jwt = require("jsonwebtoken");
const School = require("../models/School");
const User = require("../models/User");

const authJwt = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === "school") {
      const school = await School.findById(decoded.id);
      if (!school) return res.status(404).json({ message: "School not found" });
      req.user = { id: school._id, type: "school", school };
    } else if (decoded.type === "employee") {
      const employee = await User.findById(decoded.id).populate("school");
      if (!employee) return res.status(404).json({ message: "Employee not found" });
      req.user = { id: employee._id, type: "employee", school: employee.school, employee };
    } else {
      return res.status(401).json({ message: "Invalid token type" });
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token", error: err.message });
  }
};

module.exports = { authJwt };
