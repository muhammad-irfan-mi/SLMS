const express = require("express");
const router = express.Router();
const { getRecords, getStudentRecords, deleteRecord, createDialyRecord } = require("../controllers/dailyIslamicAttendance.controller");
const { protect, isStudent, isTeacherOrAdminOfficeOrSchool, isAdminOffice } = require("../middlewares/auth");


router.post("/", protect, isStudent, createDialyRecord);
router.post("/admin", protect, isTeacherOrAdminOfficeOrSchool, createDialyRecord);
router.get("/", protect, isTeacherOrAdminOfficeOrSchool, getRecords);
router.get("/student", protect, isStudent, getStudentRecords);
router.delete("/:id", protect, isAdminOffice, deleteRecord);

module.exports = router;