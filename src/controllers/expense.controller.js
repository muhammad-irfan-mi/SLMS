const BankAccount = require("../models/BankAccount");
const CashAccount = require("../models/CashAccount");
const Expense = require("../models/Expense");
const School = require("../models/School");
const Staff = require("../models/Staff");
const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");
const { createNotification, NOTIFICATION_TYPES, NOTIFICATION_TARGETS } = require("../utils/notificationService");
const { createExpenseSchema, getExpensesSchema } = require("../validators/expense.validation");


async function uploadReceipt(files, existingReceipt = null) {
    let receiptUrl = existingReceipt;

    if (files?.receipt?.[0]) {
        if (receiptUrl) await deleteFileFromS3(receiptUrl);
        receiptUrl = await uploadFileToS3({
            fileBuffer: files.receipt[0].buffer,
            fileName: files.receipt[0].originalname,
            mimeType: files.receipt[0].mimetype,
        });
    }

    return receiptUrl;
}

const getDateRange = (period) => {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (period) {
        case 'today':
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            break;
        case 'this_week':
            const day = now.getDay();
            start.setDate(now.getDate() - day);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            break;
        case 'this_month':
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            break;
        case 'this_year':
            start.setMonth(0, 1);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            break;
        case 'last_month':
            start.setMonth(start.getMonth() - 1);
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end.setMonth(end.getMonth() - 1);
            end.setDate(new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate());
            end.setHours(23, 59, 59, 999);
            break;
        case 'last_year':
            start.setFullYear(start.getFullYear() - 1);
            start.setMonth(0, 1);
            start.setHours(0, 0, 0, 0);
            end.setFullYear(end.getFullYear() - 1);
            end.setMonth(11, 31);
            end.setHours(23, 59, 59, 999);
            break;
        default:
            return null;
    }

    return { start, end };
};


const sendExpenseNotification = async (expense, actor, action = 'created') => {
    try {
        const admins = await Staff.find({
            school: expense.school,
            role: { $in: ['admin_office', 'superadmin'] }
        }).select('_id');

        const title = action === 'created' ? 'New Expense Added' : 'Expense Updated';
        const message = `${actor.name} added an expense of ${expense.amount} for ${expense.category}`;

        return createNotification({
            type: NOTIFICATION_TYPES.EXPENSE,
            actor,
            targetAdmins: admins.map(a => a._id),
            target: NOTIFICATION_TARGETS.ADMIN,
            school: expense.school,
            title,
            message,
            data: {
                expenseId: expense._id,
                amount: expense.amount,
                category: expense.category,
                title: expense.title
            },
            category: 'general',
            pinned: false
        });
    } catch (error) {
        console.error('Error sending expense notification:', error);
        return null;
    }
};


const createExpense = async (req, res) => {
    try {
        const { error } = createExpenseSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const schoolId = req.user.school;
        const createdBy = req.user._id;
        const { paymentMethod, bankAccountId, cashAccountId, ...rest } = req.body;

        if (paymentMethod === 'bank') {
            if (!bankAccountId) {
                return res.status(400).json({
                    message: "Bank account ID is required for bank payment"
                });
            }

            const bankAccount = await BankAccount.findOne({
                _id: bankAccountId,
                school: schoolId,
                isActive: true
            });

            if (!bankAccount) {
                return res.status(400).json({
                    message: "Invalid bank account"
                });
            }
        }
        else if (paymentMethod === 'cash') {
            if (!cashAccountId) {
                return res.status(400).json({
                    message: "Cash account ID is required for cash payment"
                });
            }

            const cashAccount = await CashAccount.findOne({
                _id: cashAccountId,
                school: schoolId,
                isActive: true
            });

            if (!cashAccount) {
                return res.status(400).json({
                    message: "Invalid cash account"
                });
            }
        }

        const receiptUrl = await uploadReceipt(req.files);

        const expenseData = {
            ...rest,
            school: schoolId,
            createdBy,
            paymentMethod,
            status: 'approved', 
            receipt: receiptUrl,
            bankAccountId: paymentMethod === 'bank' ? bankAccountId : null,
            cashAccountId: paymentMethod === 'cash' ? cashAccountId : null
        };

        const expense = new Expense(expenseData);
        await expense.save();

        await sendExpenseNotification(expense, req.user, 'created');

        res.status(201).json({
            message: "Expense created successfully",
        });
    } catch (err) {
        console.error("Error creating expense:", err);
        res.status(500).json({ message: err.message });
    }
};

