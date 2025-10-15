const express = require("express");
const router = express.Router();
const { addEmployeeBySchool, editEmployeeBySchool, deleteEmployeeBySchool, addStudentBySchool, editStudentBySchool, deleteStudentBySchool } = require("../controllers/employeeStudent.controller");
const { protect, isAdminOffice } = require("../middlewares/auth");
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
router.post("/set-password-user", setPasswordForUser);
router.post("/user-login", userLogin);


module.exports = router;
