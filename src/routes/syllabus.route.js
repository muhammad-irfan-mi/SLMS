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

router.post("/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validate(createSyllabusSchema),
  createSyllabus
);

router.get("/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validate(getSyllabusQuerySchema, "query"),
  getSyllabus
);

router.put("/:syllabusId",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validate(syllabusIdParamSchema, "params"),
  validate(updateSyllabusSchema),
  updateSyllabus
);

router.delete("/:syllabusId",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validate(syllabusIdParamSchema, "params"),
  deleteSyllabus
);

router.get("/section/:sectionId",
  protect,
  isTeacherOrStudent,
  validate(sectionIdParamSchema, "params"),
  validate(getSyllabusQuerySchema, "query"),
  getSyllabusBySection
);

module.exports = router;