const express = require("express");
const router = express.Router();
const { protect, isAdminOffice, isTeacherOrAdminOfficeOrSchool, allowedRoles, isStudent } = require("../middlewares/auth");
const { upload } = require("../utils/multer");
const validate = require("../middlewares/validate");
const studentValidation = require("../validators/student.validation");
const { sendOTP, verifyOTP, resendOTP, setPasswordAfterOTP, login, forgotPassword, verifyForgotPasswordOTP, resetPasswordWithOTP, resetPassword, resendForgotPasswordOTP, addStudent, getAllStudents, getStudentsBySection, getStudentSiblingsByEmail, getStudentsByParentEmail, getDeletedStudents, getStudentById, updateOwnProfile, toggleStudentStatus, updateStudent, deleteOwnAccount, restoreOwnAccount } = require("../controllers/student.controller");
const { checkPermission } = require("../middlewares/permission");

// Public auth routes
router.post(
    "/send-otp",
    validate(studentValidation.auth.sendOTP),
    sendOTP
);

router.post(
    "/verify-otp",
    validate(studentValidation.auth.verifyOTP),
    verifyOTP
);

router.post(
    "/resend-otp",
    validate(studentValidation.auth.resendOTP),
    resendOTP
);

router.post(
    "/set-password",
    validate(studentValidation.auth.setPasswordAfterOTP),
    setPasswordAfterOTP
);

router.post(
    "/login",
    validate(studentValidation.auth.login),
    login
);

router.post(
    "/forgot-password",
    validate(studentValidation.auth.forgotPassword),
    forgotPassword
);

router.post(
    "/verify-forgot-password-otp",
    validate(studentValidation.auth.verifyForgotPasswordOTP),
    verifyForgotPasswordOTP
);

router.post(
    "/reset-password-with-otp",
    validate(studentValidation.auth.resetPasswordWithOTP),
    resetPasswordWithOTP
);

router.post(
    "/reset-password",
    validate(studentValidation.auth.resetPassword),
    resetPassword
);

router.post(
    "/resend-forgot-password-otp",
    validate(studentValidation.auth.resendForgotPasswordOTP),
    resendForgotPasswordOTP
);

router.post(
    "/add",
    protect,
    isAdminOffice,
    upload.fields([
        { name: "cnicFront", maxCount: 1 },
        { name: "cnicBack", maxCount: 1 },
        { name: "recentPic", maxCount: 1 },
    ]),
    validate(studentValidation.add),
    checkPermission("student"),
    addStudent
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
    validate(studentValidation.idParam, 'params'),
    validate(studentValidation.update),
    checkPermission("student"),
    updateStudent
);

router.get(
    "/",
    protect,
    isAdminOffice,
    checkPermission("student"),
    getAllStudents
);

router.get(
    "/section/:sectionId",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    validate(studentValidation.sectionParam, 'params'),
    checkPermission("student"),
    getStudentsBySection
);

router.get(
    "/siblings/:email",
    protect,
    isAdminOffice,
    validate(studentValidation.emailParam, 'params'),
    checkPermission("student"),
    getStudentSiblingsByEmail
);

// router.get(
//     "/parent/:email",
//     protect,
//     isAdminOffice,
//     validate(studentValidation.emailParam, 'params'),
//     checkPermission("student"),
//     getStudentsByParentEmail
// );

router.get(
    "/deleted",
    protect,
    isAdminOffice,
    checkPermission("student"),
    getDeletedStudents
);

router.get(
    "/:id",
    protect,
    allowedRoles,
    validate(studentValidation.idParam, 'params'),
    checkPermission("student"),
    getStudentById
);

router.put(
    "/profile/edit",
    protect,
    upload.fields([
        { name: "recentPic", maxCount: 1 },
    ]),
    validate(studentValidation.profile.update),
    updateOwnProfile
);

router.delete("/me/account", protect, isStudent, deleteOwnAccount);

router.post("/account/restore/:userId",protect, isAdminOffice,checkPermission("student"), restoreOwnAccount);

router.delete(
    "/:id",
    protect,
    isAdminOffice,
    validate(studentValidation.idParam, 'params'),
    checkPermission("student"),
    toggleStudentStatus
);

module.exports = router;