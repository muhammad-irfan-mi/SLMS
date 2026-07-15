const CashAccount = require('../models/CashAccount');
const Expense = require('../models/Expense');
const FeePayment = require('../models/FeePayment');
const { updateCashAccountSchema } = require('../validators/cashAccount.validation');

const createCashAccount = async (req, res) => {
    try {
        const user = req.user;
        const schoolId = user.school || user._id || (user.schoolInfo && user.schoolInfo.id);

        if (!schoolId) {
            return res.status(400).json({
                success: false,
                message: "School information is required"
            });
        }

        const { title, description, amount } = req.body;

        const existingAccount = await CashAccount.findOne({ school: schoolId });

        if (existingAccount) {
            return res.status(400).json({
                success: false,
                message: "Cash account already exists for this school"
            });
        }

        const accountAmount = parseFloat(amount) || 0;
        if (accountAmount < 0) {
            return res.status(400).json({
                success: false,
                message: "Amount cannot be negative"
            });
        }

        const cashAccount = await CashAccount.create({
            school: schoolId,
            title: title || 'Cash Account',
            description: description || 'Default cash account for school',
            amount: amount || 0,
            createdBy: user._id
        });

        return res.status(201).json({
            success: true,
            message: "Cash account created successfully",
            data: cashAccount
        });
    } catch (error) {
        console.error("Error creating cash account:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create cash account"
        });
    }
};

