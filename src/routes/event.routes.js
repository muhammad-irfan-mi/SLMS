const express = require("express");
const router = express.Router();
const { createEvent, updateEvent, getEvents, getEventById, deleteEvent } = require("../controllers/event.controller");
const { upload } = require("../utils/multer");
const { protect, isAdminOffice, allowedRoles } = require("../middlewares/auth");


router.post("/", protect, isAdminOffice, upload.array("images", 20), createEvent);
router.put("/:id", protect, isAdminOffice, upload.array("images", 20), updateEvent);
router.get("/", protect, allowedRoles, getEvents);
router.get("/:id", protect, allowedRoles, getEventById);
router.delete("/:id", protect, isAdminOffice, deleteEvent);

module.exports = router;
