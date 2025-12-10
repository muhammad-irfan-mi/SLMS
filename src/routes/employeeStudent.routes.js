const express = require("express");
const router = express.Router();
const { addEmployeeBySchool, editEmployeeBySchool, deleteEmployeeBySchool, addStudentBySchool, editStudentBySchool, deleteStudentBySchool, getAllEmployeesBySchool, getAllStudentsBySchool, getStudentById, getEmployeeById, editOwnProfile, getStudentsBySection } = require("../controllers/employeeStudent.controller");
const { protect, isAdminOffice, editProfile, isTeacher, isAuthorizedUser, isTeacherOrAdminOfficeOrSchool, allowedRoles } = require("../middlewares/auth");
const { upload } = require("../utils/multer");
const { setPasswordForUser, userLogin } = require("../controllers/authController");

router.post(
    "/add-employee",
    protect,
    isAdminOffice,
    upload.fields([
        { name: "cnicFront", maxCount: 1 },
        { name: "cnicBack", maxCount: 1 },
        { name: "recentPic", maxCount: 1 },
    ]),
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
    editEmployeeBySchool
);

router.delete("/delete-employee/:id", protect, isAdminOffice, deleteEmployeeBySchool);
router.get("/employee", protect, isAdminOffice, getAllEmployeesBySchool);
router.get("/employee/:id", protect, isTeacherOrAdminOfficeOrSchool, getEmployeeById);

router.post(
    "/add-student",
    protect,
    isAdminOffice,
    upload.fields([
        { name: "cnicFront", maxCount: 1 },
        { name: "cnicBack", maxCount: 1 },
        { name: "recentPic", maxCount: 1 },
    ]),
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
    editStudentBySchool
);


router.delete("/delete-student/:id", protect, isAdminOffice, deleteStudentBySchool);
router.get("/student", protect, isAdminOffice, getAllStudentsBySchool);
router.get("/section-student/:sectionId", protect, isTeacherOrAdminOfficeOrSchool, getStudentsBySection);
router.get("/student/:id", protect, allowedRoles, getStudentById);
router.post("/set-password-user", setPasswordForUser);
router.post("/user-login", userLogin);


router.put(
    "/profile-edit",
    protect,
    allowedRoles,
    upload.fields([
        { name: "cnicFront", maxCount: 1 },
        { name: "cnicBack", maxCount: 1 },
        { name: "recentPic", maxCount: 1 },
    ]),
    editOwnProfile
);


module.exports = router;
