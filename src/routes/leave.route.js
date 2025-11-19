const express = require("express");
const { applyLeave, cancelLeave, getLeaves, getLeavesByStudent, approveLeave, rejectLeave } = require("../controllers/leaveController");
const { isAdminOffice, protect, isStudent, isTeacher, isTeacherOrAdminOfficeOrSchool } = require("../middlewares/auth");
const router = express.Router();



router.post("/apply", protect, isStudent, applyLeave);
router.post("/:id/cancel", protect, isStudent, cancelLeave);
router.get("/", protect, isTeacherOrAdminOfficeOrSchool, getLeaves); // teacher/admin: filter by class/section/status/query params
router.get("/student/:studentId", protect, isStudent, getLeavesByStudent);
router.post("/:id/approve", protect, isTeacherOrAdminOfficeOrSchool, approveLeave);
router.post("/:id/reject", protect, isTeacherOrAdminOfficeOrSchool, rejectLeave);


module.exports = router;