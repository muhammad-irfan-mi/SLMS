const express = require("express");
const router = express.Router();
const { upload } = require("../utils/multer");
const { protect, isAdminOffice } = require("../middlewares/auth");
const { checkPermission } = require("../middlewares/permission");
const { createExpense, getExpenses, getExpenseById, updateExpense, deleteExpense, getExpenseSummary, getExpenseAnalytics, bulkCreateExpenses } = require("../controllers/expense.controller");
const { createExpenseSchema, updateExpenseSchema, getExpensesSchema, idParamSchema } = require("../validators/expense.validation");
const validate = require("../middlewares/validate");

router.post("/", protect, isAdminOffice, checkPermission("expenses"), upload.fields([{ name: "receipt", maxCount: 1 }]), validate(createExpenseSchema), createExpense);
router.post("/bulk", protect, isAdminOffice, checkPermission("expenses"), bulkCreateExpenses);
router.get("/", protect, isAdminOffice, checkPermission("expenses"), validate(getExpensesSchema, 'query'), getExpenses);
router.get("/summary", protect, isAdminOffice, checkPermission("expenses"), getExpenseSummary);
router.get("/analytics", protect, isAdminOffice, checkPermission("expenses"), getExpenseAnalytics);
router.get("/:id", protect, isAdminOffice, checkPermission("expenses"), validate(idParamSchema, 'params'), getExpenseById);
router.put("/:id", protect, isAdminOffice, checkPermission("expenses"), upload.fields([{ name: "receipt", maxCount: 1 }]), validate(idParamSchema, 'params'), validate(updateExpenseSchema), updateExpense);
router.delete("/:id", protect, isAdminOffice, checkPermission("expenses"), validate(idParamSchema, 'params'), deleteExpense);

module.exports = router;