const express = require("express");
const router = express.Router();
const { 
  addSubject, 
  getSubjects, 
  updateSubject, 
  deleteSubject, 
  getSubjectById,
  getSubjectsByTeacher
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
const { checkPermission } = require("../middlewares/permission");

router.post(
  "/",
  protect,
  isAdminOffice,
  validate(addSubjectValidation),
  checkPermission('subject'),
  addSubject
);

router.get(
  "/",
  protect,
  isAdminOffice,
  validate(getSubjectsValidation, 'query'),
  checkPermission('subject'),
  getSubjects
);

router.get(
  "/teacher",
  protect,
  isTeacher,
  validate(getSubjectsByTeacherValidation, 'query'),
  checkPermission('subject'),
  getSubjectsByTeacher
);

router.get(
  "/:id",
  protect,
  isAdminOffice,
  validate(idParamValidation, 'params'),
  checkPermission('subject'),
  getSubjectById
);

router.put(
  "/:id",
  protect,
  isAdminOffice,
  validate(idParamValidation, 'params'),
  validate(updateSubjectValidation),
  checkPermission('subject'),
  updateSubject
);

router.delete(
  "/:id",
  protect,
  isAdminOffice,
  validate(idParamValidation, 'params'),
  checkPermission('subject'),
  deleteSubject
);



module.exports = router;