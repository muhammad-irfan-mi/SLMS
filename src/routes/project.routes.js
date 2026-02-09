const express = require("express");
const router = express.Router();
const { protect, isTeacherOrAdminOfficeOrSchool, isStudent } = require('../middlewares/auth');
const {
  createProject,
  updateProject,
  deleteProject,
  getProjectsForStudent,
  submitProject,
  getProjectSubmissions,
  getSubmission,
  gradeSubmission,
  getProjects
} = require("../controllers/projectController");
const { upload } = require("../utils/multer");
const {
  validateProject,
  validateFilter,
  validateFiles,
  validateSubmission,
  validateGrading
} = require("../validators/project.validation");

router.post("/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  upload.fields([{ name: "images", maxCount: 5 }, { name: "pdf", maxCount: 1 }]),
  validateProject,
  createProject
);

router.get("/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validateFilter,
  getProjects
);

router.put("/:id",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  upload.fields([{ name: "images", maxCount: 5 }, { name: "pdf", maxCount: 1 }]),
  updateProject
);

router.delete("/:id",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  deleteProject
);

router.get("/student",
  protect,
  isStudent,
  validateFilter,
  getProjectsForStudent
);

router.post("/submit/:projectId",
  protect,
  isStudent,
  upload.fields([{ name: "images", maxCount: 5 }, { name: "pdf", maxCount: 1 }]), validateFiles,
  submitProject
);

router.get("/:projectId/submissions",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validateFilter,
  getProjectSubmissions
);

router.get("/:projectId/submissions/:submissionId",
  protect,
  getSubmission);

router.post("/:projectId/submissions/:submissionId/grade",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validateGrading,
  gradeSubmission);

module.exports = router;