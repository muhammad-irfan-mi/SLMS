const express = require("express");
const { protect, isTeacher } = require("../middlewares/auth");
const {
    markAttendance,
    updateAttendance,
    getAttendanceBySection,
    getAttendanceByStudent,
    getAttendanceByDateOrRange,
} = require("../controllers/attendance.controller");

const router = express.Router();

router.post("/", protect, isTeacher, markAttendance);
router.patch("/:attendanceId", protect, isTeacher, updateAttendance);
router.get("/section/:sectionId", protect, isTeacher, getAttendanceBySection);
router.get("/student/:studentId", protect, isTeacher, getAttendanceByStudent);
router.get("/section/:sectionId/date", protect, isTeacher, getAttendanceByDateOrRange);


module.exports = router;
