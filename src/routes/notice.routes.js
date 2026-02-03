const express = require("express");
const router = express.Router();
const {
    createNotice,
    getNoticesForStudent,
    updateNotice,
    deleteNotice,
    getNotices,
    markAsRead,
    getAdminNotices
} = require("../controllers/noticeController");

const { createNoticeSchema, getNoticesQuerySchema, validateQuery, getNoticesForStudentQuerySchema, updateNoticeSchema } = require("../validators/notice.validator");

const {
    isTeacherOrAdminOfficeOrSchool,
    protect,
    isStudent,
    isAdminOffice
} = require("../middlewares/auth");
const validate = require("../middlewares/validate");

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

router.get(
    "/admin",
    protect,
    isAdminOffice,
    getAdminNotices
);

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

router.post(
    "/:id/read",
    protect,
    markAsRead
);

module.exports = router;