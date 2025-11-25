const express = require("express");
const { applyLeave, cancelLeave, getLeaves, getLeavesByStudent, approveLeave, rejectLeave, applyTeacherLeave, getTeacherLeaves, updateTeacherLeave, cancelTeacherLeave, approveTeacherLeave, rejectTeacherLeave } = require("../controllers/leaveController");
const { isAdminOffice, protect, isStudent, isTeacher, isTeacherOrAdminOfficeOrSchool } = require("../middlewares/auth");
const router = express.Router();



router.post("/apply", protect, isStudent, applyLeave);
router.post("/:id/cancel", protect, isStudent, cancelLeave);
router.get("/", protect, isTeacherOrAdminOfficeOrSchool, getLeaves); // teacher/admin: filter by class/section/status/query params
router.get("/student/:studentId", protect, isStudent, getLeavesByStudent);
router.post("/:id/approve", protect, isTeacherOrAdminOfficeOrSchool, approveLeave);
router.post("/:id/reject", protect, isTeacherOrAdminOfficeOrSchool, rejectLeave);



router.post("/teacher/apply", protect, isTeacher, applyTeacherLeave);
router.get("/teacher/all", protect, isTeacher, getTeacherLeaves);
router.put("/teacher/update/:id", protect, isTeacher, updateTeacherLeave);
router.post("/teacher/cancel/:id", protect, isTeacher, cancelTeacherLeave);

// Admin actions
router.post("/teacher/approve/:id", protect, isAdminOffice, approveTeacherLeave);
router.post("/teacher/reject/:id", protect, isAdminOffice, rejectTeacherLeave);


module.exports = router;