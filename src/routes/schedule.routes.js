const express = require("express");
const router = express.Router();
const { isAdminOffice, protect, isTeacher } = require("../middlewares/auth");
const { addSchedule, getSchedule, updateSchedule, deleteSchedule, getScheduleByTeacher, getScheduleByStudent } = require("../controllers/schedule.Controller");


router.post("/", protect, isAdminOffice, addSchedule);
router.get("/", protect, isAdminOffice, getSchedule);
router.put("/:id", protect, isAdminOffice, updateSchedule);
router.delete("/:id", protect, isAdminOffice, deleteSchedule);

router.get("/teacher", protect, isTeacher, getScheduleByTeacher);
router.get("/student", protect, getScheduleByStudent);

module.exports = router;
