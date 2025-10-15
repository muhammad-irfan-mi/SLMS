const express = require("express");
const router = express.Router();
const {
    addSectionToClass,
    deleteSectionFromClass,
    deleteClass,
    getClassesBySchool,
    addMultipleClassesWithSections,
    updateAllClassesAndSections,
} = require("../controllers/classSection.controller");
const { protect, isAdminOffice } = require("../middlewares/auth");

router.post("/add",
    protect,
    isAdminOffice,
    addMultipleClassesWithSections
);
router.put("/update-all",
    protect,
    isAdminOffice,
    updateAllClassesAndSections
);
router.delete("/delete-section",
    protect,
    isAdminOffice,
    deleteSectionFromClass
);
router.delete("/:id",
    protect,
    isAdminOffice,
    deleteClass
);
router.get("/:schoolId",
    protect,
    isAdminOffice,
    getClassesBySchool
);

module.exports = router;
