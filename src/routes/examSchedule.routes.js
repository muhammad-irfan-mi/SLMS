const express = require("express");
const router = express.Router();
const { isAdminOffice, protect, isTeacher, isTeacherOrStudent } = require("../middlewares/auth");
const { addExamSchedule, getSchedule, deleteSchedule, getScheduleByTeacher, getScheduleByStudent, updateExamSchedule } = require("../controllers/examSchedule.controller");


router.post("/", protect, isAdminOffice, addExamSchedule);
router.get("/", protect, isAdminOffice, getSchedule);
router.put("/:id", protect, isAdminOffice, updateExamSchedule);
router.delete("/:id", protect, isAdminOffice, deleteSchedule);

router.get("/teacher", protect, isTeacher, getScheduleByTeacher);
router.get("/student", protect, isTeacherOrStudent, getScheduleByStudent);

module.exports = router;
