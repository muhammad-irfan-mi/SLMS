const express = require("express");
const router = express.Router();
const { protect, isTeacherOrAdminOfficeOrSchool, isStudent } = require('../middlewares/auth')
const { createProject, getProjectsForTeacher, updateProject, deleteProject, getProjectsForStudent } = require("../controllers/projectController");
const { upload } = require("../utils/multer");

router.post(
    "/", protect, isTeacherOrAdminOfficeOrSchool,
    upload.fields([{ name: "images", maxCount: 2 }, { name: "pdf", maxCount: 1 }]),
    createProject
);

router.get("/teacher", protect, isTeacherOrAdminOfficeOrSchool, getProjectsForTeacher);
router.get("/student", protect, isStudent, getProjectsForStudent);
router.patch(
    "/:id", protect, isTeacherOrAdminOfficeOrSchool,
    upload.fields([{ name: "images", maxCount: 2 }, { name: "pdf", maxCount: 1 }]),
    updateProject
);
router.delete("/:id", protect, isTeacherOrAdminOfficeOrSchool, deleteProject);

module.exports = router;
