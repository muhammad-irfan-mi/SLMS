const express = require("express");
const router = express.Router();
const { protect, isTeacherOrAdminOfficeOrSchool, isStudent } = require('../middlewares/auth');
const { 
  createProject, 
  getProjects, 
  updateProject, 
  deleteProject, 
  getProjectsForStudent,
  submitProject,
  gradeSubmission,
  getProjectSubmissions,
  getSubmission,
  updateSubmission
} = require("../controllers/projectController");
const { upload } = require("../utils/multer");
const { 
  validateProject, 
  validateFilter, 
  validateFiles,
  validateSubmission,
  validateGrading
} = require("../validators/project.validation");

// Teacher/Admin/School routes
router.post(
  "/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  upload.fields([{ name: "images", maxCount: 5 }, { name: "pdf", maxCount: 1 }]),
  validateFiles,
  validateProject,
  createProject
);

router.get(
  "/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validateFilter,
  getProjects
);

router.patch(
  "/:id",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  upload.fields([{ name: "images", maxCount: 5 }, { name: "pdf", maxCount: 1 }]),
  validateFiles,
  validateProject,
  updateProject
);

router.delete(
  "/:id",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  deleteProject
);

// Student routes
router.get(
  "/student",
  protect,
  isStudent,
  validateFilter,
  getProjectsForStudent
);

router.post(
  "/submit",
  protect,
  isStudent,
  upload.fields([{ name: "images", maxCount: 5 }, { name: "pdf", maxCount: 1 }]),
  validateFiles,
  validateSubmission,
  submitProject
);

// Submission viewing and grading
router.get(
  "/:projectId/submissions",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validateFilter,
  getProjectSubmissions
);

router.get(
  "/:projectId/submissions/:submissionId",
  protect,
  getSubmission
);

router.patch(
  "/:projectId/submissions/:submissionId",
  protect,
  upload.fields([{ name: "images", maxCount: 5 }, { name: "pdf", maxCount: 1 }]),
  validateFiles,
  updateSubmission
);

router.post(
  "/:projectId/submissions/:submissionId/grade",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validateGrading,
  gradeSubmission
);

module.exports = router;