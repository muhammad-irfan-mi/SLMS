const express = require("express");
const router = express.Router();
const { protect, isTeacherOrAdminOfficeOrSchool, allowedRoles } = require("../middlewares/auth");
const { createSyllabus, getSyllabus, getSyllabusBySection, updateSyllabus, deleteSyllabus } = require("../controllers/syllabusController");


router.post("/", protect, isTeacherOrAdminOfficeOrSchool, createSyllabus);
router.get("/", protect, isTeacherOrAdminOfficeOrSchool, getSyllabus);
router.get("/section/:sectionId", protect, allowedRoles, getSyllabusBySection);
router.put("/:id", protect, isTeacherOrAdminOfficeOrSchool, updateSyllabus);
router.delete("/:id", protect, isTeacherOrAdminOfficeOrSchool, deleteSyllabus);

module.exports = router;
    