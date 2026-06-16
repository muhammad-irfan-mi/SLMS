const express = require("express");
const router = express.Router();

const {
  assignFeeToClass,
  getClassFees,
  updateClassFee,
  deleteClassFee,
} = require("../controllers/classFeeStructure.controller");

const { protect, isAdminOffice } = require("../middlewares/auth");
const { checkPermission } = require("../middlewares/permission");

router.use(protect, isAdminOffice, checkPermission("fees"));

router.post("/", assignFeeToClass);
router.get("/:classId", getClassFees);
router.put("/:id", updateClassFee);
router.delete("/:id", deleteClassFee);

module.exports = router;