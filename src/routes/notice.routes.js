const express = require("express");
const router = express.Router();
const { createNotice, getNoticesForStudent, updateNotice, deleteNotice, getNoticesForTeacher } = require("../controllers/noticeController");
const { isTeacherOrAdminOfficeOrSchool, protect, isStudent } = require("../middlewares/auth");

router.post("/", protect, isTeacherOrAdminOfficeOrSchool, createNotice);
router.get("/teacher", protect, isTeacherOrAdminOfficeOrSchool, getNoticesForTeacher);
router.get("/student", protect, isStudent, getNoticesForStudent);
router.put("/:id", protect, isTeacherOrAdminOfficeOrSchool, updateNotice);
router.delete("/:id", protect, isTeacherOrAdminOfficeOrSchool, deleteNotice);

module.exports = router;