const getExpenses = async (req, res) => {
    try {
        const { error, value } = getExpensesSchema.validate(req.query);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const schoolId = req.user.school;
        const { page, limit, category, status, startDate, endDate, minAmount, maxAmount, search, sortBy, sortOrder } = value;

        const filter = { school: schoolId };

        if (category) filter.category = category;
        if (status) filter.status = status;
        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate);
            if (endDate) filter.date.$lte = new Date(endDate);
        }
        if (minAmount !== undefined || maxAmount !== undefined) {
            filter.amount = {};
            if (minAmount) filter.amount.$gte = minAmount;
            if (maxAmount) filter.amount.$lte = maxAmount;
        }
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { 'vendor.name': { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        const skip = (page - 1) * limit;
        const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        const [expenses, total] = await Promise.all([
            Expense.find(filter)
                // .populate('createdBy', 'name email')
                // .populate('approvedBy', 'name email')
                .sort(sortObj)
                .skip(skip)
                .limit(limit)
                .lean(),
            Expense.countDocuments(filter)
        ]);

        // Calculate summary for filtered data
        const summary = await Expense.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$amount" },
                    totalCount: { $sum: 1 },
                    avgAmount: { $avg: "$amount" },
                    minAmount: { $min: "$amount" },
                    maxAmount: { $max: "$amount" }
                }
            }
        ]);

        res.status(200).json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            summary: summary[0] || { totalAmount: 0, totalCount: 0, avgAmount: 0, minAmount: 0, maxAmount: 0 },
            expenses
        });
    } catch (err) {
        console.error("Error fetching expenses:", err);
        res.status(500).json({ message: err.message });
    }
};

const getExpenseById = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.school;

        const expense = await Expense.findOne({ _id: id, school: schoolId })
            .populate('createdBy', 'name email')
            .populate('approvedBy', 'name email');

        if (!expense) {
            return res.status(404).json({ message: "Expense not found" });
        }

        res.status(200).json({ expense });
    } catch (err) {
        console.error("Error fetching expense:", err);
        res.status(500).json({ message: err.message });
    }
};

const updateExpense = async (req, res) => {
    try {
        const { error } = updateExpenseSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const { id } = req.params;
        const schoolId = req.user.school;
        const { paymentMethod, bankAccountId, ...rest } = req.body;

        const expense = await Expense.findOne({ _id: id, school: schoolId });
        if (!expense) {
            return res.status(404).json({ message: "Expense not found" });
        }

        if (paymentMethod === 'bank') {
            if (!bankAccountId) {
                return res.status(400).json({
                    message: "Bank account ID is required for bank payment"
                });
            }

            const bankAccount = await BankAccount.findOne({
                _id: bankAccountId,
                school: schoolId,
                isActive: true
            });

            if (!bankAccount) {
                return res.status(400).json({
                    message: "Invalid bank account."
                });
            }
        }
        // Handle receipt upload
        const receiptUrl = await uploadReceipt(req.files, expense.receipt?.url);

        const updateData = {
            ...rest,
            ...(paymentMethod && { paymentMethod }),
            ...(receiptUrl && { receipt: receiptUrl }),
            ...(paymentMethod === 'bank' && { bankAccountId }),
            ...(paymentMethod === 'cash' && { bankAccountId: null })
        };

        const updatedExpense = await Expense.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        )
            // .populate('createdBy', 'name email')
            // .populate('approvedBy', 'name email')
            .lean();

        await sendExpenseNotification(updatedExpense, req.user, 'updated');

        res.status(200).json({
            message: "Expense updated successfully",
            expense: updatedExpense
        });
    } catch (err) {
        console.error("Error updating expense:", err);
        res.status(500).json({ message: err.message });
    }
};

const deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.school;

        const expense = await Expense.findOne({ _id: id, school: schoolId });
        if (!expense) {
            return res.status(404).json({ message: "Expense not found" });
        }

        // Delete receipt from S3 if exists
        if (expense.receipt?.url) {
            await deleteFileFromS3(expense.receipt.url);
        }

        await expense.deleteOne();

        res.status(200).json({ message: "Expense deleted successfully" });
    } catch (err) {
        console.error("Error deleting expense:", err);
        res.status(500).json({ message: err.message });
    }
};


