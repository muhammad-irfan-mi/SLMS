const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const fs = require("fs");

const User = require("../../models/User");
const School = require("../../models/School");

const MONGO_URI = "mongodb://127.0.0.1:27017/schoolauth";

async function seedUsers() {
    await mongoose.connect(MONGO_URI, { maxPoolSize: 50 });
    console.log("✅ DB connected");

    // 1️⃣ Find any existing school
    let school = await School.findOne();

    // 2️⃣ If no school exists, create a dummy school
    if (!school) {
        school = await School.create({
            schoolId: "LOAD_TEST_SCHOOL_001",
            name: "Load Test School",
            email: "loadtestschool@example.com",
            phone: "03000000000",
            address: "Load Test Address"
        });

        console.log("🏫 Dummy school created");
    } else {
        console.log("🏫 Existing school reused:", school.name);
    }

    // 3️⃣ Remove previous load-test users
    await User.deleteMany({ email: /loadtest\d+@student.com/ });

    // 4️⃣ Create 200 student users
    const users = [];
    for (let i = 1; i <= 200; i++) {
        users.push({
            name: `Load Student ${i}`,
            email: `loadtest${i}@student.com`,
            role: "student",
            school: school._id,
            verified: true,
            password: await bcrypt.hash("123456", 10),
            classInfo: { name: "Load Class" },
            sectionInfo: { name: "A" },
        });
    }

    const insertedUsers = await User.insertMany(users);
    console.log("✅ 200 load-test students created");

    // 5️⃣ Export users for load testing
    const usersForLoadTest = insertedUsers.map(u => ({
        email: u.email,
        password: "123456" // default password used in load test
    }));

    fs.writeFileSync("src/load-tests/users.json", JSON.stringify(usersForLoadTest, null, 2));
    console.log("✅ Users exported for load test");

    process.exit(0);
}

seedUsers().catch(err => {
    console.error("❌ Seeder failed:", err.message);
    process.exit(1);
});
