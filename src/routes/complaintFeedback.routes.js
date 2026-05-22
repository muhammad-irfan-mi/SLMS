const express = require("express");
const router = express.Router();

const {
    createEntry,
    updateEntry,
    deleteEntry,
    reviewComplaint,
    getComplain,
    getComplainByStudent,
    updateStatus,
    markAsResolvedByStudent
} = require("../controllers/complaintFeedback.controller");

const {
    validate,
    validateQuery,
    createEntrySchema,
    updateEntrySchema,
    reviewComplaintSchema,
    getEntriesSchema
} = require("../validators/complaintFeedback.validation");

const { 
    protect, 
    isStudent, 
    isAdminOffice,
    isTeacherOrAdminOfficeOrSchool, 
    allowedRoles
} = require("../middlewares/auth");
const { checkPermission } = require("../middlewares/permission");


router.post(
    "/",
    protect,
    isStudent,
    validate(createEntrySchema),
    checkPermission("complaintfeedback"),
    createEntry
);

router.get(
    "/student",
    protect,
    isStudent,
    validateQuery(getEntriesSchema),
    checkPermission("complaintfeedback"),
    getComplainByStudent
);

router.get(
    "/",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    validateQuery(getEntriesSchema),
    checkPermission("complaintfeedback"),
    getComplain
);

router.post(
    "/:id/review",
    protect,
    allowedRoles,
    validate(reviewComplaintSchema),
    checkPermission("complaintfeedback"),
    reviewComplaint
);

router.patch(
    "/:id/status",
    protect,
    isAdminOffice,
    checkPermission("complaintfeedback"),
    updateStatus
);

// Common routes
router.put(
    "/:id",
    protect,
    validate(updateEntrySchema),
    checkPermission("complaintfeedback"),
    updateEntry
);

router.put(
    "/:id/resolve",
    protect,
    isStudent,
    checkPermission("complaintfeedback"),
    markAsResolvedByStudent
);

router.delete(
    "/:id",
    protect,
    allowedRoles,
    checkPermission("complaintfeedback"),
    deleteEntry
);

module.exports = router;