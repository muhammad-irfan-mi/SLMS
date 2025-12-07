const express = require("express");
const router = express.Router();

const { createSlider, getVisibleSliders, getSlidersForSuperadmin, getSlidersForSchoolAdmin, updateSlider, deleteSlider } = require("../controllers/slider.controller");

const { protect, isSuperAdmin, allowedRoles, isAdminOffice } = require("../middlewares/auth");
const { upload } = require("../utils/multer");

// Superadmin upload (global category)
router.post("/", protect, isSuperAdmin, upload.single("image"), createSlider);
// School admin upload (limited categories)
router.post("/school", protect, isAdminOffice, upload.single("image"), createSlider);
// Everyone sees visible sliders
router.get("/", protect, allowedRoles, getVisibleSliders);
// Only superadmin own uploads
router.get("/superadmin/list", protect, isSuperAdmin, getSlidersForSuperadmin);
// Only school admin own uploads
router.get("/school/list", protect, isAdminOffice, getSlidersForSchoolAdmin);
// Update (superadmin or school admin)
router.put("/:id", protect, allowedRoles, upload.single("image"), updateSlider);
// Delete
router.delete("/:id", protect, deleteSlider);

module.exports = router;
