// const express = require("express");
// const router = express.Router();
// const { protect, isTeacherOrAdminOfficeOrSchool, allowedRoles } = require("../middlewares/auth");
// const { createSyllabus, getSyllabus, getSyllabusBySection, updateSyllabus, deleteSyllabus } = require("../controllers/syllabusController");


// router.post("/", protect, isTeacherOrAdminOfficeOrSchool, createSyllabus);
// router.get("/", protect, isTeacherOrAdminOfficeOrSchool, getSyllabus);
// router.get("/section/:sectionId", protect, allowedRoles, getSyllabusBySection);
// router.put("/:id", protect, isTeacherOrAdminOfficeOrSchool, updateSyllabus);
// router.delete("/:id", protect, isTeacherOrAdminOfficeOrSchool, deleteSyllabus);

// module.exports = router;
    






const express = require("express");
const router = express.Router();

const {
  protect,
  isTeacherOrAdminOfficeOrSchool,
  allowedRoles
} = require("../middlewares/auth");

const validate = require("../middlewares/validate");

const {
  createSyllabusSchema,
  updateSyllabusSchema,
  getSyllabusQuerySchema,
  getSyllabusBySectionSchema,
} = require("../validators/syllabus.validation");

const {
  createSyllabus,
  getSyllabus,
  getSyllabusBySection,
  updateSyllabus,
  deleteSyllabus
} = require("../controllers/syllabusController");

router.post(
  "/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validate(createSyllabusSchema),
  createSyllabus
);

router.get(
  "/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validate(getSyllabusQuerySchema, "query"),
  getSyllabus
);

router.get(
  "/section/:sectionId",
  protect,
  allowedRoles,
  validate(getSyllabusBySectionSchema, "params"),
  getSyllabusBySection
);

router.put(
  "/:id",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validate(updateSyllabusSchema),
  updateSyllabus
);

router.delete(
  "/:id",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  deleteSyllabus
);

module.exports = router;