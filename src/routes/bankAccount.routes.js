const express = require('express');
const router = express.Router();
const {
    createBankAccount,
    getBankAccounts,
    getBankAccountById,
    updateBankAccount,
    deleteBankAccount,
} = require('../controllers/bankAccount.controller');


const { protect, isAdminOffice } = require('../middlewares/auth');
const { createBankAccountSchema, getBankAccountsQuerySchema, validateQuery, updateBankAccountSchema, validateBody } = require('../validators/bankAccount.validation');
const validate = require('../middlewares/validate');
const { checkPermission } = require('../middlewares/permission');


router.post(
    '/',
    protect,
    isAdminOffice,
    validate(createBankAccountSchema),
    checkPermission('bankAccount'),
    createBankAccount
);

router.get(
    '/',
    protect,
    isAdminOffice,
    validateQuery(getBankAccountsQuerySchema),
    checkPermission('bankAccount'),
    getBankAccounts
);

router.get(
    '/:id',
    protect,
    isAdminOffice,
    checkPermission('bankAccount'),
    getBankAccountById
);

router.put(
    '/:id',
    protect,
    isAdminOffice,
    validate(updateBankAccountSchema),
    checkPermission('bankAccount'),
    updateBankAccount
);

router.delete(
    '/:id',
    protect,
    isAdminOffice,
    checkPermission('bankAccount'),
    deleteBankAccount
);


module.exports = router;