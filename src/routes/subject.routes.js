const express = require("express");
const router = express.Router();
const { addSubject, getSubjects, updateSubject, deleteSubject } = require("../controllers/subject.Controller");
const { isAdminOffice, protect } = require("../middlewares/auth");

router.post("/", protect, isAdminOffice, addSubject);
router.get("/", protect, isAdminOffice, getSubjects);
router.put("/:id", protect, isAdminOffice, updateSubject);
router.delete("/:id", protect, isAdminOffice, deleteSubject);


module.exports = router;
