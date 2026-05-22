const express = require("express");
const router = express.Router();

const {
  createSyllabus,
  getSyllabus,
  getSyllabusBySection,
  updateSyllabus,
  deleteSyllabus
} = require("../controllers/syllabus.controller");

const validate = require("../middlewares/validate");
const {
  syllabusIdParamSchema,
  sectionIdParamSchema,
  createSyllabusSchema,
  updateSyllabusSchema,
  getSyllabusQuerySchema
} = require("../validators/syllabus.validation");

const { 
  protect, 
  isTeacherOrStudent,
  isAdminOffice, 
  isTeacherOrAdminOfficeOrSchool
} = require("../middlewares/auth");
const { checkPermission } = require("../middlewares/permission");

router.post("/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validate(createSyllabusSchema),
  checkPermission("syllabus"),
  createSyllabus
);

router.get("/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validate(getSyllabusQuerySchema, "query"),
  checkPermission("syllabus"),
  getSyllabus
);

router.put("/:syllabusId",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validate(syllabusIdParamSchema, "params"),
  validate(updateSyllabusSchema),
  checkPermission("syllabus"),
  updateSyllabus
);

router.delete("/:syllabusId",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validate(syllabusIdParamSchema, "params"),
  checkPermission("syllabus"),
  deleteSyllabus
);

router.get("/section/:sectionId",
  protect,
  isTeacherOrStudent,
  validate(sectionIdParamSchema, "params"),
  validate(getSyllabusQuerySchema, "query"),
  checkPermission("syllabus"),
  getSyllabusBySection
);

module.exports = router;