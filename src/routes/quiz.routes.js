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
  // (req, res, next) => {
  //   const allowed = ['school', 'admin_office', 'teacher'];
  //   if (!allowed.includes(req.user.role)) {
  //     return res.status(403).json({ 
  //       message: 'Only school, admin office, or teachers can create quizzes' 
  //     });
  //   }
  //   next();
  // },
  upload.single('file'), 
  validateFile,
  validateQuizGroup,
  createQuizGroup
);

router.put("/:id",
  protect,
  detectRole,
  validateQuizGroup,
  updateQuizGroup
);

router.delete("/:id",
  protect,
  detectRole,
  deleteQuizGroup
);

router.get("/",
  protect,
  detectRole,
  validateFilter,
  getGroups
);

router.get("/:id",
  protect,
  detectRole,
  getGroupById
);

// Submit quiz (students only)
router.post("/:id/submit",
  protect,
  isStudent,
  validateQuizSubmission,
  submitQuiz
);

// Get leaderboard
router.get("/results/leaderboard",
  protect,
  detectRole,
  validateLeaderboardFilter,
  getLeaderboard
);

module.exports = router;