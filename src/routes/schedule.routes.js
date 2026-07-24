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
  deleteSchedule, 
  getSubjectBySectionSchedule
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
const { checkPermission } = require("../middlewares/permission");

// Admin/Office routes
router.post(
  "/",
  protect,
  isAdminOffice,
  validate(addScheduleValidation),
  checkPermission('schedule'),
  addSchedule
);

router.get(
  "/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validate(getScheduleValidation, 'query'),
  checkPermission('schedule'),
  getSchedule
);

router.get(
  "/section-subject",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validate(getScheduleBySectionValidation, 'query'),
  checkPermission('schedule'),
  getSubjectBySectionSchedule
);

router.put(
  "/:id",
  protect,
  isAdminOffice,
  validate(idParamValidation, 'params'),
  validate(updateScheduleValidation),
  checkPermission('schedule'),
  updateSchedule
);

router.delete(
  "/:id",
  protect,
  isAdminOffice,
  validate(idParamValidation, 'params'),
  checkPermission('schedule'),
  deleteSchedule
);

// Teacher routes
router.get(
  "/teacher",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validate(teacherScheduleValidation, 'query'),
  checkPermission('schedule'),
  getScheduleByTeacher
);

// Student routes
router.get(
  "/student",
  protect,
  isTeacherOrStudent,
  validate(studentScheduleValidation, 'query'),
  checkPermission('schedule'),
  getScheduleByStudent
);

module.exports = router;