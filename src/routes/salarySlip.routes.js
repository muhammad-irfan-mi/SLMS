const express = require("express");
const router = express.Router();

const {
    createSalarySlip,
    recordSalaryPayment,
    updateSalarySlip,
    deleteSalarySlip,
    getTeacherSlips,
    getSalarySlipById,
    getTeachersSalaryStatus,
    getTeacherSalaryHistory,
    getSchoolSalarySummary
} = require("../controllers/salarySlipController");

const { protect, isAdminOffice, isTeacher } = require("../middlewares/auth");
const { upload } = require("../utils/multer");

// ==================== ADMIN ROUTES ====================
router.post(
    "/send",
    protect,
    isAdminOffice,
    upload.fields([{ name: "documentImage", maxCount: 1 }]),
    createSalarySlip
);

router.post(
    "/:slipId/send",
    protect,
    isAdminOffice,
    upload.fields([{ name: "documentImage", maxCount: 1 }]),
    recordSalaryPayment
);

router.put(
    "/:id",
    protect,
    isAdminOffice,
    upload.fields([{ name: "documentImage", maxCount: 1 }]),
    updateSalarySlip
);

router.delete(
    "/:id",
    protect,
    isAdminOffice,
    deleteSalarySlip
);

router.get(
    "/teachers-status",
    protect,
    isAdminOffice,
    getTeachersSalaryStatus
);

router.get(
    "/teacher-history",
    protect,
    isAdminOffice,
    getTeacherSalaryHistory
);

router.get(
    "/school-summary",
    protect,
    isAdminOffice,
    getSchoolSalarySummary
);

// ==================== TEACHER ROUTES ====================
router.get(
    "/teacher",
    protect,
    isTeacher,
    getTeacherSlips
);

router.get(
    "/my-slips/:id",
    protect,
    isTeacher,
    getSalarySlipById
);

module.exports = router;