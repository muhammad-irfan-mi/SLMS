// const express = require("express");
// const router = express.Router();

// const {
//   protect,
//   isTeacherOrAdminOfficeOrSchool,
//   allowedRoles
// } = require("../middlewares/auth");

// const validate = require("../middlewares/validate");

// const {
//   createSyllabusSchema,
//   updateSyllabusSchema,
//   getSyllabusQuerySchema,
//   getSyllabusBySectionSchema,
// } = require("../validators/syllabus.validation");

// const {
//   createSyllabus,
//   getSyllabus,
//   getSyllabusBySection,
//   updateSyllabus,
//   deleteSyllabus
// } = require("../controllers/syllabusController");

// router.post(
//   "/",
//   protect,
//   isTeacherOrAdminOfficeOrSchool,
//   validate(createSyllabusSchema),
//   createSyllabus
// );

// router.get(
//   "/",
//   protect,
//   isTeacherOrAdminOfficeOrSchool,
//   validate(getSyllabusQuerySchema, "query"),
//   getSyllabus
// );

// router.get(
//   "/section/:sectionId",
//   protect,
//   allowedRoles,
//   validate(getSyllabusBySectionSchema, "params"),
//   getSyllabusBySection
// );

// router.put(
//   "/:id",
//   protect,
//   isTeacherOrAdminOfficeOrSchool,
//   validate(updateSyllabusSchema),
//   updateSyllabus
// );

// router.delete(
//   "/:id",
//   protect,
//   isTeacherOrAdminOfficeOrSchool,
//   deleteSyllabus
// );

// module.exports = router;














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
  isAdminOffice 
} = require("../middlewares/auth");

// Admin/Office/School routes
router.post("/",
  protect,
  isAdminOffice,
  validate(createSyllabusSchema),
  createSyllabus
);

router.get("/",
  protect,
  isAdminOffice,
  validate(getSyllabusQuerySchema, "query"),
  getSyllabus
);

router.put("/:syllabusId",
  protect,
  isAdminOffice,
  validate(syllabusIdParamSchema, "params"),
  validate(updateSyllabusSchema),
  updateSyllabus
);

router.delete("/:syllabusId",
  protect,
  isAdminOffice,
  validate(syllabusIdParamSchema, "params"),
  deleteSyllabus
);

// Student/Teacher routes
router.get("/section/:sectionId",
  protect,
  isTeacherOrStudent,
  validate(sectionIdParamSchema, "params"),
  validate(getSyllabusQuerySchema, "query"),
  getSyllabusBySection
);

module.exports = router;