const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
    getAccountRunningBalance,
    getOverallSchoolRunningBalance,
    getNetProfit,
    getDetailedProfitReport,
    getProfitComparison,
    getAllAccountsSummary,
    getDetailReporting,
    getFinancialDetails
} = require('../controllers/profit.controller');

router.use(protect);

router.get('/detail-reporting', getDetailReporting);
router.get('/complete-running-balance', getOverallSchoolRunningBalance);
router.get('/accounts-summary', getAllAccountsSummary);
router.get('/account/:accountId/running-balance', getAccountRunningBalance);
router.get('/net-profit', getNetProfit);
router.get('/detailed-report', getDetailedProfitReport);
router.get('/comparison', getProfitComparison);
router.get('/financial-details', getFinancialDetails);

module.exports = router;