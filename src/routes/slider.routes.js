const express = require("express");
const router = express.Router();
const {
    createSlider,
    getVisibleSliders,
    getSlidersForSuperadmin,
    getSlidersForSchoolAdmin,
    getSliderById,
    updateSlider,
    deleteSlider
} = require("../controllers/slider.controller");
const { protect, isSuperAdmin, allowedRoles, isAdminOffice } = require("../middlewares/auth");
const { upload } = require("../utils/multer");



// Superadmin creates global slider or for specific school
router.post("/", protect, isSuperAdmin, upload.single("image"), createSlider);
// School admin creates slider for their school
router.post("/school", protect, isAdminOffice, upload.single("image"), createSlider);


// All users see visible sliders (school admin sliders for their school)
router.get("/", protect, allowedRoles, getVisibleSliders);
// Get single slider by id 
// router.get("/:id", protect, allowedRoles, getSliderById);
// Superadmin see all their uploaded sliders
router.get("/superadmin/all", protect, isSuperAdmin, getSlidersForSuperadmin);
// School admin see all their uploaded sliders
router.get("/school/admin", protect, isAdminOffice, getSlidersForSchoolAdmin);

// Superadmin update their slider
router.put("/:id", protect, isSuperAdmin, upload.single("image"), updateSlider);
// School admin update their slider
router.put("/school/:id", protect, isAdminOffice, upload.single("image"), updateSlider);


// Superadmin delete their slider
router.delete("/:id", protect, isSuperAdmin, deleteSlider);
// School admin delete their slider
router.delete("/school/:id", protect, allowedRoles, deleteSlider);

module.exports = router;
