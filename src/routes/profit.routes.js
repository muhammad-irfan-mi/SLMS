const express = require("express");
const router = express.Router();
const { protect, isAdminOffice } = require("../middlewares/auth");
const { checkPermission } = require("../middlewares/permission");
const {
  getNetProfit,
  getDetailedProfitReport,
  getProfitComparison,
  getBankAccountRunningBalance
} = require("../controllers/profit.controller");

router.get(
  "/:bankAccountId/running-balance",
  protect,
  isAdminOffice,
  checkPermission("reports"),
  getBankAccountRunningBalance
);

router.get(
  "/net-profit",
  protect,
  isAdminOffice,
  checkPermission("reports"),
  getNetProfit
);

router.get(
  "/detailed-report",
  protect,
  isAdminOffice,
  checkPermission("reports"),
  getDetailedProfitReport
);

router.get(
  "/comparison",
  protect,
  isAdminOffice,
  checkPermission("reports"),
  getProfitComparison
);

module.exports = router;