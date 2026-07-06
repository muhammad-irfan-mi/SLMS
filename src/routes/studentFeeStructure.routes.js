const express = require("express");
const router = express.Router();

const {
  assignFeeToStudent,
  getStudentFees,
  updateStudentFee,
  deleteStudentFee,
} = require("../controllers/StudentFeeStructure.controller");

const { protect, isAdminOffice } = require("../middlewares/auth");
const { checkPermission } = require("../middlewares/permission");

router.use(protect, isAdminOffice, checkPermission("fees"));

router.post("/", assignFeeToStudent);
router.get("/:studentId", getStudentFees);
router.put("/:id", updateStudentFee);
router.delete("/:id", deleteStudentFee);

module.exports = router;