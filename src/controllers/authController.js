const School = require("../models/School");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { validateEmail, validatePassword } = require("../validators/common.validation");

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

// Password policy: 8+ chars, 1 uppercase, 1 number, 1 special
const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const setPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json({ message: emailError });

    const passError = validatePassword(password);
    if (passError) return res.status(400).json({ message: passError });

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

const setPasswordForUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (validateEmail(email))
      return res.status(400).json({ message: validateEmail(email) });

    const passError = validatePassword(password);
    if (passError) return res.status(400).json({ message: passError });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "User not found" });

    // if (user.verified)
    //   return res.status(400).json({ message: "Password already set, please login instead." });

    const hashedPassword = await bcrypt.hash(password, 8);
    user.password = hashedPassword;
    user.verified = true;
    await user.save();

    return res.status(200).json({
      message: "Password set successfully. You can now log in.",
    });
  } catch (err) {
    console.error("Error setting user password:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const userLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "User not found" });

    if (!user.verified)
      return res.status(401).json({ message: "Please set your password first." });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
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
      },
    });
  } catch (err) {
    console.error("Error logging in user:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = { superAdminLogin, setPassword, schoolLogin, setPasswordForUser, userLogin };

