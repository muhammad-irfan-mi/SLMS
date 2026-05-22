const express = require('express');
const { upload } = require('../utils/multer');
const { protect, isAdminOffice, isStudent } = require('../middlewares/auth');
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
} = require('../controllers/feeDetail.controller');
const { checkPermission } = require('../middlewares/permission');

const router = express.Router();

router.post("/", protect, isAdminOffice, checkPermission("fees"), upload.fields([{ name: "voucherImage" }]), createFeeDetail);
router.put("/:id/student-proof", protect, isStudent, checkPermission("fees"), upload.fields([{ name: "studentProofImage" }]), uploadStudentProof);
router.patch("/:id/approve", protect, isAdminOffice, checkPermission("fees"), approvePayment);
router.patch("/:id", protect, isAdminOffice, checkPermission("fees"), upload.fields([{ name: "voucherImage" }]), updateFeeDetail);
router.delete("/:id", protect, isAdminOffice, checkPermission("fees"), deleteFeeDetail);
router.post("/bulk", protect, isAdminOffice, checkPermission("fees"), bulkCreateFeeDetails);
router.put("/bulk", protect, isAdminOffice, checkPermission("fees"), bulkUpdateFeeDetails);
router.get("/", protect, isAdminOffice, checkPermission("fees"), getAllFeeDetails);
router.get("/student", protect, isStudent, checkPermission("fees"), getMyFeeDetails);
router.get("/defaulters", protect, isAdminOffice, checkPermission("fees"), getDefaulterStudents);

module.exports = router;