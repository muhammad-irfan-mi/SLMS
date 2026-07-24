const express = require("express");

const router = express.Router();

const {
  createResult,
  updateResult,
  deleteResult,
  getResults,
  getStudentResults,
  getClassResults,
  getResultById
} = require("../controllers/result.controller");
const { checkPermission } = require("../middlewares/permission");
const { isTeacherOrAdminOfficeOrSchool, allowedRoles, protect } = require("../middlewares/auth");

router.post(
  "/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  checkPermission("result"),
  createResult
);

router.put(
  "/:resultId",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  checkPermission("result"),
  updateResult
);

router.delete(
  "/:resultId",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  checkPermission("result"),
  deleteResult
);

router.get(
  "/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  checkPermission("result"),
  getResults
);

router.get(
  "/:resultId",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  checkPermission("result"),
  getResultById
);

router.get(
  "/student/:studentId",
  protect,
  allowedRoles,
  checkPermission("result"),
  getStudentResults
);

router.get(
  "/class/:classId",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  checkPermission("result"),
  getClassResults
);

module.exports = router;