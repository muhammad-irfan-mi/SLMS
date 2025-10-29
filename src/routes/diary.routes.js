const express = require("express");
const {
    createDiary,
    getDiaryBySection,
    getStudentDiary,
    updateDiary,
    deleteDiary,
} = require("../controllers/diary.controller");
const { protect, isTeacher, isTeacherOrStudent } = require("../middlewares/auth");

const router = express.Router();

router.post("/", protect, isTeacher, createDiary);
router.patch("/:diaryId", protect, isTeacher, updateDiary);
router.delete("/:diaryId", protect, isTeacher, deleteDiary);
router.get("/section/:sectionId", protect, isTeacherOrStudent, getDiaryBySection);
router.get("/student", protect, isTeacherOrStudent, getStudentDiary);

module.exports = router;
