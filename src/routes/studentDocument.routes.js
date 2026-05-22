const express = require("express");
const router = express.Router();
const {
  // Document Request functions
  createDocumentRequest,
  getDocumentRequests,
  getStudentDocumentRequests,
  updateDocumentRequest,
  // deleteDocumentRequest,

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
const { checkPermission } = require("../middlewares/permission");

router.post("/request", protect, isTeacherOrAdminOfficeOrSchool,checkPermission("studentdocument"), validateBody(createDocumentRequestSchema), createDocumentRequest);

router.get("/request", protect, isTeacherOrAdminOfficeOrSchool, checkPermission("studentdocument"), validateQuery(getDocumentRequestsQuerySchema), getDocumentRequests);

router.get("/request/student", protect, isStudent, checkPermission("studentdocument"), validateQuery(getDocumentRequestsQuerySchema), getStudentDocumentRequests);

router.put("/request/:id", protect, isTeacherOrAdminOfficeOrSchool, checkPermission("studentdocument"), validateBody(updateDocumentRequestSchema), updateDocumentRequest);

// router.delete("/request/:id", protect, isTeacherOrAdminOfficeOrSchool, deleteDocumentRequest);

router.post(
  "/upload/request/:requestId",
  protect,
  isStudent,
  upload.array("files", 5),
  validateBody(uploadForRequestSchema),
  checkPermission("studentdocument"),
  uploadDocumentForRequest
);

router.post(
  "/upload",
  protect,
  isStudent,
  upload.array("files", 5),
  validateBody(uploadGeneralDocumentSchema),
  checkPermission("studentdocument"),
  uploadGeneralDocument
);

router.put(
  "/:id",
  protect,
  isStudent,
  upload.array("files", 5),
  validateBody(updateDocumentSchema),
  checkPermission("studentdocument"),
  updateDocument
);

router.delete(
  "/:id",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  checkPermission("studentdocument"),
  deleteDocument
);

router.get(
  "/student",
  protect,
  isStudent,
  validateQuery(getStudentDocumentsQuerySchema),
  checkPermission("studentdocument"),
  getStudentDocuments
);

router.get(
  "/",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  validateQuery(getDocumentsQuerySchema),
  checkPermission("studentdocument"),
  getDocuments
);

router.get(
  "/request/:requestId/documents",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  checkPermission("studentdocument"),
  getDocumentsForRequest
);

router.patch(
  "/:id/status",
  protect,
  isTeacherOrAdminOfficeOrSchool,
  checkPermission("studentdocument"),
  validateBody(updateDocumentStatusSchema),
  updateDocumentStatus
);

module.exports = router;