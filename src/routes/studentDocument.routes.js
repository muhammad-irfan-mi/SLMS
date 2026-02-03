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

router.post(
  "/upload/request/:requestId",
  protect,
  isStudent,
  upload.array("files", 5),
  validateBody(uploadForRequestSchema),
  uploadDocumentForRequest
);

router.post(
  "/upload",
  protect,
  isStudent,
  upload.array("files", 5),
  validateBody(uploadGeneralDocumentSchema),
  uploadGeneralDocument
);

router.put(
  "/:id",
  protect,
  isStudent,
  upload.array("files", 5),
  validateBody(updateDocumentSchema),
  updateDocument
);

router.delete(
  "/:id",
  protect,
  isStudent,
  deleteDocument
);

router.get(
  "/student",
  protect,
  isStudent,
  validateQuery(getStudentDocumentsQuerySchema),
  getStudentDocuments
);

router.get(
  "/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validateQuery(getDocumentsQuerySchema),
  getDocuments
);

router.get(
  "/request/:requestId/documents",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  getDocumentsForRequest
);

router.patch(
  "/:id/status",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validateBody(updateDocumentStatusSchema),
  updateDocumentStatus
);

module.exports = router;