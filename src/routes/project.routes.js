const express = require("express");
const router = express.Router();
const {protect, isTeacherOrAdminOfficeOrSchool, isStudent} = require('../middlewares/auth')
const { createProject, getProjectsForTeacher, updateProject, deleteProject, getProjectsForStudent } = require("../controllers/projectController");

router.post("/", protect, isTeacherOrAdminOfficeOrSchool, createProject);
router.get("/teacher", protect, isTeacherOrAdminOfficeOrSchool, getProjectsForTeacher);
router.get("/student", protect, isStudent, getProjectsForStudent);
router.patch("/:id", protect, isTeacherOrAdminOfficeOrSchool, updateProject);
router.delete("/:id", protect, isTeacherOrAdminOfficeOrSchool, deleteProject);

module.exports = router;
