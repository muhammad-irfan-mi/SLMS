const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const connectDB = require("../config/db");

dotenv.config();

const seedSuperAdmin = async () => {
  await connectDB(process.env.MONGO_URL || 'mongodb://localhost:27017/schoolauth');

  const exists = await User.findOne({ role: "superadmin" });
  if (exists) {
    console.log("SuperAdmin already exists:", exists.email);
    return;
  }

  const hashedPassword = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 10);
  await User.create({
    name: "System SuperAdmin",
    email: process.env.SUPERADMIN_EMAIL,
    password: hashedPassword,
    role: "superadmin",
  });

  console.log("SuperAdmin created successfully");
};

module.exports = seedSuperAdmin;
