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

router.post("/", 
    protect, 
    isTeacher, 
    validate(markAttendanceSchema), 
    markAttendance
);

router.patch("/:attendanceId", 
    protect, 
    isTeacherOrAdminOfficeOrSchool, 
    validate(attendanceIdParamSchema, "params"), 
    validate(updateAttendanceSchema), 
    updateAttendance
);

router.get("/section/:sectionId",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    validate(sectionIdParamSchema, "params"),
    validate(studentAttendanceQuerySchema, "query"),
    getAttendanceBySection
);

router.get(
    "/student/:studentId",
    protect,
    allowedRoles,
    validate(studentIdParamSchema, "params"),
    validate(studentAttendanceQuerySchema, "query"),
    getAttendanceByStudent
);

module.exports = router;