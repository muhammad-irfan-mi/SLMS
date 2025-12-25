const express = require("express");
const router = express.Router();

const {
    markAttendance,
    updateAttendance,
    getAttendanceBySection,
    getAttendanceByStudent,
    // getAttendanceByDateOrRange,
    // getStudentAttendanceByDateOrRange
} = require("../controllers/attendance.controller");
const { markAttendanceSchema, updateAttendanceSchema, studentAttendanceQuerySchema } = require("../validators/attendance.validation");
const { isTeacher, protect, isTeacherOrAdminOfficeOrSchool, allowedRoles, isTeacherOrStudent } = require("../middlewares/auth");
const validate = require("../middlewares/validate");

// const {
//     markAttendanceSchema,
//     updateAttendanceSchema,
//     paginationSchema,
//     dateFilterSchema
// } = require("../validators/attendance.validation");


router.post("/", protect, isTeacher, validate(markAttendanceSchema), markAttendance);
router.patch("/:attendanceId", protect, isTeacherOrAdminOfficeOrSchool, validate(updateAttendanceSchema), updateAttendance);

router.get("/section/:sectionId",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    validate(studentAttendanceQuerySchema, "query"),
    getAttendanceBySection
);

router.get(
    "/student/:studentId",
    protect,
    allowedRoles,
    validate(studentAttendanceQuerySchema, "query"),
    getAttendanceByStudent
);


// router.get("/section/:sectionId/date",
//     protect,
//     isTeacherOrAdminOfficeOrSchool,
//     validate(dateFilterSchema, "query"),
//     getAttendanceByDateOrRange
// );

// router.get("/student/:studentId/date",
//     protect,
//     isTeacherOrStudent,
//     validate(dateFilterSchema, "query"),
//     getStudentAttendanceByDateOrRange
// );

module.exports = router;
