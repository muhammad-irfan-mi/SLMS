const express = require("express");
const router = express.Router();
const { 
  isAdminOffice, 
  protect, 
  isTeacherOrStudent, 
  isTeacherOrAdminOfficeOrSchool 
} = require("../middlewares/auth");
const { 
  addSchedule, 
  getSchedule,
  getScheduleBySection,
  getScheduleByTeacher, 
  getScheduleByStudent,
  updateSchedule, 
  deleteSchedule 
} = require("../controllers/schedule.Controller");
const validate = require("../middlewares/validate");
const {
  addScheduleValidation,
  getScheduleValidation,
  getScheduleBySectionValidation,
  teacherScheduleValidation,
  studentScheduleValidation,
  updateScheduleValidation,
  idParamValidation,
} = require("../validators/schedule.validation");

// Admin/Office routes
router.post(
  "/",
  protect,
  isAdminOffice,
  validate(addScheduleValidation),
  addSchedule
);

router.get(
  "/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validate(getScheduleValidation, 'query'),
  getSchedule
);

router.get(
  "/section",
  protect,
  isAdminOffice,
  validate(getScheduleBySectionValidation, 'query'),
  getScheduleBySection
);

router.put(
  "/:id",
  protect,
  isAdminOffice,
  validate(idParamValidation, 'params'),
  validate(updateScheduleValidation),
  updateSchedule
);

router.delete(
  "/:id",
  protect,
  isAdminOffice,
  validate(idParamValidation, 'params'),
  deleteSchedule
);

// Teacher routes
router.get(
  "/teacher",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validate(teacherScheduleValidation, 'query'),
  getScheduleByTeacher
);

// Student routes
router.get(
  "/student",
  protect,
  isTeacherOrStudent,
  validate(studentScheduleValidation, 'query'),
  getScheduleByStudent
);

module.exports = router;