const express = require("express");
const router = express.Router();

const {
    sendSalarySlip,
    approveSalarySlip,
    updateSalarySlip,
    deleteSalarySlip,
    getTeacherSlips,
    getTeachersSalaryStatus,
} = require("../controllers/salarySlipController");

const { protect, isAdminOffice, isTeacher } = require("../middlewares/auth");
const { upload } = require("../utils/multer");
const { checkPermission } = require("../middlewares/permission");

router.post(
    "/send",
    protect,
    isAdminOffice,
    checkPermission("salary"),
    upload.fields([{ name: "slipImage", maxCount: 1 }]),
    sendSalarySlip
);
router.put("/approve/:id", protect, isTeacher, checkPermission("salary"), approveSalarySlip);
router.put(
    "/:id",
    protect,
    isAdminOffice,
    checkPermission("salary"),
    upload.fields([{ name: "slipImage", maxCount: 1 }]),
    updateSalarySlip
);
router.delete("/delete/:id", protect, isAdminOffice, checkPermission("salary"), deleteSalarySlip);
router.get("/teacher", protect, isTeacher, checkPermission("salary"), getTeacherSlips);
router.get("/teachers-status", protect, isAdminOffice, checkPermission("salary"), getTeachersSalaryStatus);

module.exports = router;
