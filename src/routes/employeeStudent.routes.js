const express = require("express");
const router = express.Router();
const {
    addEmployeeBySchool,
    editEmployeeBySchool,
    deleteEmployeeBySchool,
    addStudentBySchool,
    editStudentBySchool,
    deleteStudentBySchool,
    getAllEmployeesBySchool,
    getAllStudentsBySchool,
    getStudentById,
    getEmployeeById,
    editOwnProfile,
    getStudentsBySection,
    getStudentsByParentEmail,
    getStudentSiblingsByEmail,
    sendUserOTP,
    verifyUserOTP,
    resendUserOTP,
    setPasswordAfterOTP,
    // changePassword,
    resendForgotPasswordOTP,
    resetPassword,
    // verifyForgotPasswordOTP,
    forgotPassword,
    resetPasswordWithOTP
} = require("../controllers/employeeStudent.controller");
const { protect, isAdminOffice, isTeacherOrAdminOfficeOrSchool, allowedRoles } = require("../middlewares/auth");
const { upload } = require("../utils/multer");
const validate = require("../middlewares/validate");
const { validationSchemas } = require("../validators/user.validation");


router.post(
    "/send-otp",
    validate(validationSchemas.sendOTP),
    sendUserOTP
);

router.post(
    "/verify-otp",
    validate(validationSchemas.verifyOTP),
    verifyUserOTP
);

router.post(
    "/resend-otp",
    validate(validationSchemas.resendOTP),
    resendUserOTP
);

router.post(
    "/set-password-otp",
    validate(validationSchemas.setPasswordAfterOTP),
    setPasswordAfterOTP
);
router.post(
    "/add-employee",
    protect,
    isAdminOffice,
    upload.fields([
        { name: "cnicFront", maxCount: 1 },
        { name: "cnicBack", maxCount: 1 },
        { name: "recentPic", maxCount: 1 },
    ]),
    validate(validationSchemas.addEmployee),
    addEmployeeBySchool
);

router.put(
    "/edit-employee/:id",
    protect,
    isAdminOffice,
    upload.fields([
        { name: "cnicFront", maxCount: 1 },
        { name: "cnicBack", maxCount: 1 },
        { name: "recentPic", maxCount: 1 },
    ]),
    validate(validationSchemas.idParam, 'params'),
    validate(validationSchemas.updateEmployee),
    editEmployeeBySchool
);

router.delete(
    "/delete-employee/:id",
    protect,
    isAdminOffice,
    validate(validationSchemas.idParam, 'params'),
    deleteEmployeeBySchool
);

router.get(
    "/employee",
    protect,
    isAdminOffice,
    getAllEmployeesBySchool
);

router.get(
    "/employee/:id",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    validate(validationSchemas.idParam, 'params'),
    getEmployeeById
);

// Student routes
router.post(
    "/add-student",
    protect,
    isAdminOffice,
    upload.fields([
        { name: "cnicFront", maxCount: 1 },
        { name: "cnicBack", maxCount: 1 },
        { name: "recentPic", maxCount: 1 },
    ]),
    validate(validationSchemas.addStudent),
    addStudentBySchool
);

router.put(
    "/edit-student/:id",
    protect,
    isAdminOffice,
    upload.fields([
        { name: "cnicFront", maxCount: 1 },
        { name: "cnicBack", maxCount: 1 },
        { name: "recentPic", maxCount: 1 },
    ]),
    validate(validationSchemas.idParam, 'params'),
    validate(validationSchemas.updateStudent),
    editStudentBySchool
);

router.delete(
    "/delete-student/:id",
    protect,
    isAdminOffice,
    validate(validationSchemas.idParam, 'params'),
    deleteStudentBySchool
);

router.get(
    "/student",
    protect,
    isAdminOffice,
    getAllStudentsBySchool
);

router.get(
    "/section-student/:sectionId",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    validate(validationSchemas.sectionParam, 'params'),
    getStudentsBySection
);

router.get(
    "/student/:id",
    protect,
    allowedRoles,
    validate(validationSchemas.idParam, 'params'),
    getStudentById
);

router.get(
    "/parent-students/:email",
    protect,
    isAdminOffice,
    getStudentsByParentEmail
);

router.get(
    "/student-siblings/:email",
    protect,
    isAdminOffice,
    getStudentSiblingsByEmail
);

// Profile route
router.put(
    "/profile-edit",
    protect,
    allowedRoles,
    upload.fields([
        // { name: "cnicFront", maxCount: 1 },
        // { name: "cnicBack", maxCount: 1 },
        { name: "recentPic", maxCount: 1 },
    ]),
    validate(validationSchemas.updateProfile),
    editOwnProfile
);

router.post(
    "/forgot-password",
    validate(validationSchemas.forgotPassword),
    forgotPassword
);

// router.post(
//     "/verify-forgot-password-otp",
//     validate(validationSchemas.verifyForgotPasswordOTP),
//     verifyForgotPasswordOTP
// );

router.post(
    "/reset-verify-password",
    validate(validationSchemas.resetPasswordWithOTP),
    resetPasswordWithOTP
);

router.post(
    "/reset-password",
    validate(validationSchemas.resetPassword),
    resetPassword
);

router.post(
    "/resend-forgot-password-otp",
    validate(validationSchemas.resendForgotPasswordOTP),
    resendForgotPasswordOTP
);

// Protected password route
// router.post(
//     "/change-password",
//     protect,
//     validate(validationSchemas.changePassword),
//     changePassword
// );

module.exports = router;