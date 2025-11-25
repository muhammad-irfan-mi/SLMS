const express = require('express');
const { upload } = require('../utils/multer');
const { protect, isAdminOffice, isStudent } = require('../middlewares/auth');
const { createFeeDetail, uploadStudentProof, approvePayment, updateFeeDetail, deleteFeeDetail, getMyFeeDetails } = require('../controllers/fee.controller');
const router = express.Router()

router.post("/", protect, isAdminOffice, upload.fields([{ name: "voucherImage" }]), createFeeDetail);
router.put("/:id/student-proof", protect, isStudent, upload.fields([{ name: "studentProofImage" }]), uploadStudentProof);
router.patch("/:id/approve", protect, isAdminOffice, approvePayment);
router.patch("/:id", protect, isAdminOffice, upload.fields([{ name: "voucherImage" }]), updateFeeDetail);
router.delete("/:id", protect, isAdminOffice, deleteFeeDetail);
router.get("/", protect, isStudent, getMyFeeDetails);

module.exports = router;