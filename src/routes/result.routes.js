const express = require("express");
const router = express.Router();

const { upload } = require("../utils/multer");
const { 
  protect, 
  isTeacherOrAdminOfficeOrSchool, 
  isStudent, 
  isAdminOffice
} = require("../middlewares/auth");
const { 
  addResult, 
  updateResult, 
  getResults, 
  getStudentResults, 
  deleteResult,
  getResultsByPosition 
} = require("../controllers/result.controller");
const validate = require("../middlewares/validate");
const { addResultSchema, updateResultSchema, resultIdParamSchema, getResultsQuerySchema, getResultsByPositionQuerySchema } = require("../validators/result.vakidation");

// Admin/Teacher routes
router.post("/", 
  protect, 
  isTeacherOrAdminOfficeOrSchool, 
  upload.single("image"), 
  validate(addResultSchema),
  addResult
);

router.put("/:resultId", 
  protect, 
  isTeacherOrAdminOfficeOrSchool, 
  upload.single("image"), 
  validate(resultIdParamSchema, "params"),
  validate(updateResultSchema),
  updateResult
);

router.delete("/:resultId", 
  protect, 
  isAdminOffice, 
  validate(resultIdParamSchema, "params"),
  deleteResult
);

router.get("/", 
  protect, 
  isTeacherOrAdminOfficeOrSchool, 
  validate(getResultsQuerySchema, "query"),
  getResults
);

router.get("/by-position", 
  protect, 
  isTeacherOrAdminOfficeOrSchool, 
  validate(getResultsByPositionQuerySchema, "query"),
  getResultsByPosition
);

// Student routes
router.get("/student", 
  protect, 
  isStudent, 
  getStudentResults
);

module.exports = router;