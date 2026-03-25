const express = require("express");
const router = express.Router();
const { protect, isAdminOffice, isTeacherOrAdminOfficeOrSchool } = require("../middlewares/auth");
const { upload } = require("../utils/multer");
const validate = require("../middlewares/validate");
const staffValidation = require("../validators/staff.validation");
const { sendOTP, verifyOTP, resendOTP, setPasswordAfterOTP, login, forgotPassword, verifyForgotPasswordOTP, resetPasswordWithOTP, resetPassword, resendForgotPasswordOTP, addStaff, getAllStaff, getStaffById, updateOwnProfile, toggleStaffStatus, updateStaff } = require("../controllers/staff.controller");

// Public auth routes
router.post(
    "/send-otp",
    validate(staffValidation.auth.sendOTP),
    sendOTP
);

router.post(
    "/verify-otp",
    validate(staffValidation.auth.verifyOTP),
    verifyOTP
);

router.post(
    "/resend-otp",
    validate(staffValidation.auth.resendOTP),
    resendOTP
);

router.post(
    "/set-password",
    validate(staffValidation.auth.setPasswordAfterOTP),
    setPasswordAfterOTP
);

router.post(
    "/login",
    validate(staffValidation.auth.login),
    login
);

router.post(
    "/forgot-password",
    validate(staffValidation.auth.forgotPassword),
    forgotPassword
);

router.post(
    "/verify-forgot-password-otp",
    validate(staffValidation.auth.verifyForgotPasswordOTP),
    verifyForgotPasswordOTP
);

router.post(
    "/reset-password-with-otp",
    validate(staffValidation.auth.resetPasswordWithOTP),
    resetPasswordWithOTP
);

router.post(
    "/reset-password",
    validate(staffValidation.auth.resetPassword),
    resetPassword
);

router.post(
    "/resend-forgot-password-otp",
    validate(staffValidation.auth.resendForgotPasswordOTP),
    resendForgotPasswordOTP
);

// Protected routes
router.post(
    "/add",
    protect,
    isAdminOffice,
    upload.fields([
        { name: "cnicFront", maxCount: 1 },
        { name: "cnicBack", maxCount: 1 },
        { name: "recentPic", maxCount: 1 },
    ]),
    validate(staffValidation.add),
    addStaff
);

router.put(
    "/:id",
    protect,
    isAdminOffice,
    upload.fields([
        { name: "cnicFront", maxCount: 1 },
        { name: "cnicBack", maxCount: 1 },
        { name: "recentPic", maxCount: 1 },
    ]),
    validate(staffValidation.idParam, 'params'),
    validate(staffValidation.update),
    updateStaff
);

router.get(
    "/",
    protect,
    isAdminOffice,
    getAllStaff
);

router.get(
    "/teachers",
    protect,
    isAdminOffice,
    getAllStaff
);

router.get(
    "/:id",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    validate(staffValidation.idParam, 'params'),
    getStaffById
);

router.put(
    "/profile/edit",
    protect,
    upload.fields([
        { name: "recentPic", maxCount: 1 },
    ]),
    validate(staffValidation.profile.update),
    updateOwnProfile
);

router.delete(
    "/:id",
    protect,
    isAdminOffice,
    validate(staffValidation.idParam, 'params'),
    toggleStaffStatus
);

module.exports = router;