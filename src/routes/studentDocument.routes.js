const express = require("express");
const router = express.Router();
const { uploadDocument, updateDocument, deleteDocument, getDocuments, getStudentDocuments } = require("../controllers/studentDocument.controller");
const { upload } = require("../utils/multer");
const { protect, isStudent, isTeacherOrAdminOfficeOrSchool } = require("../middlewares/auth");


router.post("/upload", protect, isStudent, upload.array("files"), uploadDocument);
router.put("/:id", protect, isStudent, upload.array("files"), updateDocument);
router.delete("/:id", protect, isStudent, deleteDocument);
router.get("/", protect, isTeacherOrAdminOfficeOrSchool, getDocuments);
router.get("/student", protect, isStudent, getStudentDocuments);

module.exports = router;
