const express = require("express");
const { protect, isTeacher, isTeacherOrStudent, isTeacherOrAdminOfficeOrSchool, allowedRoles } = require("../middlewares/auth");
const {
    markAttendance,
    updateAttendance,
    getAttendanceBySection,
    getAttendanceByStudent,
    getAttendanceByDateOrRange,
    getStudentAttendanceByDateOrRange,
} = require("../controllers/attendance.controller");

const router = express.Router();

router.post("/", protect, isTeacher, markAttendance);
router.patch("/:attendanceId", protect, isTeacherOrAdminOfficeOrSchool, updateAttendance);
router.get("/section/:sectionId", protect, isTeacherOrAdminOfficeOrSchool, getAttendanceBySection);
router.get("/student/:studentId", protect, allowedRoles, getAttendanceByStudent);
router.get("/section/:sectionId/date", protect, isTeacherOrAdminOfficeOrSchool, getAttendanceByDateOrRange);
router.get("/student/:studentId/date", protect, isTeacherOrStudent, getStudentAttendanceByDateOrRange);


module.exports = router;
