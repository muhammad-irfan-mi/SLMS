const express = require("express");
const router = express.Router();
const { sendSalarySlip, approveSalarySlip, updateSalarySlip, deleteSalarySlip, getTeacherSlips } = require("../controllers/salarySlipController");
const { protect, isAdminOffice, isTeacher } = require("../middlewares/auth");
const { upload } = require("../utils/multer");


router.post("/send", protect, isAdminOffice, upload.fields([{ name: "slipImage", maxCount: 1 }]), sendSalarySlip);
router.put("/approve/:id", protect, isTeacher, approveSalarySlip);
router.put("/:id", protect, isAdminOffice, upload.fields([{ name: "slipImage", maxCount: 1 }]), updateSalarySlip);
router.delete("/delete/:id", protect, isAdminOffice, deleteSalarySlip);
router.get("/teacher", protect, isTeacher, getTeacherSlips);


module.exports = router;
