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
    rejectTeacherLeave,
    updateLeave,
    deleteLeave
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
    updateTeacherLeaveSchema,
    updateLeaveSchema
} = require("../validators/leave.validation");
const { checkPermission } = require("../middlewares/permission");

const router = express.Router();

// Student routes
router.post("/apply",
    protect,
    isStudent,
    validate(applyLeaveSchema),
    checkPermission("leave"),
    applyLeave
);

router.put(
    "/:id",
    protect,
    isStudent,
    validate(updateLeaveSchema),
    checkPermission("leave"),
    updateLeave
);

router.post("/:id/cancel",
    protect,
    isStudent,
    validate(cancelLeaveSchema, "params"),
    checkPermission("leave"),
    cancelLeave
);

router.get("/",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    validate(getLeavesQuerySchema, "query"),
    checkPermission("leave"),
    getLeaves
);

router.get("/student/:studentId",
    protect,
    allowedRoles,
    validate(getLeavesByStudentQuerySchema, "query"),
    checkPermission("leave"),
    getLeavesByStudent
);

router.post("/:id/approve",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    validate(reviewLeaveSchema),
    validate(cancelLeaveSchema, "params"),
    checkPermission("leave"),
    approveLeave
);

router.post("/:id/reject",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    validate(reviewLeaveSchema),
    validate(cancelLeaveSchema, "params"),
    checkPermission("leave"),
    rejectLeave
);

// Teacher leave routes
router.post("/teacher/apply",
    protect,
    isTeacher,
    validate(applyTeacherLeaveSchema),
    checkPermission("leave"),
    applyTeacherLeave
);

router.get("/teacher/all",
    protect,
    isTeacher,
    validate(getTeacherLeavesQuerySchema, "query"),
    checkPermission("leave"),
    getTeacherLeaves
);

router.put("/teacher/update/:id",
    protect,
    isTeacher,
    validate(updateTeacherLeaveSchema),
    validate(cancelLeaveSchema, "params"),
    checkPermission("leave"),
    updateTeacherLeave
);

router.put("/teacher/cancel/:id",
    protect,
    isTeacher,
    validate(cancelLeaveSchema, "params"),
    checkPermission("leave"),
    cancelTeacherLeave
);

// Admin actions for teacher leaves
router.post("/admin/approve/:id",
    protect,
    isAdminOffice,
    validate(cancelLeaveSchema, "params"),
    checkPermission("leave"),
    approveTeacherLeave
);

router.post("/admin/reject/:id",
    protect,
    isAdminOffice,
    validate(reviewLeaveSchema),
    validate(cancelLeaveSchema, "params"),
    checkPermission("leave"),
    rejectTeacherLeave
);

router.delete("/:id",
    protect,
    allowedRoles,
    checkPermission("leave"),
    deleteLeave
);

module.exports = router;