const updateCashAccount = async (req, res) => {
    try {
        const schoolId = req.user.school || req.user._id || (req.user.schoolInfo && req.user.schoolInfo.id);
        const { error, value } = updateCashAccountSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const cashAccount = await CashAccount.findOne({
            school: schoolId,
            isActive: true
        });

        if (!cashAccount) {
            return res.status(404).json({
                success: false,
                message: "Cash account not found. Please create one first."
            });
        }


        Object.assign(cashAccount, value);
        cashAccount.updatedBy = req.user._id;
        await cashAccount.save();

        res.status(200).json({
            success: true,
            message: "Cash account updated successfully",
            data: cashAccount
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getCashAccount = async (req, res) => {
    try {
        const schoolId = req.user.school || req.user._id || (req.user.schoolInfo && req.user.schoolInfo.id);

        const cashAccount = await CashAccount.findOne({
            school: schoolId,
            isActive: true
        });

        if (!cashAccount) {
            return res.status(404).json({
                success: false,
                message: "Cash account not found. Please create one first."
            });
        }


        res.status(200).json({
            success: true,
            data: cashAccount,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getCashAccountDetails = async (req, res) => {
    try {
        const schoolId = req.user.school || req.user._id || (req.user.schoolInfo && req.user.schoolInfo.id);

        const {
            startDate,
            endDate,
            period = 'all'
        } = req.query;

        const cashAccount = await CashAccount.findOne({
            school: schoolId,
            isActive: true
        });

        if (!cashAccount) {
            return res.status(404).json({
                success: false,
                message: "Cash account not found. Please create one first."
            });
        }

        let dateFilter = {};
        let dateRange = {};

        if (period === 'today') {
            const today = new Date();
            const startOfDay = new Date(today.setHours(0, 0, 0, 0));
            const endOfDay = new Date(today.setHours(23, 59, 59, 999));
            dateFilter = {
                updatedAt: { $gte: startOfDay, $lte: endOfDay }
            };
            dateRange = { start: startOfDay, end: endOfDay };
        } else if (period === 'this_month') {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            endOfMonth.setHours(23, 59, 59, 999);
            dateFilter = {
                updatedAt: { $gte: startOfMonth, $lte: endOfMonth }
            };
            dateRange = { start: startOfMonth, end: endOfMonth };
        } else if (period === 'this_year') {
            const now = new Date();
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            const endOfYear = new Date(now.getFullYear(), 11, 31);
            endOfYear.setHours(23, 59, 59, 999);
            dateFilter = {
                updatedAt: { $gte: startOfYear, $lte: endOfYear }
            };
            dateRange = { start: startOfYear, end: endOfYear };
        } else if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter = {
                updatedAt: { $gte: start, $lte: end }
            };
            dateRange = { start, end };
        }

        const baseMatch = {
            school: schoolId,
            cashAccountId: cashAccount._id,
            status: { $in: ['approved', 'paid'] }
        };

        let feeMatch = { ...baseMatch };
        let expenseMatch = { ...baseMatch };

        if (period !== 'all' && Object.keys(dateFilter).length > 0) {
            feeMatch = { ...baseMatch, ...dateFilter };
            expenseMatch = {
                ...baseMatch,
                ...(dateFilter.updatedAt ? { date: dateFilter.updatedAt } : {})
            };
        }
        const [feePayments, expenses, feePaymentsByMonth, expensesByMonth] = await Promise.all([
            FeePayment.aggregate([
                { $match: feeMatch },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$amount" },
                        count: { $sum: 1 }
                    }
                }
            ]),

            Expense.aggregate([
                { $match: expenseMatch },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$amount" },
                        count: { $sum: 1 }
                    }
                }
            ]),

            FeePayment.aggregate([
                { $match: feeMatch },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m", date: "$updatedAt" }
                        },
                        total: { $sum: "$amount" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            Expense.aggregate([
                { $match: expenseMatch },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m", date: "$date" }
                        },
                        total: { $sum: "$amount" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ])
        ]);

        const totalReceived = feePayments[0]?.total || 0;
        const totalPaid = expenses[0]?.total || 0;
        const receivedCount = feePayments[0]?.count || 0;
        const paidCount = expenses[0]?.count || 0;
        const currentBalance = (cashAccount.amount || 0) + totalReceived - totalPaid;

        const [recentCollections, recentExpenses] = await Promise.all([
            FeePayment.find(feeMatch)
                .populate('studentId', 'name registrationNumber')
                .populate('feeId', 'title month')
                .sort({ updatedAt: -1 })
                .limit(5)
                .lean(),
            Expense.find(expenseMatch)
                .sort({ date: -1, createdAt: -1 })
                .limit(5)
                .lean()
        ]);

        const monthlyBreakdown = {};
        const allMonths = new Set([
            ...feePaymentsByMonth.map(m => m._id),
            ...expensesByMonth.map(m => m._id)
        ]);

        allMonths.forEach(month => {
            const fee = feePaymentsByMonth.find(m => m._id === month);
            const exp = expensesByMonth.find(m => m._id === month);
            const income = fee?.total || 0;
            const expense = exp?.total || 0;
            monthlyBreakdown[month] = {
                collections: income,
                expenses: expense,
                net: income - expense,
                collectionCount: fee?.count || 0,
                expenseCount: exp?.count || 0
            };
        });

        res.status(200).json({
            success: true,
            data: {
                _id: cashAccount._id,
                title: cashAccount.title,
                description: cashAccount.description,
                openingBalance: cashAccount.amount || 0,
                isActive: cashAccount.isActive,
                createdAt: cashAccount.createdAt,
                updatedAt: cashAccount.updatedAt,
                summary: {
                    openingBalance: cashAccount.amount || 0,
                    totalCollection: {
                        amount: totalReceived,
                        count: receivedCount,
                        // percentage: cashAccount.amount > 0
                        //     ? Math.round((totalReceived / cashAccount.amount) * 100 * 100) / 100
                        //     : 0
                    },
                    totalExpenses: {
                        amount: totalPaid,
                        count: paidCount,
                        // percentage: cashAccount.amount > 0
                        //     ? Math.round((totalPaid / cashAccount.amount) * 100 * 100) / 100
                        //     : 0
                    },
                    currentBalance,
                    totalTransactions: receivedCount + paidCount,
                    // netCashFlow: totalReceived - totalPaid,
                    // collectionRate: totalReceived + totalPaid > 0
                    //     ? Math.round((totalReceived / (totalReceived + totalPaid)) * 100 * 100) / 100
                    //     : 0
                },

                monthlyBreakdown,
                recentTransactions: {
                    collections: recentCollections.map(c => ({
                        _id: c._id,
                        amount: c.amount,
                        studentName: c.studentId?.name || 'Unknown',
                        feeTitle: c.feeId?.title || 'Fee Payment',
                        date: c.updatedAt,
                        status: c.status
                    })),
                    expenses: recentExpenses.map(e => ({
                        _id: e._id,
                        amount: e.amount,
                        title: e.title,
                        category: e.category,
                        date: e.date || e.createdAt,
                        status: e.status
                    }))
                },

                filter: {
                    period,
                    dateRange: period !== 'all' ? dateRange : null,
                    startDate: startDate || null,
                    endDate: endDate || null
                }
            }
        });

    } catch (error) {
        console.error("Error getting cash account details:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const deleteCashAccount = async (req, res) => {
    try {
        const cashAccount = await CashAccount.findOne({
            school: req.user.school,
            isActive: true
        });

        if (!cashAccount) {
            return res.status(404).json({
                success: false,
                message: "Cash account not found"
            });
        }

        const FeePayment = require('../models/FeePayment');
        const Expense = require('../models/Expense');

        const [feePayments, expenses] = await Promise.all([
            FeePayment.findOne({
                school: req.user.school,
                cashAccountId: cashAccount._id
            }),
            Expense.findOne({
                school: req.user.school,
                cashAccountId: cashAccount._id
            })
        ]);

        if (feePayments || expenses) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete cash account with existing transactions."
            });
        }

        cashAccount.isActive = false;
        cashAccount.updatedBy = req.user._id;
        await cashAccount.save();

        res.status(200).json({
            success: true,
            message: "Cash account deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    createCashAccount,
    getCashAccount,
    getCashAccountDetails,
    updateCashAccount,
    deleteCashAccount
};