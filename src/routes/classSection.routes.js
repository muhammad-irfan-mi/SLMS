const express = require("express");
const router = express.Router();
const {
    deleteSectionFromClass,
    deleteClass,
    getClassesBySchool,
    addMultipleClassesWithSections,
    updateAllClassesAndSections,
    assignSectionIncharge,
} = require("../controllers/classSection.controller");
const { protect, isAdminOffice } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const {
    addMultipleClassesValidation,
    updateAllClassesValidation,
    deleteSectionValidation,
    assignInchargeValidation,
    paginationQueryValidation,
    idParamValidation,
    schoolIdParamValidation,
} = require("../validators/classSection.validation");

router.use(protect, isAdminOffice);

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

router.delete(
    "/delete-section",
    validate(deleteSectionValidation),
    deleteSectionFromClass
);

router.delete(
    "/:id",
    validate(idParamValidation, 'params'),
    deleteClass
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

module.exports = router;