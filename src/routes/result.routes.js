const express = require("express");
const router = express.Router();

const { protect, isTeacherOrAdminOfficeOrSchool, isStudent, isAdminOffice } = require("../middlewares/auth");
const { addResult, updateResult, getResults, getStudentResults, deleteResult, } = require("../controllers/result.controller");


router.post("/", protect, isTeacherOrAdminOfficeOrSchool, addResult);
router.put("/:id", protect, isTeacherOrAdminOfficeOrSchool, updateResult);
router.delete("/:id", protect, isAdminOffice, deleteResult);

router.get("/", protect, isTeacherOrAdminOfficeOrSchool, getResults);
router.get("/student", protect, isStudent, getStudentResults);

module.exports = router;
