const express = require("express");
const router = express.Router();
const { protect, isAdminOffice, allowedRoles, isStudent } = require("../middlewares/auth");
const { createQuizGroup, updateQuizGroup, deleteQuizGroup, getGroups, getGroupById, submitQuiz, getLeaderboard } = require("../controllers/quiz.controller");

// Admin routes
router.post("/", protect, isAdminOffice, createQuizGroup);
router.put("/:id", protect, isAdminOffice, updateQuizGroup);
router.delete("/:id", protect, isAdminOffice, deleteQuizGroup);
router.get("/", protect, allowedRoles, getGroups);

// Student/public
router.get("/:id", protect, allowedRoles, getGroupById);
router.post("/:id/submit", protect, isStudent, submitQuiz);

// Leaderboard
router.get("/results/leaderboard", protect, allowedRoles, getLeaderboard);


module.exports = router;
