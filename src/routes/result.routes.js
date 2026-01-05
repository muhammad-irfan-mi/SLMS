const express = require("express");
const router = express.Router();

const { upload } = require("../utils/multer");
const { 
    protect, 
    isTeacherOrAdminOfficeOrSchool, 
    isStudent, 
    isAdminOffice,
    isTeacher 
} = require("../middlewares/auth");
const { 
    addResult, 
    updateResult, 
    getResults, 
    getStudentResults, 
    deleteResult,
    getResultsByPosition 
} = require("../controllers/result.controller");

// Admin/Teacher routes
router.post("/", 
    protect, 
    isTeacherOrAdminOfficeOrSchool, 
    upload.single("image"), 
    addResult
);

router.put("/:id", 
    protect, 
    isTeacherOrAdminOfficeOrSchool, 
    upload.single("image"), 
    updateResult
);

router.delete("/:id", 
    protect, 
    isAdminOffice, 
    deleteResult
);

router.get("/", 
    protect, 
    isTeacherOrAdminOfficeOrSchool, 
    getResults
);

router.get("/by-position", 
    protect, 
    isTeacherOrAdminOfficeOrSchool, 
    getResultsByPosition
);

// Student routes
router.get("/student", 
    protect, 
    isStudent, 
    getStudentResults
);

module.exports = router;