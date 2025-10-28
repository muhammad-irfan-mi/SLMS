const express = require("express");
const { protect, isTeacher, isTeacherOrStudent } = require("../middlewares/auth");
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
router.patch("/:attendanceId", protect, isTeacher, updateAttendance);
router.get("/section/:sectionId", protect, isTeacher, getAttendanceBySection);
router.get("/student/:studentId", protect, isTeacherOrStudent, getAttendanceByStudent);
router.get("/section/:sectionId/date", protect, isTeacher, getAttendanceByDateOrRange);
router.get("/student/:studentId/date", protect, isTeacherOrStudent, getStudentAttendanceByDateOrRange);


module.exports = router;
