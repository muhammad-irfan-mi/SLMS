const ServicePermission = require("../models/ServicePermission");

const staticServices = [
    {
        key: "student",
        name: "Student Management",
        description: "Manage student profiles, enrollment, and records",
        dependencies: ["classSection"],
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
        dependencies: ["student", "classSection", "bankAccount"],
        isActive: true
    },
    {
        key: "examSchedule",
        name: "Exam Schedule",
        description: "Manage exam schedules",
        dependencies: ["schedule", "subject", "classSection", "staff", "Notice", "student"],
        isActive: true
    },
    {
        key: "bankAccount",
        name: "Bank Account Management",
        description: "Manage bank accounts for financial transactions",
        dependencies: [],
        isActive: true
    },
    {
        key: "complaintFeedback",
        name: "Complaint & Feedback",
        description: "Manage student and parent complaints and feedback",
        dependencies: ["student", "staff"],
        isActive: true
    },
    {
        key: "dialyIslamicAttendance",
        name: "Daily Islamic Attendance",
        description: "Track daily Islamic attendance",
        dependencies: ["student", "classSection"],
        isActive: true
    },
    {
        key: "diary",
        name: "Diary",
        description: "Manage daily entries and notes",
        dependencies: ["student", "classSection", "subject", "schedule"],
        isActive: true
    },
    {
        key: "event",
        name: "Event Management",
        description: "Manage school events and activities",
        dependencies: [],
        isActive: true
    },
    {
        key: "leave",
        name: "Leave Management",
        description: "Manage leave requests and approvals",
        dependencies: ["staff", "student", "classSection"],
        isActive: true
    },
    {
        key: "notice",
        name: "Notice Management",
        description: "Manage school notices and announcements",
        dependencies: ["student", "staff", "classSection"],
        isActive: true
    },
    {
        key: "project",
        name: "Project Management",
        description: "Manage school projects and initiatives",
        dependencies: ["student", "staff", "classSection", "subject", "schedule"],
        isActive: true
    },
    {
        key: "quiz",
        name: "Quiz Management",
        description: "Manage quizzes and assessments",
        dependencies: ["schedule", "classSection"],
        isActive: true
    },
    {
        key: "result",
        name: "Result Management",
        description: "Manage quiz and exam results",
        dependencies: ["staff", "student", "classSection"],
        isActive: true
    },
    {
        key: "salary",
        name: "Salary Management",
        description: "Manage staff salaries and compensation",
        dependencies: ["staff"],
        isActive: true
    },
    {
        key: "socialMedia",
        name: "Social Media Management",
        description: "Manage school's social media presence",
        dependencies: [],
        isActive: true
    },
    {
        key: "slider",
        name: "Slider Management",
        description: "Manage slider images for the website",
        dependencies: [],
        isActive: true
    },
    {
        key: "studentDocument",
        name: "Student Document Management",
        description: "Manage student documents and records",
        dependencies: ["student", "classSection", "staff"],
        isActive: true
    },
    {
        key: "syllabus",
        name: "Syllabus Management",
        description: "Manage academic syllabi and course outlines",
        dependencies: ["subject", "classSection", "staff", "schedule"],
        isActive: true
    },
    {
        key: "aiYusha",
        name: "AI Yusha",
        description: "AI-powered educational assistant",
        dependencies: [],
        isActive: true
    },
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