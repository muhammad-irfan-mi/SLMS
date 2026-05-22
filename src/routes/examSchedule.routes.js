const express = require("express");
const router = express.Router();
const { 
    isAdminOffice, 
    protect, 
    isTeacher, 
    isStudent, 
    isTeacherOrAdminOfficeOrSchool
} = require("../middlewares/auth");
const { 
    addExamSchedule, 
    getSchedule, 
    deleteSchedule, 
    getScheduleByTeacher, 
    getScheduleByStudent, 
    updateExamSchedule 
} = require("../controllers/examSchedule.controller");

const {
    validateBody,
    validateQuery,
    createExamScheduleSchema,
    updateExamScheduleSchema,
    getScheduleQuerySchema
} = require("../validators/examSchedule.validation");
const { checkPermission } = require("../middlewares/permission");

// Admin routes
router.post(
    "/", 
    protect, 
    isAdminOffice, 
    validateBody(createExamScheduleSchema), 
    checkPermission("examschedule"),
    addExamSchedule
);

router.get(
    "/", 
    protect, 
    isTeacherOrAdminOfficeOrSchool, 
    validateQuery(getScheduleQuerySchema), 
    checkPermission("examschedule"),
    getSchedule
);

router.put(
    "/:id", 
    protect, 
    isAdminOffice, 
    validateBody(updateExamScheduleSchema), 
    checkPermission("examschedule"),
    updateExamSchedule
);

router.delete(
    "/:id", 
    protect, 
    isAdminOffice, 
    checkPermission("examschedule"),
    deleteSchedule
);

router.get(
    "/teacher", 
    protect, 
    isTeacher, 
    validateQuery(getScheduleQuerySchema), 
    checkPermission("examschedule"),
    getScheduleByTeacher
);

router.get(
    "/student", 
    protect, 
    isStudent, 
    validateQuery(getScheduleQuerySchema), 
    checkPermission("examschedule"),
    getScheduleByStudent
);

module.exports = router;