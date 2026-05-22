const express = require("express");
const router = express.Router();
const {
  protect,
  isAdminOffice,
  allowedRoles,
  isStudent,
  isSchool,
  isTeacher
} = require("../middlewares/auth");
const {
  createQuizGroup,
  updateQuizGroup,
  deleteQuizGroup,
  getGroups,
  getGroupById,
  submitQuiz,
  getLeaderboard
} = require("../controllers/quiz.controller");
const {
  validateQuizGroup,
  validateQuizSubmission,
  validateFilter,
  validateLeaderboardFilter,
  validateFile
} = require("../validators/quiz.validator");
const { upload } = require("../utils/multer");
const { checkPermission } = require("../middlewares/permission");

const detectRole = (req, res, next) => {
  if (!req.user.role) {
    if (req.user.schoolId) {
      req.user.role = 'school';
    } else if (req.user.verified !== undefined && req.user.email) {
      req.user.role = 'school';
    }
  }
  next();
};

router.post("/",
  protect,
  detectRole,
  checkPermission("quiz"),
  upload.single('file'),
  validateFile,
  validateQuizGroup,
  createQuizGroup
);

router.put("/:id",
  protect,
  detectRole,
  checkPermission("quiz"),
  upload.single("file"),
  validateQuizGroup,
  updateQuizGroup
);

router.delete("/:id",
  protect,
  detectRole,
  checkPermission("quiz"),
  deleteQuizGroup
);

router.get("/",
  protect,
  detectRole,
  checkPermission("quiz"),
  validateFilter,
  getGroups
);

router.get("/:id",
  protect,
  detectRole,
  checkPermission("quiz"),
  getGroupById
);

// Submit quiz (students only)
router.post("/:id/submit",
  protect,
  isStudent,
  checkPermission("quiz"),
  validateQuizSubmission,
  submitQuiz
);

// Get leaderboard
router.get("/results/leaderboard",
  protect,
  detectRole,
  checkPermission("quiz"),
  validateLeaderboardFilter,
  getLeaderboard
);

module.exports = router;