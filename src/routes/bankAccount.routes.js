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


router.post(
    '/',
    protect,
    isAdminOffice,
    validate(createBankAccountSchema),
    createBankAccount
);

router.get(
    '/',
    protect,
    isAdminOffice,
    validateQuery(getBankAccountsQuerySchema),
    getBankAccounts
);

router.get(
    '/:id',
    protect,
    isAdminOffice,
    getBankAccountById
);

router.put(
    '/:id',
    protect,
    isAdminOffice,
    validate(updateBankAccountSchema),
    updateBankAccount
);

router.delete(
    '/:id',
    protect,
    isAdminOffice,
    deleteBankAccount
);


module.exports = router;