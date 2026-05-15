const express = require("express");
const router = express.Router();
const {
    getClassesBySchool,
    addMultipleClassesWithSections,
    updateAllClassesAndSections,
    assignSectionIncharge,
    promoteStudentsToNextClass,
    removeSectionIncharge,
    updateSectionName,
    markStudentsAsLeftSchool,
    markStudentsAsPassout,
} = require("../controllers/classSection.controller");
const { protect, isAdminOffice } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const {
    addMultipleClassesValidation,
    updateAllClassesValidation,
    assignInchargeValidation,
    paginationQueryValidation,
    idParamValidation,
    schoolIdParamValidation,
    promoteStudentsSchema,
    updateSectionNameValidation,
} = require("../validators/classSection.validation");
const { checkPermission } = require("../middlewares/permission");

router.use(protect, isAdminOffice, checkPermission('classSection'));

router.post(
    "/add",
    validate(addMultipleClassesValidation),
    addMultipleClassesWithSections
);

router.put(
    "/update-all",
    validate(updateAllClassesValidation),
    updateAllClassesAndSections
);

router.get(
    "/:schoolId",
    validate(schoolIdParamValidation, 'params'),
    validate(paginationQueryValidation, 'query'),
    getClassesBySchool
);

router.post(
    '/assign-incharge',
    validate(assignInchargeValidation),
    assignSectionIncharge
);

router.post(
    '/remove-incharge',
    removeSectionIncharge
);

router.post(
    '/promote-student',
    validate(promoteStudentsSchema),
    promoteStudentsToNextClass
);

router.post(
    "/passout-student",
    protect,
    isAdminOffice,
    markStudentsAsPassout
);
router.post(
    "/left-student",
    protect,
    isAdminOffice,
    markStudentsAsLeftSchool
);

router.put(
    '/update-section-name',
    validate(updateSectionNameValidation),
    updateSectionName
);

module.exports = router;