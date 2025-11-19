const express = require("express");
const router = express.Router();
const { protect, isTeacherOrAdminOfficeOrSchool, isStudent } = require("../middleware/auth");
const { createNotice, getNoticesForStudent, updateNotice, deleteNotice } = require("../controllers/noticeController");

router.post("/", protect, isTeacherOrAdminOfficeOrSchool, createNotice);
router.get("/teacher", protect, isTeacherOrAdminOfficeOrSchool, getNoticesForTeacher);
router.get("/student", protect, isStudent, getNoticesForStudent);
router.put("/:id", protect, isTeacherOrAdminOfficeOrSchool, updateNotice);
router.delete("/:id", protect, isTeacherOrAdminOfficeOrSchool, deleteNotice);

module.exports = router;
