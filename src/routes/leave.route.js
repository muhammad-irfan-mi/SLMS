const express = require("express");
const { 
    applyLeave, 
    cancelLeave, 
    getLeaves, 
    getLeavesByStudent, 
    approveLeave, 
    rejectLeave, 
    applyTeacherLeave, 
    getTeacherLeaves, 
    updateTeacherLeave, 
    cancelTeacherLeave, 
    approveTeacherLeave, 
    rejectTeacherLeave 
} = require("../controllers/leaveController");

const { 
    isAdminOffice, 
    protect, 
    isStudent, 
    isTeacher, 
    isTeacherOrAdminOfficeOrSchool, 
    allowedRoles
} = require("../middlewares/auth");

const validate = require("../middlewares/validate");

const { 
    applyLeaveSchema,
    cancelLeaveSchema,
    getLeavesQuerySchema,
    reviewLeaveSchema,
    getLeavesByStudentQuerySchema,
    applyTeacherLeaveSchema,
    getTeacherLeavesQuerySchema,
    updateTeacherLeaveSchema
} = require("../validators/leave.validation");

const router = express.Router();

// Student routes
router.post("/apply", 
    protect, 
    isStudent, 
    validate(applyLeaveSchema), 
    applyLeave
);

router.post("/:id/cancel", 
    protect, 
    isStudent, 
    validate(cancelLeaveSchema, "params"), 
    cancelLeave
);

router.get("/", 
    protect, 
    isTeacherOrAdminOfficeOrSchool, 
    validate(getLeavesQuerySchema, "query"), 
    getLeaves
);

router.get("/student/:studentId", 
    protect, 
    allowedRoles, 
    validate(getLeavesByStudentQuerySchema, "query"), 
    getLeavesByStudent
);

router.post("/:id/approve", 
    protect, 
    isTeacherOrAdminOfficeOrSchool, 
    validate(reviewLeaveSchema), 
    validate(cancelLeaveSchema, "params"), 
    approveLeave
);

router.post("/:id/reject", 
    protect, 
    isTeacherOrAdminOfficeOrSchool, 
    validate(reviewLeaveSchema), 
    validate(cancelLeaveSchema, "params"), 
    rejectLeave
);

// Teacher leave routes
router.post("/teacher/apply", 
    protect, 
    isTeacher, 
    validate(applyTeacherLeaveSchema), 
    applyTeacherLeave
);

router.get("/teacher/all", 
    protect, 
    isTeacher, 
    validate(getTeacherLeavesQuerySchema, "query"), 
    getTeacherLeaves
);

router.put("/teacher/update/:id", 
    protect, 
    isTeacher, 
    validate(updateTeacherLeaveSchema), 
    validate(cancelLeaveSchema, "params"), 
    updateTeacherLeave
);

router.put("/teacher/cancel/:id", 
    protect, 
    isTeacher, 
    validate(cancelLeaveSchema, "params"), 
    cancelTeacherLeave
);

// Admin actions for teacher leaves
router.post("/admin/approve/:id", 
    protect, 
    isAdminOffice, 
    validate(cancelLeaveSchema, "params"), 
    approveTeacherLeave
);

router.post("/admin/reject/:id", 
    protect, 
    isAdminOffice, 
    validate(reviewLeaveSchema), 
    validate(cancelLeaveSchema, "params"), 
    rejectTeacherLeave
);

module.exports = router;