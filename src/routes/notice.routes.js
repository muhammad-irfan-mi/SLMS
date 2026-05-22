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
const { checkPermission } = require("../middlewares/permission");

router.post(
    "/",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    checkPermission("notice"),
    validate(createNoticeSchema),
    createNotice
);

router.get(
    "/",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    checkPermission("notice"),
    validateQuery(getNoticesQuerySchema),
    getNotices
);

router.get(
    "/admin",
    protect,
    isAdminOffice,
    checkPermission("notice"),
    getAdminNotices
);

router.get(
    "/student",
    protect,
    isStudent,
    checkPermission("notice"),
    validateQuery(getNoticesForStudentQuerySchema),
    getNoticesForStudent
);

router.put(
    "/:id",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    checkPermission("notice"),
    validate(updateNoticeSchema),
    updateNotice
);

router.delete(
    "/:id",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    checkPermission("notice"),
    deleteNotice
);

router.post(
    "/:id/read",
    protect,
    markAsRead
);

module.exports = router;