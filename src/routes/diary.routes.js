const express = require("express");
const {
    createDiary,
    getDiaryBySection,
    getStudentDiary,
    updateDiary,
    deleteDiary,
} = require("../controllers/diary.controller");
const { protect, isTeacherOrAdminOfficeOrSchool, isTeacherOrStudent } = require("../middlewares/auth");
const { upload } = require("../utils/multer");

const router = express.Router();

router.post(
    "/",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    upload.fields([
        { name: "images", maxCount: 2 },
        { name: "pdf", maxCount: 1 }
    ]),
    createDiary
);

router.put(
    "/:diaryId",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    upload.fields([
        { name: "images", maxCount: 2 },
        { name: "pdf", maxCount: 1 }
    ]),
    updateDiary
);

router.delete(
    "/:diaryId",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    deleteDiary
);

router.get(
    "/section/:sectionId",
    protect,
    isTeacherOrStudent,
    getDiaryBySection
);

router.get(
    "/student",
    protect,
    isTeacherOrStudent,
    getStudentDiary
);

module.exports = router;