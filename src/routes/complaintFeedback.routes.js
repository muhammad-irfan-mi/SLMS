const express = require("express");
const router = express.Router();

const { createEntry, updateEntry, deleteEntry, reviewComplaint, getComplain, getComplainByStudent } = require("../controllers/complaintFeedback.controller");
const { protect, isStudent, isAdminOffice } = require("../middlewares/auth");


router.post("/", protect, isStudent, createEntry);
router.put("/:id", protect, updateEntry);
router.delete("/:id", protect, isStudent, deleteEntry);
router.post("/:id/review", protect, isAdminOffice, reviewComplaint);
router.get("/", protect, isAdminOffice, getComplain);
router.get("/student", protect, isStudent, getComplainByStudent);

module.exports = router;
