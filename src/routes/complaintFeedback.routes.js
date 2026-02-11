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


router.post(
    "/",
    protect,
    isStudent,
    validate(createEntrySchema),
    createEntry
);

router.get(
    "/student",
    protect,
    isStudent,
    validateQuery(getEntriesSchema),
    getComplainByStudent
);

router.get(
    "/",
    protect,
    isTeacherOrAdminOfficeOrSchool,
    validateQuery(getEntriesSchema),
    getComplain
);

router.post(
    "/:id/review",
    protect,
    allowedRoles,
    validate(reviewComplaintSchema),
    reviewComplaint
);

router.patch(
    "/:id/status",
    protect,
    isAdminOffice,
    updateStatus
);

// Common routes
router.put(
    "/:id",
    protect,
    validate(updateEntrySchema),
    updateEntry
);

router.put(
    "/:id/resolve",
    protect,
    isStudent,
    markAsResolvedByStudent
);

router.delete(
    "/:id",
    protect,
    allowedRoles,
    deleteEntry
);

module.exports = router;