const getExpenseSummary = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const { period = 'this_month' } = req.query;

        const dateRange = getDateRange(period);
        if (!dateRange) {
            return res.status(400).json({ message: "Invalid period. Use: today, this_week, this_month, this_year, last_month, last_year" });
        }

        const { start, end } = dateRange;

        const expenses = await Expense.find({
            school: schoolId,
            date: { $gte: start, $lte: end }
        }).lean();

        const totalExpenses = expenses.length;
        const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

        const categoryBreakdown = {};
        expenses.forEach(e => {
            if (!categoryBreakdown[e.category]) {
                categoryBreakdown[e.category] = { count: 0, amount: 0 };
            }
            categoryBreakdown[e.category].count++;
            categoryBreakdown[e.category].amount += e.amount;
        });

        const topExpenses = expenses
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5)
            .map(e => ({
                title: e.title,
                category: e.category,
                amount: e.amount,
                date: e.date
            }));

        let dailyBreakdown = null;
        if (period === 'this_month' || period === 'last_month') {
            const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
            dailyBreakdown = {};
            for (let i = 1; i <= daysInMonth; i++) {
                dailyBreakdown[i] = 0;
            }
            expenses.forEach(e => {
                const day = e.date.getDate();
                dailyBreakdown[day] += e.amount;
            });
        }

        let monthlyBreakdown = null;
        if (period === 'this_year' || period === 'last_year') {
            monthlyBreakdown = {};
            for (let i = 1; i <= 12; i++) {
                monthlyBreakdown[i] = 0;
            }
            expenses.forEach(e => {
                const month = e.date.getMonth() + 1;
                monthlyBreakdown[month] += e.amount;
            });
        }

        res.status(200).json({
            period,
            dateRange: { start, end },
            summary: {
                totalExpenses,
                totalAmount,
                averageAmount: totalExpenses > 0 ? totalAmount / totalExpenses : 0
            },
            categoryBreakdown,
            topExpenses,
            ...(dailyBreakdown && { dailyBreakdown }),
            ...(monthlyBreakdown && { monthlyBreakdown })
        });
    } catch (err) {
        console.error("Error fetching expense summary:", err);
        res.status(500).json({ message: err.message });
    }
};

const getExpenseAnalytics = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const { year = new Date().getFullYear() } = req.query;

        const startDate = new Date(`${year}-01-01`);
        const endDate = new Date(`${year}-12-31`);

        const monthlyExpenses = await Expense.aggregate([
            {
                $match: {
                    school: schoolId,
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { month: { $month: "$date" }, category: "$category" },
                    total: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: "$_id.month",
                    categories: {
                        $push: {
                            category: "$_id.category",
                            total: "$total",
                            count: "$count"
                        }
                    },
                    monthTotal: { $sum: "$total" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const categoryTotals = await Expense.aggregate([
            {
                $match: {
                    school: schoolId,
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: "$category",
                    total: { $sum: "$amount" },
                    count: { $sum: 1 },
                    avg: { $avg: "$amount" }
                }
            },
            { $sort: { total: -1 } }
        ]);

        const monthlyTotals = await Expense.aggregate([
            {
                $match: {
                    school: schoolId,
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { month: { $month: "$date" } },
                    total: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        const monthlyData = {};
        for (let i = 1; i <= 12; i++) {
            monthlyData[i] = 0;
        }
        monthlyTotals.forEach(m => {
            monthlyData[m._id.month] = m.total;
        });

        res.status(200).json({
            year: parseInt(year),
            monthlyExpenses: monthlyData,
            categoryTotals,
            monthlyBreakdown: monthlyExpenses,
            totalExpenses: categoryTotals.reduce((sum, c) => sum + c.total, 0)
        });
    } catch (err) {
        console.error("Error fetching expense analytics:", err);
        res.status(500).json({ message: err.message });
    }
};


const bulkCreateExpenses = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const createdBy = req.user._id;
        const expenses = req.body.expenses;

        if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
            return res.status(400).json({ message: "At least one expense is required" });
        }

        const expenseDocs = expenses.map(exp => ({
            ...exp,
            school: schoolId,
            createdBy
        }));

        const createdExpenses = await Expense.insertMany(expenseDocs);

        // Send notifications for each
        await Promise.all(
            createdExpenses.map(exp => sendExpenseNotification(exp, req.user, 'created'))
        );

        res.status(201).json({
            message: `${createdExpenses.length} expenses created successfully`,
            expenses: createdExpenses
        });
    } catch (err) {
        console.error("Error bulk creating expenses:", err);
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createExpense,
    getExpenses,
    getExpenseById,
    updateExpense,
    deleteExpense,
    getExpenseSummary,
    getExpenseAnalytics,
    bulkCreateExpenses
};