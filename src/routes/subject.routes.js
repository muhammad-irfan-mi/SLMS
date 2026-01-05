const express = require("express");
const router = express.Router();
const { 
  addSubject, 
  getSubjects, 
  updateSubject, 
  deleteSubject, 
  getSubjectsByTeacher, 
  getSubjectById
} = require("../controllers/subject.Controller");
const { isAdminOffice, protect, isTeacher } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const {
  addSubjectValidation,
  updateSubjectValidation,
  getSubjectsValidation,
  getSubjectsByTeacherValidation,
  idParamValidation,
} = require("../validators/subject.validation");

// Admin/Office routes
router.post(
  "/",
  protect,
  isAdminOffice,
  validate(addSubjectValidation),
  addSubject
);

router.get(
  "/",
  protect,
  isAdminOffice,
  validate(getSubjectsValidation, 'query'),
  getSubjects
);

router.get(
  "/:id",
  protect,
  isAdminOffice,
  validate(idParamValidation, 'params'),
  getSubjectById
);

router.put(
  "/:id",
  protect,
  isAdminOffice,
  validate(idParamValidation, 'params'),
  validate(updateSubjectValidation),
  updateSubject
);

router.delete(
  "/:id",
  protect,
  isAdminOffice,
  validate(idParamValidation, 'params'),
  deleteSubject
);

// Teacher routes
router.get(
  "/teacher",
  protect,
  isTeacher,
  validate(getSubjectsByTeacherValidation, 'query'),
  getSubjectsByTeacher
);

module.exports = router;