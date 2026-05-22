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
const { checkPermission } = require("../middlewares/permission");

// Admin/Teacher routes
router.post("/", 
  protect, 
  isTeacherOrAdminOfficeOrSchool, 
  checkPermission("result"),
  upload.single("image"), 
  validate(addResultSchema),
  addResult
);

router.put("/:resultId", 
  protect, 
  isTeacherOrAdminOfficeOrSchool, 
  checkPermission("result"),
  upload.single("image"), 
  validate(resultIdParamSchema, "params"),
  validate(updateResultSchema),
  updateResult
);

router.delete("/:resultId", 
  protect, 
  isTeacherOrAdminOfficeOrSchool, 
  checkPermission("result"),
  validate(resultIdParamSchema, "params"),
  deleteResult
);

router.get("/", 
  protect, 
  isTeacherOrAdminOfficeOrSchool, 
  checkPermission("result"),
  validate(getResultsQuerySchema, "query"),
  getResults
);

router.get("/by-position", 
  protect, 
  isTeacherOrAdminOfficeOrSchool, 
  checkPermission("result"),
  validate(getResultsByPositionQuerySchema, "query"),
  getResultsByPosition
);

// Student routes
router.get("/student", 
  protect, 
  isStudent, 
  checkPermission("result"),
  getStudentResults
);

module.exports = router;