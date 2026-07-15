// routes/cashAccount.routes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
    getCashAccountDetails,
    updateCashAccount,
    deleteCashAccount,
    createCashAccount,
    getCashAccount
} = require('../controllers/cashAccount.controller');
const { checkPermission } = require('../middlewares/permission');

router.use(protect);

router.post('/', checkPermission('cash'), createCashAccount);
router.get('/', checkPermission('cash'), getCashAccount);
router.get('/:id', checkPermission('cash'), getCashAccountDetails);
router.put('/:id', checkPermission('cash'), updateCashAccount);
router.delete('/:id', checkPermission('cash'), deleteCashAccount);

module.exports = router;