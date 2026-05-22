const express = require("express");
const router = express.Router();
const { getRecords, getStudentRecords, deleteRecord, createDialyRecord } = require("../controllers/dailyIslamicAttendance.controller");
const { protect, isStudent, isTeacherOrAdminOfficeOrSchool, isAdminOffice } = require("../middlewares/auth");
const { checkPermission } = require("../middlewares/permission");


router.post("/", protect, isStudent,checkPermission("dailyislamicattendance"), createDialyRecord);
router.post("/admin", protect, isTeacherOrAdminOfficeOrSchool, checkPermission("dailyislamicattendance"), createDialyRecord);
router.get("/", protect, isTeacherOrAdminOfficeOrSchool, checkPermission("dailyislamicattendance"), getRecords);
router.get("/student", protect, isStudent, checkPermission("dailyislamicattendance"), getStudentRecords);
router.delete("/:id", protect, isAdminOffice, checkPermission("dailyislamicattendance"), deleteRecord);

module.exports = router;