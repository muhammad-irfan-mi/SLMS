const express = require("express");
const router = express.Router();
const { createEvent, updateEvent, getEvents, getEventById, deleteEvent } = require("../controllers/event.controller");
const { upload } = require("../utils/multer");
const { protect, isAdminOffice, allowedRoles } = require("../middlewares/auth");
const { checkPermission } = require("../middlewares/permission");


router.post("/", protect, isAdminOffice, checkPermission("event"), upload.fields([
    { name: "bannerImage", maxCount: 1 },
    { name: "images", maxCount: 20 }
]), createEvent);
router.put("/:id", protect, isAdminOffice, checkPermission("event"), upload.fields([
    { name: "bannerImage", maxCount: 1 },
    { name: "images", maxCount: 20 }
]), updateEvent);
router.get("/", protect, allowedRoles, checkPermission("event"), getEvents);
router.get("/:id", protect, allowedRoles, checkPermission("event"), getEventById);
router.delete("/:id", protect, isAdminOffice, checkPermission("event"), deleteEvent);

module.exports = router;
