// attendance.routes.js
const express = require("express");
const router = express.Router();

const {
    markAttendance,
    updateAttendance,
    getAttendanceBySection,
    getAttendanceByStudent,
} = require("../controllers/attendance.controller");

const { 
    markAttendanceSchema, 
    updateAttendanceSchema, 
    studentAttendanceQuerySchema,
    sectionIdParamSchema,
    studentIdParamSchema,
    attendanceIdParamSchema
} = require("../validators/attendance.validation");

const { 
    isTeacher, 
    protect, 
    isTeacherOrAdminOfficeOrSchool, 
    allowedRoles, 
    isTeacherOrStudent 
} = require("../middlewares/auth");

const validate = require("../middlewares/validate");
const { checkPermission } = require("../middlewares/permission");

router.post("/", 
    protect, 
    isTeacher, 
    validate(markAttendanceSchema), 
    checkPermission("attendance"),
    markAttendance
);

router.patch("/:attendanceId", 
    protect, 
    isTeacherOrAdminOfficeOrSchool, 
    validate(attendanceIdParamSchema, "params"), 
    validate(updateAttendanceSchema), 
    checkPermission("attendance"),
    updateAttendance
);

router.get("/section/:sectionId",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    validate(sectionIdParamSchema, "params"),
    validate(studentAttendanceQuerySchema, "query"),
    checkPermission("attendance"),
    getAttendanceBySection
);

router.get(
    "/student/:studentId",
    protect,
    allowedRoles,
    validate(studentIdParamSchema, "params"),
    validate(studentAttendanceQuerySchema, "query"),
    checkPermission("attendance"),
    getAttendanceByStudent
);

module.exports = router;