const express = require('express');
const { upload } = require('../utils/multer');
const { protect, isAdminOffice, isStudent, allowedRoles } = require('../middlewares/auth');
const {
  createFeeDetail,
  uploadStudentProof,
  approvePayment,
  updateFeeDetail,
  deleteFeeDetail,
  getMyFeeDetails,
  getAllFeeDetails,
  bulkCreateFeeDetails,
  bulkUpdateFeeDetails,
  getDefaulterStudents,
  getStudentFeeHistory,
  getPendingPayments,
  getFeeCollectionSummary,
} = require('../controllers/feeDetail.controller');
const { checkPermission } = require('../middlewares/permission');

const router = express.Router();

router.post("/", protect, isAdminOffice, checkPermission("fees"), upload.fields([{ name: "voucherImage" }]), createFeeDetail);
router.post("/bulk", protect, isAdminOffice, checkPermission("fees"), bulkCreateFeeDetails);
router.put("/bulk", protect, isAdminOffice, checkPermission("fees"), bulkUpdateFeeDetails);
router.patch("/:id", protect, isAdminOffice, checkPermission("fees"), upload.fields([{ name: "voucherImage" }]), updateFeeDetail);
router.delete("/:id", protect, isAdminOffice, checkPermission("fees"), deleteFeeDetail);
router.get("/", protect, isAdminOffice, checkPermission("fees"), getAllFeeDetails);
router.get("/defaulters", protect, isAdminOffice, checkPermission("fees"), getDefaulterStudents);
router.get("/pending-payments", protect, isAdminOffice, checkPermission("fees"), getPendingPayments);
router.get("/history/:studentId", protect, allowedRoles, checkPermission("fees"), getStudentFeeHistory);

router.patch("/:id/approve", protect, isAdminOffice, checkPermission("fees"), approvePayment);

router.put("/:id/student-proof", protect, isStudent, checkPermission("fees"), upload.fields([{ name: "studentProofImage" }]), uploadStudentProof);
router.get("/student", protect, isStudent, checkPermission("fees"), getMyFeeDetails);
router.get("/fee-collection-summary", protect, isAdminOffice, checkPermission("fees"), getFeeCollectionSummary);

module.exports = router;