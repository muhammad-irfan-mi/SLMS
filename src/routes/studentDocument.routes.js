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
  // Schemas
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

router.post(
  "/request",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validateBody(createDocumentRequestSchema),
  createDocumentRequest
);

// Teacher/Admin/School: Get document requests
router.get(
  "/request",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validateQuery(getDocumentRequestsQuerySchema),
  getDocumentRequests
);

// Student: Get their document requests
router.get(
  "/request/student",
  protect,
  isStudent,
  validateQuery(getDocumentRequestsQuerySchema),
  getStudentDocumentRequests
);

// Teacher/Admin/School: Update document request
router.put(
  "/request/:id",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validateBody(updateDocumentRequestSchema),
  updateDocumentRequest
);

// Teacher/Admin/School: Delete document request
router.delete(
  "/request/:id",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  deleteDocumentRequest
);

router.post(
  "/upload/request",
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