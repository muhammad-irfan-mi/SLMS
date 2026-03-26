const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
// const User = require("../models/User");
const connectDB = require("../config/db");
const Staff = require("../models/Staff");

dotenv.config();

const seedSuperAdmin = async () => {
  await connectDB(process.env.MONGO_URL || 'mongodb://localhost:27017/schoolauth');

  const exists = await Staff.findOne({ role: "superadmin" });
  if (exists) {
    console.log("SuperAdmin already exists:", );
    return;
  }

  const hashedPassword = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 10);
  await Staff.create({
    name: "System SuperAdmin",
    email: process.env.SUPERADMIN_EMAIL,
    password: hashedPassword,
    role: "superadmin",
  });

  console.log("SuperAdmin created successfully");
};

module.exports = seedSuperAdmin;
