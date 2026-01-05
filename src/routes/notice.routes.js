const express = require("express");
const router = express.Router();
const {
    createNotice,
    getNoticesForStudent,
    updateNotice,
    deleteNotice,
    getNotices
} = require("../controllers/noticeController");

const {
    validate,
    validateQuery,
    createNoticeSchema,
    updateNoticeSchema,
    getNoticesQuerySchema,
    getNoticesForStudentQuerySchema
} = require("../validators/notice.validator");

const {
    isTeacherOrAdminOfficeOrSchool,
    protect,
    isStudent
} = require("../middlewares/auth");

router.post(
    "/",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    validate(createNoticeSchema),
    createNotice
);

router.get(
    "/",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    validateQuery(getNoticesQuerySchema),
    getNotices
);

// Get notices for student
router.get(
    "/student",
    protect,
    isStudent,
    validateQuery(getNoticesForStudentQuerySchema),
    getNoticesForStudent
);

router.put(
    "/:id",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    validate(updateNoticeSchema),
    updateNotice
);

router.delete(
    "/:id",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    deleteNotice
);

module.exports = router;