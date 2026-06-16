const express = require("express");

const router = express.Router();

const {
    createFeeComponent,
    getFeeComponents,
    updateFeeComponent,
    deleteFeeComponent,
    getFeeComponentById,
} = require("../controllers/feeComponent.controller");

const { protect, isAdminOffice } = require("../middlewares/auth");
const { checkPermission } = require("../middlewares/permission");

router.use(protect, isAdminOffice, checkPermission("fees"));

router.post("/", createFeeComponent);
router.get("/", getFeeComponents);
router.get("/:id", getFeeComponentById);
router.put("/:id", updateFeeComponent);
router.delete("/:id", deleteFeeComponent);

module.exports = router;