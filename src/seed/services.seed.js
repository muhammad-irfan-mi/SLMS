const ServicePermission = require("../models/ServicePermission");

const staticServices = [
  {
    key: "student",
    name: "Student Management",
    description: "Manage student profiles, enrollment, and records",
    dependencies: [],
    isActive: true
  },
  {
    key: "staff",
    name: "Staff Management",
    description: "Manage staff profiles and assignments",
    dependencies: [],
    isActive: true
  },
  {
    key: "classSection",
    name: "Class & Section",
    description: "Manage classes and sections",
    dependencies: [],
    isActive: true
  },
  {
    key: "subject",
    name: "Subject Management",
    description: "Manage subjects and curriculum",
    dependencies: ["classSection"],
    isActive: true
  },
  {
    key: "schedule",
    name: "Schedule/Timetable",
    description: "Manage class schedules",
    dependencies: ["staff", "classSection", "subject"],
    isActive: true
  },
  {
    key: "attendance",
    name: "Attendance",
    description: "Track student and teacher attendance",
    dependencies: ["student", "classSection", "staff"],
    isActive: true
  },
  {
    key: "fees",
    name: "Fee Management",
    description: "Manage student fees and invoices",
    dependencies: ["student", "classSection"],
    isActive: true
  },
  {
    key: "exam",
    name: "Exam Management",
    description: "Manage exams and results",
    dependencies: ["schedule", "subject", "classSection"],
    isActive: true
  }
];

async function seedServices() {
  try {
    for (const service of staticServices) {
      await ServicePermission.findOneAndUpdate(
        { key: service.key },
        service,
        { upsert: true, new: true }
      );
    }
    console.log("Services seeded successfully");
  } catch (error) {
    console.error("Error seeding services:", error);
  }
}

module.exports = seedServices;