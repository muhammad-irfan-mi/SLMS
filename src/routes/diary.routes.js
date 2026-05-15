const express = require("express");
const {
    createDiary,
    getDiaryBySection,
    getStudentDiary,
    updateDiary,
    deleteDiary,
} = require("../controllers/diary.controller");
const { protect, isTeacherOrAdminOfficeOrSchool, isTeacherOrStudent, allowedRoles } = require("../middlewares/auth");
const { upload } = require("../utils/multer");
const { checkPermission } = require("../middlewares/permission");

const router = express.Router();

router.post(
    "/",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    upload.fields([
        { name: "images", maxCount: 2 },
        { name: "pdf", maxCount: 1 }
    ]),
    checkPermission('diary'),
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
    checkPermission('diary'),
    updateDiary
);

router.delete(
    "/:diaryId",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    checkPermission('diary'),
    deleteDiary
);

router.get(
    "/section/:sectionId",
    protect,
    allowedRoles,
    checkPermission('diary'),
    getDiaryBySection
);

router.get(
    "/student",
    protect,
    isTeacherOrStudent,
    checkPermission('diary'),
    getStudentDiary
);

module.exports = router;