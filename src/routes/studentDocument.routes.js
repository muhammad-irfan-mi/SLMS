const express = require("express");
const router = express.Router();
const {
  // Document Request functions
  createDocumentRequest,
  getDocumentRequests,
  getStudentDocumentRequests,
  updateDocumentRequest,
  deleteDocumentRequest,

  // Student Document functions
  uploadDocumentForRequest,
  uploadGeneralDocument,
  updateDocument,
  deleteDocument,
  getStudentDocuments,
  getDocuments,
  getDocumentsForRequest,
  updateDocumentStatus,

  // Validation functions
  validateBody,
  validateQuery,
  validateFiles
} = require("../controllers/studentDocument.controller");
const {
  createDocumentRequestSchema,
  updateDocumentRequestSchema,
  uploadForRequestSchema,
  uploadGeneralDocumentSchema,
  updateDocumentSchema,
  updateDocumentStatusSchema,
  getDocumentRequestsQuerySchema,
  getDocumentsQuerySchema,
  getStudentDocumentsQuerySchema
} = require("../validators/studentDocument.validation");
const { upload } = require("../utils/multer");
const {
  protect,
  isStudent,
  isTeacherOrAdminOfficeOrSchool
} = require("../middlewares/auth");

router.post("/request", protect, isTeacherOrAdminOfficeOrSchool, validateBody(createDocumentRequestSchema), createDocumentRequest);

router.get("/request", protect, isTeacherOrAdminOfficeOrSchool, validateQuery(getDocumentRequestsQuerySchema), getDocumentRequests);

router.get("/request/student", protect, isStudent, validateQuery(getDocumentRequestsQuerySchema), getStudentDocumentRequests);

router.put("/request/:id", protect, isTeacherOrAdminOfficeOrSchool, validateBody(updateDocumentRequestSchema), updateDocumentRequest);

router.delete("/request/:id", protect, isTeacherOrAdminOfficeOrSchool, deleteDocumentRequest);


// upload by student for a specific request
router.post(
  "/upload/request/:requestId",
  protect,
  isStudent,
  upload.array("files", 5),
  validateBody(uploadForRequestSchema),
  uploadDocumentForRequest
);

// Student: Upload general document
router.post(
  "/upload",
  protect,
  isStudent,
  upload.array("files", 5),
  validateBody(uploadGeneralDocumentSchema),
  uploadGeneralDocument
);

// Student: Update document
router.put(
  "/:id",
  protect,
  isStudent,
  upload.array("files", 5),
  validateBody(updateDocumentSchema),
  updateDocument
);

// Student: Delete document
router.delete(
  "/:id",
  protect,
  isStudent,
  deleteDocument
);

// Student: Get their documents
router.get(
  "/student",
  protect,
  isStudent,
  validateQuery(getStudentDocumentsQuerySchema),
  getStudentDocuments
);

// Teacher/Admin/School: Get documents
router.get(
  "/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validateQuery(getDocumentsQuerySchema),
  getDocuments
);

// Teacher/Admin/School: Get documents for a specific request
router.get(
  "/request/:requestId/documents",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  getDocumentsForRequest
);

// Teacher/Admin/School: Update document status
router.patch(
  "/:id/status",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validateBody(updateDocumentStatusSchema),
  updateDocumentStatus
);

module.exports = router;