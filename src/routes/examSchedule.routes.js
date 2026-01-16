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

// Admin routes
router.post(
    "/", 
    protect, 
    isAdminOffice, 
    validateBody(createExamScheduleSchema), 
    addExamSchedule
);

router.get(
    "/", 
    protect, 
    isTeacherOrAdminOfficeOrSchool, 
    validateQuery(getScheduleQuerySchema), 
    getSchedule
);

router.put(
    "/:id", 
    protect, 
    isAdminOffice, 
    validateBody(updateExamScheduleSchema), 
    updateExamSchedule
);

router.delete(
    "/:id", 
    protect, 
    isAdminOffice, 
    deleteSchedule
);

router.get(
    "/teacher", 
    protect, 
    isTeacher, 
    validateQuery(getScheduleQuerySchema), 
    getScheduleByTeacher
);

router.get(
    "/student", 
    protect, 
    isStudent, 
    validateQuery(getScheduleQuerySchema), 
    getScheduleByStudent
);

module.exports = router;