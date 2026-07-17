const mongoose = require("mongoose");
const FeePayment = require("../models/FeePayment");
const Expense = require("../models/Expense");
const BankAccount = require("../models/BankAccount");
const CashAccount = require("../models/CashAccount");
const FeeDetail = require("../models/FeeDetail");
const SalarySlip = require("../models/SalarySlip");

const getDateRange = (period, startDate, endDate, year, month) => {
    const now = new Date();
    let start, end;

    if (startDate && endDate) {
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return { start, end, label: 'custom' };
    }

    if (year && month) {
        start = new Date(year, month - 1, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(year, month, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end, label: `${year}-${String(month).padStart(2, '0')}` };
    }

    if (year) {
        start = new Date(year, 0, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(year, 11, 31);
        end.setHours(23, 59, 59, 999);
        return { start, end, label: `${year}` };
    }

    // Period based
    switch (period) {
        case 'today':
            start = new Date();
            start.setHours(0, 0, 0, 0);
            end = new Date();
            end.setHours(23, 59, 59, 999);
            return { start, end, label: 'today' };

        case 'yesterday':
            start = new Date();
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            end = new Date();
            end.setDate(end.getDate() - 1);
            end.setHours(23, 59, 59, 999);
            return { start, end, label: 'yesterday' };

        case 'this_week':
            const day = now.getDay();
            start = new Date(now);
            start.setDate(now.getDate() - day);
            start.setHours(0, 0, 0, 0);
            end = new Date(now);
            end.setHours(23, 59, 59, 999);
            return { start, end, label: 'this_week' };

        case 'this_month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
            return { start, end, label: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` };

        case 'last_month':
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
            end.setHours(23, 59, 59, 999);
            return { start, end, label: `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}` };

        case 'this_year':
            start = new Date(now.getFullYear(), 0, 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(now.getFullYear(), 11, 31);
            end.setHours(23, 59, 59, 999);
            return { start, end, label: `${now.getFullYear()}` };

        case 'last_year':
            start = new Date(now.getFullYear() - 1, 0, 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(now.getFullYear() - 1, 11, 31);
            end.setHours(23, 59, 59, 999);
            return { start, end, label: `${now.getFullYear() - 1}` };

        case 'all':
            start = null;
            end = null;
            return { start, end, label: 'all' };

        default:
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
            return { start, end, label: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` };
    }
};

const parseDateString = (dateStr) => {
    if (!dateStr) return null;

    // Format: YYYY (e.g., 2027)
    if (/^\d{4}$/.test(dateStr)) {
        return new Date(parseInt(dateStr), 0, 1);
    }

    // Format: YYYY-MM (e.g., 2027-09)
    if (/^\d{4}-\d{2}$/.test(dateStr)) {
        const [year, month] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, 1);
    }

    // Format: YYYY-MM-DD (e.g., 2027-09-15)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Date(dateStr);
    }

    // Try direct parsing
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }

    return null;
};

const getDetailReporting = async (req, res) => {
    try {
        const schoolId = req.user.school || req.user._id;
        const {
            period = 'this_month',
            startDate,
            endDate,
            year,
            month,
            breakdown = 'false'
        } = req.query;

        const { start, end, label } = getDateRange(period, startDate, endDate, year, month);

        const dateFilter = {};
        const feeDateFilter = {};
        const expenseDateFilter = {};

        if (start && end) {
            dateFilter.createdAt = { $gte: start, $lte: end };
            feeDateFilter.updatedAt = { $gte: start, $lte: end };
            expenseDateFilter.date = { $gte: start, $lte: end };
        }

        let openingBalance = 0;
        let previousCollections = 0;
        let previousExpenses = 0;

        const bankAccounts = await BankAccount.find({
            school: schoolId,
            isActive: true
        }).lean();

        const cashAccount = await CashAccount.findOne({
            school: schoolId,
            isActive: true
        }).lean();

        bankAccounts.forEach(acc => {
            openingBalance += acc.amount || 0;
        });
        if (cashAccount) {
            openingBalance += cashAccount.amount || 0;
        }

        if (start) {
            const previousFeeMatch = {
                school: schoolId,
                status: { $in: ['approved', 'paid'] },
                updatedAt: { $lt: start }
            };

            const previousExpenseMatch = {
                school: schoolId,
                status: { $in: ['approved', 'paid'] },
                date: { $lt: start }
            };

            const [prevCollections, prevExpenses] = await Promise.all([
                FeePayment.aggregate([
                    { $match: previousFeeMatch },
                    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
                ]),
                Expense.aggregate([
                    { $match: previousExpenseMatch },
                    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
                ])
            ]);

            previousCollections = prevCollections[0]?.total || 0;
            previousExpenses = prevExpenses[0]?.total || 0;
        }

        const midOpeningBalance = openingBalance + previousCollections - previousExpenses;

        const feeVouchers = await FeeDetail.find({
            school: schoolId,
            ...dateFilter
        }).lean();

        const feePayments = await FeePayment.find({
            school: schoolId,
            status: { $in: ['approved', 'paid'] },
            ...feeDateFilter
        }).lean();

        const totalVoucherAmount = feeVouchers.reduce((sum, v) => sum + (v.finalAmount || 0), 0);
        const totalFeePaid = feePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalFeeRemaining = totalVoucherAmount - totalFeePaid;

        let totalSalariesPaid = 0;
        let totalSalariesPending = 0;

        try {
            const paidSalaries = await SalarySlip.aggregate([
                {
                    $match: {
                        school: schoolId,
                        status: { $in: ['partial', 'paid'] },
                        ...(start && end ? { updatedAt: { $gte: start, $lte: end } } : {})
                    }
                },
                { $group: { _id: null, total: { $sum: "$paidAmount" } } }
            ]);

            const pendingSalaries = await SalarySlip.aggregate([
                {
                    $match: {
                        school: schoolId,
                        status: { $in: ['pending', 'partial'] },
                        ...(start && end ? { createdAt: { $gte: start, $lte: end } } : {})
                    }
                },
                { $group: { _id: null, total: { $sum: "$remainingAmount" } } }
            ]);

            totalSalariesPaid = paidSalaries[0]?.total || 0;
            totalSalariesPending = pendingSalaries[0]?.total || 0;
        } catch (error) {
            console.error("Error occurred while fetching salary data:", error);
        }

        const expenseData = await Expense.aggregate([
            {
                $match: {
                    school: schoolId,
                    status: { $in: ['approved', 'paid'] },
                    ...expenseDateFilter
                }
            },
            { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
        ]);

        const totalExpenses = expenseData[0]?.total || 0;
        const totalExpenseCount = expenseData[0]?.count || 0;

        let totalBankBalance = 0;
        const bankDetails = [];

        for (const account of bankAccounts) {
            const [feePaymentsForBank, expensesForBank] = await Promise.all([
                FeePayment.aggregate([
                    {
                        $match: {
                            school: schoolId,
                            bankAccountId: account._id,
                            status: { $in: ['approved', 'paid'] }
                        }
                    },
                    { $group: { _id: null, total: { $sum: "$amount" } } }
                ]),
                Expense.aggregate([
                    {
                        $match: {
                            school: schoolId,
                            bankAccountId: account._id,
                            status: { $in: ['approved', 'paid'] }
                        }
                    },
                    { $group: { _id: null, total: { $sum: "$amount" } } }
                ])
            ]);

            const received = feePaymentsForBank[0]?.total || 0;
            const paid = expensesForBank[0]?.total || 0;
            const balance = (account.amount || 0) + received - paid;
            totalBankBalance += balance;

            bankDetails.push({
                _id: account._id,
                name: account.bankName,
                accountNumber: account.accountNumber,
                balance: Math.round(balance * 100) / 100
            });
        }

        let totalCashBalance = 0;
        let cashDetails = null;

        if (cashAccount) {
            const [feePaymentsForCash, expensesForCash] = await Promise.all([
                FeePayment.aggregate([
                    {
                        $match: {
                            school: schoolId,
                            cashAccountId: cashAccount._id,
                            status: { $in: ['approved', 'paid'] }
                        }
                    },
                    { $group: { _id: null, total: { $sum: "$amount" } } }
                ]),
                Expense.aggregate([
                    {
                        $match: {
                            school: schoolId,
                            cashAccountId: cashAccount._id,
                            status: { $in: ['approved', 'paid'] }
                        }
                    },
                    { $group: { _id: null, total: { $sum: "$amount" } } }
                ])
            ]);

            const received = feePaymentsForCash[0]?.total || 0;
            const paid = expensesForCash[0]?.total || 0;
            totalCashBalance = (cashAccount.amount || 0) + received - paid;

            cashDetails = {
                _id: cashAccount._id,
                name: cashAccount.title,
                balance: Math.round(totalCashBalance * 100) / 100
            };
        }

        const totalRevenue = totalFeePaid;
        const totalCost = totalExpenses + totalSalariesPaid;
        const netProfit = totalRevenue - totalCost;

        const response = {
            success: true,
            period: label,
            dateRange: start && end ? { start, end } : null,

            openingBalanceSummary: {
                accountOpeningBalance: Math.round(openingBalance * 100) / 100,
                previousCollections: Math.round(previousCollections * 100) / 100,
                previousExpenses: Math.round(previousExpenses * 100) / 100,
                previousNet: Math.round((previousCollections - previousExpenses) * 100) / 100,
                midOpeningBalance: Math.round(midOpeningBalance * 100) / 100
            },

            totals: {
                totalVoucherAmount: Math.round(totalVoucherAmount * 100) / 100,
                totalFeePaid: Math.round(totalFeePaid * 100) / 100,
                totalFeeRemaining: Math.round(totalFeeRemaining * 100) / 100,
                totalVouchers: feeVouchers.length,
                totalFeePayments: feePayments.length,

                totalSalariesPaid: Math.round(totalSalariesPaid * 100) / 100,
                totalSalariesPending: Math.round(totalSalariesPending * 100) / 100,

                totalExpenses: Math.round(totalExpenses * 100) / 100,
                totalExpenseCount,

                totalBankBalance: Math.round(totalBankBalance * 100) / 100,
                totalCashBalance: Math.round(totalCashBalance * 100) / 100,
                totalBalance: Math.round((totalBankBalance + totalCashBalance) * 100) / 100,

                totalRevenue: Math.round(totalRevenue * 100) / 100,
                totalCost: Math.round(totalCost * 100) / 100,
                netProfit: Math.round(netProfit * 100) / 100,

                collectionRate: totalVoucherAmount > 0
                    ? Math.round((totalFeePaid / totalVoucherAmount) * 100 * 100) / 100
                    : 0,
                profitMargin: totalRevenue > 0
                    ? Math.round((netProfit / totalRevenue) * 100 * 100) / 100
                    : 0,
                expenseRatio: totalRevenue > 0
                    ? Math.round((totalExpenses / totalRevenue) * 100 * 100) / 100
                    : 0,
                salaryRatio: totalRevenue > 0
                    ? Math.round((totalSalariesPaid / totalRevenue) * 100 * 100) / 100
                    : 0
            }
        };

        if (breakdown === 'true') {
            const feeStatusBreakdown = await FeeDetail.aggregate([
                {
                    $match: {
                        school: schoolId,
                        ...dateFilter
                    }
                },
                {
                    $group: {
                        _id: "$status",
                        total: { $sum: "$finalAmount" },
                        count: { $sum: 1 }
                    }
                }
            ]);

            const expenseCategoryBreakdown = await Expense.aggregate([
                {
                    $match: {
                        school: schoolId,
                        status: { $in: ['approved', 'paid'] },
                        ...expenseDateFilter
                    }
                },
                {
                    $group: {
                        _id: "$category",
                        total: { $sum: "$amount" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { total: -1 } }
            ]);

            const paymentMethodBreakdown = await FeePayment.aggregate([
                {
                    $match: {
                        school: schoolId,
                        status: { $in: ['approved', 'paid'] },
                        ...feeDateFilter
                    }
                },
                {
                    $group: {
                        _id: "$paymentMethod",
                        total: { $sum: "$amount" },
                        count: { $sum: 1 }
                    }
                }
            ]);

            response.breakdown = {
                feeStatus: feeStatusBreakdown.map(item => ({
                    status: item._id,
                    total: Math.round(item.total * 100) / 100,
                    count: item.count
                })),
                expenseCategories: expenseCategoryBreakdown.map(item => ({
                    category: item._id || 'uncategorized',
                    total: Math.round(item.total * 100) / 100,
                    count: item.count,
                    percentage: totalExpenses > 0
                        ? Math.round((item.total / totalExpenses) * 100 * 100) / 100
                        : 0
                })),
                paymentMethods: paymentMethodBreakdown.map(item => ({
                    method: item._id || 'unknown',
                    total: Math.round(item.total * 100) / 100,
                    count: item.count,
                    percentage: totalFeePaid > 0
                        ? Math.round((item.total / totalFeePaid) * 100 * 100) / 100
                        : 0
                })),
                bankAccounts: bankDetails,
                cashAccount: cashDetails
            };

            if (period === 'this_year' || period === 'last_year' || (start && end)) {
                const monthlyFees = await FeePayment.aggregate([
                    {
                        $match: {
                            school: schoolId,
                            status: { $in: ['approved', 'paid'] },
                            ...feeDateFilter
                        }
                    },
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%m", date: "$updatedAt" } },
                            total: { $sum: "$amount" },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]);

                const monthlyExpenses = await Expense.aggregate([
                    {
                        $match: {
                            school: schoolId,
                            status: { $in: ['approved', 'paid'] },
                            ...expenseDateFilter
                        }
                    },
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
                            total: { $sum: "$amount" },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]);

                let monthlySalaries = [];
                try {
                    monthlySalaries = await SalarySlip.aggregate([
                        {
                            $match: {
                                school: schoolId,
                                status: { $in: ['paid', 'approved'] },
                                ...(start && end ? { updatedAt: { $gte: start, $lte: end } } : {})
                            }
                        },
                        {
                            $group: {
                                _id: { $dateToString: { format: "%Y-%m", date: "$updatedAt" } },
                                total: { $sum: "$amount" },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ]);
                } catch (error) { }

                const allMonths = new Set([
                    ...monthlyFees.map(m => m._id),
                    ...monthlyExpenses.map(m => m._id),
                    ...monthlySalaries.map(m => m._id)
                ]);

                const monthlyData = {};
                allMonths.forEach(month => {
                    const fee = monthlyFees.find(m => m._id === month);
                    const expense = monthlyExpenses.find(m => m._id === month);
                    const salary = monthlySalaries.find(m => m._id === month);

                    const income = fee?.total || 0;
                    const cost = (expense?.total || 0) + (salary?.total || 0);

                    monthlyData[month] = {
                        income: Math.round(income * 100) / 100,
                        expense: Math.round((expense?.total || 0) * 100) / 100,
                        salary: Math.round((salary?.total || 0) * 100) / 100,
                        totalCost: Math.round(cost * 100) / 100,
                        profit: Math.round((income - cost) * 100) / 100,
                        feeCount: fee?.count || 0,
                        expenseCount: expense?.count || 0
                    };
                });

                response.breakdown.monthly = monthlyData;
            }
        }

        res.status(200).json(response);

    } catch (error) {
        console.error("Error getting dashboard:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getAccountRunningBalance = async (req, res) => {
    try {
        const schoolId = req.user.school || req.user._id;
        const { accountId } = req.params;
        const {
            accountType,
            startDate,
            endDate,
            includeAll = 'false'
        } = req.query;

        if (!accountType || !['bank', 'cash'].includes(accountType)) {
            return res.status(400).json({
                success: false,
                message: "accountType is required and must be 'bank' or 'cash'"
            });
        }

        let account;
        let openingBalance;
        let accountDetails = { type: accountType };

        if (accountType === 'bank') {
            account = await BankAccount.findOne({
                _id: accountId,
                school: schoolId,
                isActive: true
            });
            if (!account) {
                return res.status(404).json({
                    success: false,
                    message: "Bank account not found"
                });
            }
            openingBalance = account.amount || 0;
            accountDetails = {
                _id: account._id,
                type: 'bank',
                bankName: account.bankName,
                accountNumber: account.accountNumber,
                branchName: account.branchName,
                openingBalance: openingBalance
            };
        } else if (accountType === 'cash') {
            account = await CashAccount.findOne({
                _id: accountId,
                school: schoolId,
                isActive: true
            });
            if (!account) {
                return res.status(404).json({
                    success: false,
                    message: "Cash account not found"
                });
            }
            openingBalance = account.amount || 0;
            accountDetails = {
                _id: account._id,
                type: 'cash',
                title: account.title,
                description: account.description,
                openingBalance: openingBalance
            };
        }

        let start, end;
        let filterStartDate = null;
        let filterEndDate = null;

        if (startDate) {
            const parsedStart = parseDateString(startDate);
            if (!parsedStart) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid start date format. Use YYYY, YYYY-MM, or YYYY-MM-DD"
                });
            }
            start = new Date(parsedStart);
            start.setHours(0, 0, 0, 0);
            filterStartDate = start;
        }

        if (endDate) {
            const parsedEnd = parseDateString(endDate);
            if (!parsedEnd) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid end date format. Use YYYY, YYYY-MM, or YYYY-MM-DD"
                });
            }
            end = new Date(parsedEnd);
            if (/^\d{4}$/.test(endDate)) {
                end = new Date(parseInt(endDate), 11, 31);
                end.setHours(23, 59, 59, 999);
            } else if (/^\d{4}-\d{2}$/.test(endDate)) {
                const [year, month] = endDate.split('-').map(Number);
                end = new Date(year, month, 0);
                end.setHours(23, 59, 59, 999);
            } else {
                end.setHours(23, 59, 59, 999);
            }
            filterEndDate = end;
        }

        if (!startDate && !endDate) {
            const dateRange = getDateRange('this_month');
            start = dateRange.start;
            end = dateRange.end;
            filterStartDate = start;
            filterEndDate = end;
        }

        if (startDate && !endDate) {
            if (/^\d{4}$/.test(startDate)) {
                end = new Date(parseInt(startDate), 11, 31);
                end.setHours(23, 59, 59, 999);
            } else if (/^\d{4}-\d{2}$/.test(startDate)) {
                const [year, month] = startDate.split('-').map(Number);
                end = new Date(year, month, 0);
                end.setHours(23, 59, 59, 999);
            } else {
                end = new Date(start);
                end.setHours(23, 59, 59, 999);
            }
            filterEndDate = end;
        }

        const baseFilter = {
            school: schoolId,
            status: { $in: ['approved', 'paid'] }
        };

        if (accountType === 'bank') {
            baseFilter.bankAccountId = new mongoose.Types.ObjectId(accountId);
            baseFilter.paymentMethod = 'bank';
        } else {
            baseFilter.cashAccountId = new mongoose.Types.ObjectId(accountId);
            baseFilter.paymentMethod = 'cash';
        }

        let previousCredits = 0;
        let previousDebits = 0;

        if (filterStartDate && includeAll === 'false') {
            const previousFilter = {
                ...baseFilter,
                updatedAt: { $lt: filterStartDate }
            };

            const [prevFeePayments, prevExpenses] = await Promise.all([
                FeePayment.find(previousFilter)
                    .lean()
                    .sort({ createdAt: 1 }),
                Expense.find({
                    ...baseFilter,
                    date: { $lt: filterStartDate }
                })
                    .lean()
                    .sort({ date: 1, createdAt: 1 })
            ]);

            previousCredits = prevFeePayments.reduce((sum, p) => sum + p.amount, 0);
            previousDebits = prevExpenses.reduce((sum, e) => sum + e.amount, 0);
        }

        const midOpeningBalance = openingBalance + previousCredits - previousDebits;

        let feePayments = [];
        let expenses = [];

        if (includeAll === 'true') {
            [feePayments, expenses] = await Promise.all([
                FeePayment.find(baseFilter)
                    .populate('feeId', 'title month finalAmount discountAmount')
                    .populate('studentId', 'name registrationNumber')
                    .lean()
                    .sort({ createdAt: 1 }),
                Expense.find(baseFilter)
                    .lean()
                    .sort({ date: 1, createdAt: 1 })
            ]);
        } else if (filterStartDate && filterEndDate) {
            // Get transactions within date range
            [feePayments, expenses] = await Promise.all([
                FeePayment.find({
                    ...baseFilter,
                    updatedAt: { $gte: filterStartDate, $lte: filterEndDate }
                })
                    .populate('feeId', 'title month finalAmount discountAmount')
                    .populate('studentId', 'name registrationNumber')
                    .lean()
                    .sort({ createdAt: 1 }),
                Expense.find({
                    ...baseFilter,
                    date: { $gte: filterStartDate, $lte: filterEndDate }
                })
                    .lean()
                    .sort({ date: 1, createdAt: 1 })
            ]);
        } else {
            // No date filter - get all
            [feePayments, expenses] = await Promise.all([
                FeePayment.find(baseFilter)
                    .populate('feeId', 'title month finalAmount discountAmount')
                    .populate('studentId', 'name registrationNumber')
                    .lean()
                    .sort({ createdAt: 1 }),
                Expense.find(baseFilter)
                    .lean()
                    .sort({ date: 1, createdAt: 1 })
            ]);
        }

        const transactions = [];

        // Add fee payments as credit transactions
        feePayments.forEach(payment => {
            const paymentDate = payment.updatedAt || payment.createdAt;
            transactions.push({
                _id: payment._id,
                type: 'fee_payment',
                transactionType: 'credit',
                amount: payment.amount,
                date: paymentDate,
                description: `Fee Payment - ${payment.feeId?.title || 'Fee'}`,
                studentName: payment.studentId?.name || 'Unknown Student',
                feeMonth: payment.feeId?.month || '',
                status: payment.status,
                reference: payment._id.toString(),
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt
            });
        });

        // Add expenses as debit transactions
        expenses.forEach(expense => {
            const expenseDate = expense.date || expense.createdAt;
            transactions.push({
                _id: expense._id,
                type: 'expense',
                transactionType: 'debit',
                amount: expense.amount,
                date: expenseDate,
                description: expense.title || 'Expense',
                category: expense.category || 'other',
                status: expense.status,
                reference: expense._id.toString(),
                createdAt: expense.createdAt,
                updatedAt: expense.updatedAt
            });
        });

        // Sort by date
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        let runningBalance = midOpeningBalance;
        const allTransactionHistory = transactions.map(transaction => {
            if (transaction.transactionType === 'credit') {
                runningBalance += transaction.amount;
            } else if (transaction.transactionType === 'debit') {
                runningBalance -= transaction.amount;
            }

            return {
                ...transaction,
                runningBalance: runningBalance
            };
        });

        const totalCredits = feePayments.reduce((sum, p) => sum + p.amount, 0);
        const totalDebits = expenses.reduce((sum, e) => sum + e.amount, 0);
        const currentBalance = midOpeningBalance + totalCredits - totalDebits;

        res.status(200).json({
            success: true,
            account: accountDetails,
            dateRange: includeAll === 'false' && filterStartDate && filterEndDate ? { start, end } : null,
            isAllTime: includeAll === 'true',

            openingBalanceSummary: {
                accountOpeningBalance: openingBalance,
                previousCredits: previousCredits,
                previousDebits: previousDebits,
                midOpeningBalance: midOpeningBalance
            },

            summary: {
                openingBalance: openingBalance,
                midOpeningBalance: midOpeningBalance,
                totalCredits: totalCredits,
                totalDebits: totalDebits,
                currentBalance: currentBalance,
                totalTransactions: allTransactionHistory.length,
                creditCount: feePayments.length,
                debitCount: expenses.length,
                netChange: totalCredits - totalDebits
            },
            transactions: allTransactionHistory,
            currentBalance: currentBalance
        });

    } catch (error) {
        console.error("Error getting account running balance:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getOverallSchoolRunningBalance = async (req, res) => {
    try {
        const schoolId = req.user.school || req.user._id;
        const {
            startDate,
            endDate,
            includeAll = 'false'
        } = req.query;

          let start, end;
        let filterStartDate = null;
        let filterEndDate = null;

        const parseDateEnhanced = (dateStr) => {
            if (!dateStr) return null;

            if (/^\d{4}$/.test(dateStr)) {
                return new Date(parseInt(dateStr), 0, 1);
            }

            if (/^\d{4}-\d{2}$/.test(dateStr)) {
                const [year, month] = dateStr.split('-').map(Number);
                return new Date(year, month - 1, 1);
            }

            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return new Date(dateStr);
            }

            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
                return parsed;
            }

            return null;
        };

        if (startDate) {
            const parsedStart = parseDateEnhanced(startDate);
            if (!parsedStart) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid start date format. Use YYYY, YYYY-MM, or YYYY-MM-DD"
                });
            }
            start = new Date(parsedStart);
            start.setHours(0, 0, 0, 0);
            filterStartDate = start;
        }

        if (endDate) {
            const parsedEnd = parseDateEnhanced(endDate);
            if (!parsedEnd) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid end date format. Use YYYY, YYYY-MM, or YYYY-MM-DD"
                });
            }
            end = new Date(parsedEnd);
            if (/^\d{4}$/.test(endDate)) {
                end = new Date(parseInt(endDate), 11, 31);
                end.setHours(23, 59, 59, 999);
            } else if (/^\d{4}-\d{2}$/.test(endDate)) {
                const [year, month] = endDate.split('-').map(Number);
                end = new Date(year, month, 0);
                end.setHours(23, 59, 59, 999);
            } else {
                end.setHours(23, 59, 59, 999);
            }
            filterEndDate = end;
        }

        if (!startDate && !endDate) {
            const dateRange = getDateRange('this_month');
            start = dateRange.start;
            end = dateRange.end;
            filterStartDate = start;
            filterEndDate = end;
        }

        if (startDate && !endDate) {
            if (/^\d{4}$/.test(startDate)) {
                end = new Date(parseInt(startDate), 11, 31);
                end.setHours(23, 59, 59, 999);
            } else if (/^\d{4}-\d{2}$/.test(startDate)) {
                const [year, month] = startDate.split('-').map(Number);
                end = new Date(year, month, 0);
                end.setHours(23, 59, 59, 999);
            } else {
                end = new Date(start);
                end.setHours(23, 59, 59, 999);
            }
            filterEndDate = end;
        }

        const bankAccounts = await BankAccount.find({
            school: schoolId,
            isActive: true
        }).lean();

        const cashAccount = await CashAccount.findOne({
            school: schoolId,
            isActive: true
        }).lean();

        const accountIds = {
            bank: bankAccounts.map(acc => acc._id),
            cash: cashAccount ? [cashAccount._id] : []
        };

        const bankFilters = accountIds.bank.map(id => ({
            bankAccountId: new mongoose.Types.ObjectId(id),
            paymentMethod: 'bank'
        }));

        const cashFilters = accountIds.cash.map(id => ({
            cashAccountId: new mongoose.Types.ObjectId(id),
            paymentMethod: 'cash'
        }));

        const allFilters = [...bankFilters, ...cashFilters];

        let totalOpeningBalance = 0;
        const accountDetails = [];

        for (const account of bankAccounts) {
            const balance = account.amount || 0;
            totalOpeningBalance += balance;
            accountDetails.push({
                _id: account._id,
                type: 'bank',
                name: account.bankName,
                accountNumber: account.accountNumber,
                branchName: account.branchName,
                openingBalance: balance
            });
        }

        if (cashAccount) {
            const balance = cashAccount.amount || 0;
            totalOpeningBalance += balance;
            accountDetails.push({
                _id: cashAccount._id,
                type: 'cash',
                name: cashAccount.title,
                description: cashAccount.description,
                openingBalance: balance
            });
        }

        let previousCredits = 0;
        let previousDebits = 0;

        if (filterStartDate && includeAll === 'false') {
            const previousFeeMatch = {
                school: schoolId,
                status: { $in: ['approved', 'paid'] },
                $or: allFilters.length > 0 ? allFilters : [{ _id: null }],
                updatedAt: { $lt: filterStartDate }
            };

            const previousExpenseMatch = {
                school: schoolId,
                status: { $in: ['approved', 'paid'] },
                $or: allFilters.length > 0 ? allFilters : [{ _id: null }],
                date: { $lt: filterStartDate }
            };

            const [prevFeePayments, prevExpenses] = await Promise.all([
                FeePayment.find(previousFeeMatch).lean(),
                Expense.find(previousExpenseMatch).lean()
            ]);

            previousCredits = prevFeePayments.reduce((sum, p) => sum + p.amount, 0);
            previousDebits = prevExpenses.reduce((sum, e) => sum + e.amount, 0);
        }

        const midOpeningBalance = totalOpeningBalance + previousCredits - previousDebits;

        const feeMatch = {
            school: schoolId,
            status: { $in: ['approved', 'paid'] },
            $or: allFilters.length > 0 ? allFilters : [{ _id: null }]
        };

        const expenseMatch = {
            school: schoolId,
            status: { $in: ['approved', 'paid'] },
            $or: allFilters.length > 0 ? allFilters : [{ _id: null }]
        };

        if (includeAll === 'false' && filterStartDate && filterEndDate) {
            feeMatch.updatedAt = { $gte: filterStartDate, $lte: filterEndDate };
            expenseMatch.date = { $gte: filterStartDate, $lte: filterEndDate };
        }

        const feePayments = await FeePayment.find(feeMatch)
            .populate('feeId', 'title month finalAmount discountAmount')
            .populate('studentId', 'name registrationNumber')
            .populate('bankAccountId', 'bankName accountNumber')
            .populate('cashAccountId', 'title')
            .lean()
            .sort({ updatedAt: 1, createdAt: 1 });

        const expenses = await Expense.find(expenseMatch)
            .populate('bankAccountId', 'bankName accountNumber')
            .populate('cashAccountId', 'title')
            .lean()
            .sort({ date: 1, createdAt: 1 });

        const transactions = [];

        feePayments.forEach(payment => {
            const paymentDate = payment.updatedAt || payment.createdAt;
            const accountInfo = payment.bankAccountId
                ? { type: 'bank', name: payment.bankAccountId.bankName, accountNumber: payment.bankAccountId.accountNumber }
                : { type: 'cash', name: payment.cashAccountId?.title || 'Cash' };

            transactions.push({
                _id: payment._id,
                type: 'fee_payment',
                transactionType: 'credit',
                amount: payment.amount,
                date: paymentDate,
                description: `Fee Payment - ${payment.feeId?.title || 'Fee'}`,
                studentName: payment.studentId?.name || 'Unknown Student',
                feeMonth: payment.feeId?.month || '',
                status: payment.status,
                account: accountInfo,
                paymentMethod: payment.paymentMethod,
                reference: payment._id.toString(),
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt
            });
        });

        expenses.forEach(expense => {
            const expenseDate = expense.date || expense.createdAt;
            const accountInfo = expense.bankAccountId
                ? { type: 'bank', name: expense.bankAccountId.bankName, accountNumber: expense.bankAccountId.accountNumber }
                : { type: 'cash', name: expense.cashAccountId?.title || 'Cash' };

            transactions.push({
                _id: expense._id,
                type: 'expense',
                transactionType: 'debit',
                amount: expense.amount,
                date: expenseDate,
                description: expense.title || 'Expense',
                category: expense.category || 'other',
                status: expense.status,
                account: accountInfo,
                paymentMethod: expense.paymentMethod,
                reference: expense._id.toString(),
                createdAt: expense.createdAt,
                updatedAt: expense.updatedAt
            });
        });

        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        let runningBalance = midOpeningBalance;
        const transactionHistory = transactions.map(transaction => {
            if (transaction.transactionType === 'credit') {
                runningBalance += transaction.amount;
            } else if (transaction.transactionType === 'debit') {
                runningBalance -= transaction.amount;
            }

            return {
                ...transaction,
                runningBalance: runningBalance
            };
        });

        const totalCredits = feePayments.reduce((sum, p) => sum + p.amount, 0);
        const totalDebits = expenses.reduce((sum, e) => sum + e.amount, 0);
        const currentBalance = midOpeningBalance + totalCredits - totalDebits;

        const accountTypeSummary = {
            bank: {
                accounts: bankAccounts.length,
                openingBalance: bankAccounts.reduce((sum, acc) => sum + (acc.amount || 0), 0),
                totalReceived: 0,
                totalPaid: 0,
                currentBalance: 0
            },
            cash: {
                accounts: cashAccount ? 1 : 0,
                openingBalance: cashAccount ? (cashAccount.amount || 0) : 0,
                totalReceived: 0,
                totalPaid: 0,
                currentBalance: 0
            }
        };

        const bankFeePayments = feePayments.filter(p => p.paymentMethod === 'bank');
        const cashFeePayments = feePayments.filter(p => p.paymentMethod === 'cash');
        const bankExpenses = expenses.filter(e => e.paymentMethod === 'bank');
        const cashExpenses = expenses.filter(e => e.paymentMethod === 'cash');

        accountTypeSummary.bank.totalReceived = bankFeePayments.reduce((sum, p) => sum + p.amount, 0);
        accountTypeSummary.bank.totalPaid = bankExpenses.reduce((sum, e) => sum + e.amount, 0);
        accountTypeSummary.bank.currentBalance = accountTypeSummary.bank.openingBalance +
            accountTypeSummary.bank.totalReceived - accountTypeSummary.bank.totalPaid;

        accountTypeSummary.cash.totalReceived = cashFeePayments.reduce((sum, p) => sum + p.amount, 0);
        accountTypeSummary.cash.totalPaid = cashExpenses.reduce((sum, e) => sum + e.amount, 0);
        accountTypeSummary.cash.currentBalance = accountTypeSummary.cash.openingBalance +
            accountTypeSummary.cash.totalReceived - accountTypeSummary.cash.totalPaid;

       res.status(200).json({
            success: true,
            dateRange: includeAll === 'false' && filterStartDate && filterEndDate ? { start, end } : null,
            isAllTime: includeAll === 'true',

            accounts: accountDetails,

            openingBalanceSummary: {
                totalOpeningBalance: totalOpeningBalance,
                previousCredits: previousCredits,
                previousDebits: previousDebits,
                midOpeningBalance: midOpeningBalance
            },

            summary: {
                totalAccounts: accountDetails.length,
                totalBankAccounts: bankAccounts.length,
                hasCashAccount: !!cashAccount,
                totalOpeningBalance: totalOpeningBalance,
                midOpeningBalance: midOpeningBalance,
                totalCredits: totalCredits,
                totalDebits: totalDebits,
                currentBalance: currentBalance,
                totalTransactions: transactionHistory.length,
                creditCount: feePayments.length,
                debitCount: expenses.length,
                netChange: totalCredits - totalDebits
            },
            accountTypeSummary,
            transactions: transactionHistory,
            currentBalance: currentBalance
        });

    } catch (error) {
        console.error("Error getting overall school running balance:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getNetProfit = async (req, res) => {
    try {
        const schoolId = req.user.school || req.user._id;
        const {
            period = 'this_month',
            startDate,
            endDate,
            category,
            accountType,
            accountId,
        } = req.query;

        // ============================================================
        // 1. ENHANCED DATE PARSING
        // ============================================================
        let start, end;
        let filterStartDate = null;
        let filterEndDate = null;

        const parseDateEnhanced = (dateStr) => {
            if (!dateStr) return null;
            
            // Format: YYYY (e.g., 2027)
            if (/^\d{4}$/.test(dateStr)) {
                return new Date(parseInt(dateStr), 0, 1);
            }
            
            // Format: YYYY-MM (e.g., 2027-09)
            if (/^\d{4}-\d{2}$/.test(dateStr)) {
                const [year, month] = dateStr.split('-').map(Number);
                return new Date(year, month - 1, 1);
            }
            
            // Format: YYYY-MM-DD (e.g., 2027-09-15)
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return new Date(dateStr);
            }
            
            // Try direct parsing
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
                return parsed;
            }
            
            return null;
        };

        if (period === 'all') {
            start = null;
            end = null;
        } else if (startDate && endDate) {
            const parsedStart = parseDateEnhanced(startDate);
            const parsedEnd = parseDateEnhanced(endDate);

            if (!parsedStart || !parsedEnd) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid date format. Use YYYY, YYYY-MM, or YYYY-MM-DD"
                });
            }

            start = new Date(parsedStart);
            start.setHours(0, 0, 0, 0);

            end = new Date(parsedEnd);
            if (/^\d{4}$/.test(endDate)) {
                // Year only - set to December 31
                end = new Date(parseInt(endDate), 11, 31);
                end.setHours(23, 59, 59, 999);
            } else if (/^\d{4}-\d{2}$/.test(endDate)) {
                // Month only - set to last day of month
                const [year, month] = endDate.split('-').map(Number);
                end = new Date(year, month, 0);
                end.setHours(23, 59, 59, 999);
            } else {
                end.setHours(23, 59, 59, 999);
            }
        } else if (startDate && !endDate) {
            // Only start date provided
            const parsedStart = parseDateEnhanced(startDate);
            if (!parsedStart) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid start date format. Use YYYY, YYYY-MM, or YYYY-MM-DD"
                });
            }
            start = new Date(parsedStart);
            start.setHours(0, 0, 0, 0);

            // Auto-set end date to end of period
            if (/^\d{4}$/.test(startDate)) {
                // Year only - end at December 31
                end = new Date(parseInt(startDate), 11, 31);
                end.setHours(23, 59, 59, 999);
            } else if (/^\d{4}-\d{2}$/.test(startDate)) {
                // Month only - end at last day of month
                const [year, month] = startDate.split('-').map(Number);
                end = new Date(year, month, 0);
                end.setHours(23, 59, 59, 999);
            } else {
                // Full date - end at same day
                end = new Date(start);
                end.setHours(23, 59, 59, 999);
            }
        } else {
            const dateRange = getDateRange(period);
            start = dateRange.start;
            end = dateRange.end;
        }

        filterStartDate = start;
        filterEndDate = end;

        // ============================================================
        // 2. BUILD FEE PAYMENT FILTER
        // ============================================================
        const feeFilter = {
            school: schoolId,
            status: { $in: ['approved', 'paid'] }
        };

        if (period !== 'all' && start && end) {
            feeFilter.updatedAt = { $gte: start, $lte: end };
        }

        // Add account filtering
        if (accountType) {
            if (accountType === 'bank') {
                if (accountId) {
                    feeFilter.bankAccountId = new mongoose.Types.ObjectId(accountId);
                } else {
                    feeFilter.bankAccountId = { $ne: null };
                }
                feeFilter.paymentMethod = 'bank';
            } else if (accountType === 'cash') {
                if (accountId) {
                    feeFilter.cashAccountId = new mongoose.Types.ObjectId(accountId);
                } else {
                    const cashAccount = await CashAccount.findOne({
                        school: schoolId,
                        isActive: true
                    });
                    if (cashAccount) {
                        feeFilter.cashAccountId = cashAccount._id;
                    } else {
                        feeFilter.cashAccountId = { $ne: null };
                    }
                }
                feeFilter.paymentMethod = 'cash';
            }
        }

        // ============================================================
        // 3. BUILD EXPENSE FILTER
        // ============================================================
        const expenseFilter = {
            school: schoolId,
            status: { $in: ['approved', 'paid'] }
        };

        if (period !== 'all' && start && end) {
            expenseFilter.date = { $gte: start, $lte: end };
        }

        // Add account filtering
        if (accountType) {
            if (accountType === 'bank') {
                if (accountId) {
                    expenseFilter.bankAccountId = new mongoose.Types.ObjectId(accountId);
                } else {
                    expenseFilter.bankAccountId = { $ne: null };
                }
                expenseFilter.paymentMethod = 'bank';
            } else if (accountType === 'cash') {
                if (accountId) {
                    expenseFilter.cashAccountId = new mongoose.Types.ObjectId(accountId);
                } else {
                    const cashAccount = await CashAccount.findOne({
                        school: schoolId,
                        isActive: true
                    });
                    if (cashAccount) {
                        expenseFilter.cashAccountId = cashAccount._id;
                    } else {
                        expenseFilter.cashAccountId = { $ne: null };
                    }
                }
                expenseFilter.paymentMethod = 'cash';
            }
        }

        if (category) {
            expenseFilter.category = category;
        }

        // ============================================================
        // 4. GET PREVIOUS PERIOD TRANSACTIONS (For opening balance)
        // ============================================================
        let previousIncome = 0;
        let previousExpenses = 0;

        if (filterStartDate && period !== 'all') {
            const previousFeeFilter = {
                school: schoolId,
                status: { $in: ['approved', 'paid'] },
                updatedAt: { $lt: filterStartDate }
            };

            const previousExpenseFilter = {
                school: schoolId,
                status: { $in: ['approved', 'paid'] },
                date: { $lt: filterStartDate }
            };

            // Add account filtering for previous period
            if (accountType) {
                if (accountType === 'bank') {
                    if (accountId) {
                        previousFeeFilter.bankAccountId = new mongoose.Types.ObjectId(accountId);
                        previousExpenseFilter.bankAccountId = new mongoose.Types.ObjectId(accountId);
                    } else {
                        previousFeeFilter.bankAccountId = { $ne: null };
                        previousExpenseFilter.bankAccountId = { $ne: null };
                    }
                    previousFeeFilter.paymentMethod = 'bank';
                    previousExpenseFilter.paymentMethod = 'bank';
                } else if (accountType === 'cash') {
                    if (accountId) {
                        previousFeeFilter.cashAccountId = new mongoose.Types.ObjectId(accountId);
                        previousExpenseFilter.cashAccountId = new mongoose.Types.ObjectId(accountId);
                    } else {
                        const cashAccount = await CashAccount.findOne({
                            school: schoolId,
                            isActive: true
                        });
                        if (cashAccount) {
                            previousFeeFilter.cashAccountId = cashAccount._id;
                            previousExpenseFilter.cashAccountId = cashAccount._id;
                        }
                    }
                    previousFeeFilter.paymentMethod = 'cash';
                    previousExpenseFilter.paymentMethod = 'cash';
                }
            }

            if (category) {
                previousExpenseFilter.category = category;
            }

            const [prevFeeData, prevExpenseData] = await Promise.all([
                FeePayment.aggregate([
                    { $match: previousFeeFilter },
                    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
                ]),
                Expense.aggregate([
                    { $match: previousExpenseFilter },
                    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
                ])
            ]);

            previousIncome = prevFeeData[0]?.total || 0;
            previousExpenses = prevExpenseData[0]?.total || 0;
        }

        // ============================================================
        // 5. BUILD QUERIES FOR CURRENT PERIOD
        // ============================================================
        const queries = [
            // Fee income
            FeePayment.aggregate([
                { $match: feeFilter },
                {
                    $group: {
                        _id: null,
                        totalIncome: { $sum: "$amount" },
                        totalPayments: { $sum: 1 },
                        totalDiscount: { $sum: "$discountAmount" }
                    }
                }
            ]),

            // Expenses
            Expense.aggregate([
                { $match: expenseFilter },
                {
                    $group: {
                        _id: null,
                        totalExpenses: { $sum: "$amount" },
                        totalExpenseCount: { $sum: 1 }
                    }
                }
            ]),

            // Category-wise expenses
            Expense.aggregate([
                { $match: expenseFilter },
                {
                    $group: {
                        _id: "$category",
                        total: { $sum: "$amount" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { total: -1 } }
            ]),

            // Payment method breakdown - Fees
            FeePayment.aggregate([
                { $match: feeFilter },
                {
                    $group: {
                        _id: "$paymentMethod",
                        total: { $sum: "$amount" },
                        count: { $sum: 1 }
                    }
                }
            ]),

            // Payment method breakdown - Expenses
            Expense.aggregate([
                { $match: expenseFilter },
                {
                    $group: {
                        _id: "$paymentMethod",
                        total: { $sum: "$amount" },
                        count: { $sum: 1 }
                    }
                }
            ])
        ];

        // Add monthly breakdown if not all-time
        if (period !== 'all') {
            queries.push(
                FeePayment.aggregate([
                    { $match: feeFilter },
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%m", date: "$updatedAt" } },
                            total: { $sum: "$amount" },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]),
                Expense.aggregate([
                    { $match: expenseFilter },
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
                            total: { $sum: "$amount" },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } }
                ])
            );
        }

        const results = await Promise.all(queries);

        const feeIncomeData = results[0] || [];
        const expenseData = results[1] || [];
        const categoryExpenses = results[2] || [];
        const paymentMethodFees = results[3] || [];
        const paymentMethodExpenses = results[4] || [];
        const monthlyFeeIncome = results[5] || [];
        const monthlyExpenses = results[6] || [];

        // ============================================================
        // 6. PROCESS DATA
        // ============================================================
        const incomeData = feeIncomeData[0] || {
            totalIncome: 0,
            totalPayments: 0,
            totalDiscount: 0
        };

        const expenses = expenseData[0] || {
            totalExpenses: 0,
            totalExpenseCount: 0
        };

        const currentIncome = incomeData.totalIncome || 0;
        const currentExpenses = expenses.totalExpenses || 0;

        // Total income = previous + current
        const totalIncome = previousIncome + currentIncome;
        const totalExpenses = previousExpenses + currentExpenses;
        const netProfit = totalIncome - totalExpenses;
        const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0;

        // ============================================================
        // 7. CATEGORY BREAKDOWN
        // ============================================================
        const categoryBreakdown = {};
        categoryExpenses.forEach(item => {
            categoryBreakdown[item._id || 'uncategorized'] = {
                total: item.total,
                count: item.count,
                percentage: totalExpenses > 0 ? ((item.total / totalExpenses) * 100).toFixed(2) : 0
            };
        });

        // ============================================================
        // 8. PAYMENT METHOD BREAKDOWN
        // ============================================================
        const feePaymentMethods = {};
        paymentMethodFees.forEach(item => {
            feePaymentMethods[item._id || 'unknown'] = {
                total: item.total,
                count: item.count,
                percentage: totalIncome > 0 ? ((item.total / totalIncome) * 100).toFixed(2) : 0
            };
        });

        const expensePaymentMethods = {};
        paymentMethodExpenses.forEach(item => {
            expensePaymentMethods[item._id || 'unknown'] = {
                total: item.total,
                count: item.count,
                percentage: totalExpenses > 0 ? ((item.total / totalExpenses) * 100).toFixed(2) : 0
            };
        });

        // ============================================================
        // 9. MONTHLY PROFIT
        // ============================================================
        let monthlyProfit = {};
        if (period !== 'all') {
            const allMonths = new Set([
                ...monthlyFeeIncome.map(m => m._id),
                ...monthlyExpenses.map(m => m._id)
            ]);

            allMonths.forEach(month => {
                const feeMonth = monthlyFeeIncome.find(m => m._id === month);
                const expMonth = monthlyExpenses.find(m => m._id === month);
                const income = feeMonth?.total || 0;
                const expense = expMonth?.total || 0;
                monthlyProfit[month] = {
                    income,
                    expense,
                    profit: income - expense,
                    incomeCount: feeMonth?.count || 0,
                    expenseCount: expMonth?.count || 0,
                    margin: income > 0 ? ((income - expense) / income * 100).toFixed(2) : 0
                };
            });
        }

        // ============================================================
        // 10. ACCOUNT DETAILS
        // ============================================================
        let accountDetails = null;
        if (accountId && accountType) {
            if (accountType === 'bank') {
                const account = await BankAccount.findOne({
                    _id: accountId,
                    school: schoolId,
                    isActive: true
                });
                if (account) {
                    accountDetails = {
                        _id: account._id,
                        type: 'bank',
                        bankName: account.bankName,
                        accountNumber: account.accountNumber,
                        branchName: account.branchName
                    };
                }
            } else if (accountType === 'cash') {
                const account = await CashAccount.findOne({
                    _id: accountId,
                    school: schoolId,
                    isActive: true
                });
                if (account) {
                    accountDetails = {
                        _id: account._id,
                        type: 'cash',
                        title: account.title,
                        description: account.description
                    };
                }
            }
        }

        // ============================================================
        // 11. RESPONSE
        // ============================================================
        const response = {
            success: true,
            period,
            dateRange: period === 'all' ? null : { start, end },
            isAllTime: period === 'all',
            account: accountDetails,
            filter: {
                accountType: accountType || 'all',
                accountId: accountId || null,
                category: category || null
            },
            previousPeriodSummary: {
                previousIncome: Math.round(previousIncome * 100) / 100,
                previousExpenses: Math.round(previousExpenses * 100) / 100,
                previousNet: Math.round((previousIncome - previousExpenses) * 100) / 100
            },
            summary: {
                totalIncome: Math.round(totalIncome * 100) / 100,
                totalExpenses: Math.round(totalExpenses * 100) / 100,
                netProfit: Math.round(netProfit * 100) / 100,
                profitMargin: parseFloat(profitMargin),
                totalPaymentsMade: incomeData.totalPayments || 0,
                totalExpenseCount: expenses.totalExpenseCount || 0,
                totalDiscount: incomeData.totalDiscount || 0,
                currentPeriodIncome: Math.round(currentIncome * 100) / 100,
                currentPeriodExpenses: Math.round(currentExpenses * 100) / 100,
                currentPeriodNet: Math.round((currentIncome - currentExpenses) * 100) / 100
            },
            paymentMethodBreakdown: {
                income: feePaymentMethods,
                expenses: expensePaymentMethods
            },
            expenseBreakdown: {
                byCategory: categoryBreakdown,
                topCategories: categoryExpenses.slice(0, 5),
                totalExpenses: Math.round(totalExpenses * 100) / 100
            },
            incomeBreakdown: {
                totalPayments: incomeData.totalPayments || 0,
                totalDiscount: incomeData.totalDiscount || 0
            }
        };

        if (period !== 'all') {
            response.monthlyProfit = monthlyProfit;
        }

        res.status(200).json(response);

    } catch (error) {
        console.error("Error calculating net profit:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getDetailedProfitReport = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const {
            period = 'this_month',
            year = new Date().getFullYear(),
            month,
            category,
            accountType,
            accountId
        } = req.query;

        // Get date range
        let startDate, endDate;

        if (period === 'today') {
            startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
        } else if (period === 'this_month') {
            startDate = new Date(year, new Date().getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(year, new Date().getMonth() + 1, 0);
            endDate.setHours(23, 59, 59, 999);
        } else if (period === 'last_month') {
            startDate = new Date(year, new Date().getMonth() - 1, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(year, new Date().getMonth(), 0);
            endDate.setHours(23, 59, 59, 999);
        } else if (period === 'this_year') {
            startDate = new Date(year, 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(year, 11, 31);
            endDate.setHours(23, 59, 59, 999);
        } else if (period === 'last_year') {
            startDate = new Date(year - 1, 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(year - 1, 11, 31);
            endDate.setHours(23, 59, 59, 999);
        } else if (month) {
            startDate = new Date(year, month - 1, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(year, month, 0);
            endDate.setHours(23, 59, 59, 999);
        } else {
            startDate = new Date(year, new Date().getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(year, new Date().getMonth() + 1, 0);
            endDate.setHours(23, 59, 59, 999);
        }

        // Build fee filter
        const feeFilter = {
            school: schoolId,
            status: { $in: ['approved', 'paid'] },
            updatedAt: { $gte: startDate, $lte: endDate }
        };

        // Add account filtering
        if (accountType) {
            if (accountType === 'bank') {
                if (accountId) {
                    feeFilter.bankAccountId = new mongoose.Types.ObjectId(accountId);
                } else {
                    feeFilter.bankAccountId = { $ne: null };
                }
                feeFilter.paymentMethod = 'bank';
            } else if (accountType === 'cash') {
                if (accountId) {
                    feeFilter.cashAccountId = new mongoose.Types.ObjectId(accountId);
                } else {
                    const cashAccount = await CashAccount.findOne({
                        school: schoolId,
                        isActive: true
                    });
                    if (cashAccount) {
                        feeFilter.cashAccountId = cashAccount._id;
                    }
                }
                feeFilter.paymentMethod = 'cash';
            }
        }

        // Build expense filter
        const expenseFilter = {
            school: schoolId,
            status: { $in: ['approved', 'paid'] },
            date: { $gte: startDate, $lte: endDate }
        };

        // Add account filtering
        if (accountType) {
            if (accountType === 'bank') {
                if (accountId) {
                    expenseFilter.bankAccountId = new mongoose.Types.ObjectId(accountId);
                } else {
                    expenseFilter.bankAccountId = { $ne: null };
                }
                expenseFilter.paymentMethod = 'bank';
            } else if (accountType === 'cash') {
                if (accountId) {
                    expenseFilter.cashAccountId = new mongoose.Types.ObjectId(accountId);
                } else {
                    const cashAccount = await CashAccount.findOne({
                        school: schoolId,
                        isActive: true
                    });
                    if (cashAccount) {
                        expenseFilter.cashAccountId = cashAccount._id;
                    }
                }
                expenseFilter.paymentMethod = 'cash';
            }
        }

        if (category) {
            expenseFilter.category = category;
        }

        // Get daily fee income
        const dailyFees = await FeePayment.aggregate([
            { $match: feeFilter },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    total: { $sum: "$amount" },
                    count: { $sum: 1 },
                    totalDiscount: { $sum: "$discountAmount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Get daily expenses
        const dailyExpenses = await Expense.aggregate([
            { $match: expenseFilter },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                    total: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Create maps
        const feeMap = {};
        dailyFees.forEach(d => {
            feeMap[d._id] = {
                total: d.total,
                count: d.count,
                totalDiscount: d.totalDiscount || 0
            };
        });

        const expenseMap = {};
        dailyExpenses.forEach(d => {
            expenseMap[d._id] = {
                total: d.total,
                count: d.count
            };
        });

        // Get all unique dates
        const allDates = new Set([
            ...Object.keys(feeMap),
            ...Object.keys(expenseMap)
        ]);

        const sortedDates = Array.from(allDates).sort();

        // Build daily profit
        const dailyProfit = {};
        let totalIncome = 0;
        let totalExpenses = 0;
        let totalDiscount = 0;

        sortedDates.forEach(date => {
            const income = feeMap[date]?.total || 0;
            const expense = expenseMap[date]?.total || 0;
            const discount = feeMap[date]?.totalDiscount || 0;

            totalIncome += income;
            totalExpenses += expense;
            totalDiscount += discount;

            dailyProfit[date] = {
                income,
                expense,
                profit: income - expense,
                incomeCount: feeMap[date]?.count || 0,
                expenseCount: expenseMap[date]?.count || 0,
                discount
            };
        });

        const netProfit = totalIncome - totalExpenses;
        const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0;

        // Category breakdown
        const categoryExpenses = await Expense.aggregate([
            { $match: expenseFilter },
            {
                $group: {
                    _id: "$category",
                    total: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { total: -1 } }
        ]);

        const categoryBreakdown = {};
        categoryExpenses.forEach(item => {
            categoryBreakdown[item._id || 'uncategorized'] = {
                total: item.total,
                count: item.count,
                percentage: totalExpenses > 0 ? ((item.total / totalExpenses) * 100).toFixed(2) : 0
            };
        });

        // Get recent transactions
        const recentFeePayments = await FeePayment.find(feeFilter)
            .populate('studentId', 'name registrationNumber')
            .populate('feeId', 'title month')
            .sort({ updatedAt: -1 })
            .limit(10);

        const recentExpenses = await Expense.find(expenseFilter)
            .sort({ date: -1, createdAt: -1 })
            .limit(10);

        res.status(200).json({
            success: true,
            period,
            year: parseInt(year),
            month: month ? parseInt(month) : null,
            dateRange: { startDate, endDate },
            filter: {
                accountType: accountType || 'all',
                accountId: accountId || null,
                category: category || null
            },
            summary: {
                totalIncome,
                totalExpenses,
                netProfit,
                profitMargin: parseFloat(profitMargin),
                totalDiscount,
                totalIncomeCount: dailyFees.reduce((sum, d) => sum + d.count, 0),
                totalExpenseCount: dailyExpenses.reduce((sum, d) => sum + d.count, 0),
                totalDays: sortedDates.length
            },
            dailyProfit,
            expenseBreakdown: {
                byCategory: categoryBreakdown,
                topCategories: categoryExpenses.slice(0, 5),
                totalExpenses
            },
            incomeBreakdown: {
                totalDiscount,
                collectionRate: 100
            },
            recentTransactions: {
                feePayments: recentFeePayments,
                expenses: recentExpenses
            }
        });

    } catch (error) {
        console.error("Error getting detailed profit report:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getProfitComparison = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const {
            year = new Date().getFullYear(),
            compareWith = 'previous_year',
            accountType,
            accountId
        } = req.query;

        const years = [];

        if (compareWith === 'previous_year') {
            years.push(year - 1, parseInt(year));
        } else if (compareWith === 'same_month_last_year') {
            const currentMonth = new Date().getMonth() + 1;
            years.push({
                year: year - 1,
                month: currentMonth
            });
            years.push({
                year: parseInt(year),
                month: currentMonth
            });
        }

        const results = await Promise.all(years.map(async (yr) => {
            let startDate, endDate;

            if (typeof yr === 'number') {
                startDate = new Date(`${yr}-01-01`);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(`${yr}-12-31`);
                endDate.setHours(23, 59, 59, 999);
            } else {
                startDate = new Date(`${yr.year}-${String(yr.month).padStart(2, '0')}-01`);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(startDate);
                endDate.setMonth(endDate.getMonth() + 1);
                endDate.setDate(endDate.getDate() - 1);
                endDate.setHours(23, 59, 59, 999);
            }

            // Build fee match
            const feeMatch = {
                school: schoolId,
                status: { $in: ['approved', 'paid'] },
                updatedAt: { $gte: startDate, $lte: endDate }
            };

            // Build expense match
            const expenseMatch = {
                school: schoolId,
                status: { $in: ['approved', 'paid'] },
                date: { $gte: startDate, $lte: endDate }
            };

            // Add account filtering
            if (accountType) {
                if (accountType === 'bank') {
                    if (accountId) {
                        feeMatch.bankAccountId = new mongoose.Types.ObjectId(accountId);
                        expenseMatch.bankAccountId = new mongoose.Types.ObjectId(accountId);
                    } else {
                        feeMatch.bankAccountId = { $ne: null };
                        expenseMatch.bankAccountId = { $ne: null };
                    }
                    feeMatch.paymentMethod = 'bank';
                    expenseMatch.paymentMethod = 'bank';
                } else if (accountType === 'cash') {
                    if (accountId) {
                        feeMatch.cashAccountId = new mongoose.Types.ObjectId(accountId);
                        expenseMatch.cashAccountId = new mongoose.Types.ObjectId(accountId);
                    } else {
                        const cashAccount = await CashAccount.findOne({
                            school: schoolId,
                            isActive: true
                        });
                        if (cashAccount) {
                            feeMatch.cashAccountId = cashAccount._id;
                            expenseMatch.cashAccountId = cashAccount._id;
                        }
                    }
                    feeMatch.paymentMethod = 'cash';
                    expenseMatch.paymentMethod = 'cash';
                }
            }

            const [incomeData, expenseData] = await Promise.all([
                FeePayment.aggregate([
                    { $match: feeMatch },
                    { $group: { _id: null, total: { $sum: "$amount" } } }
                ]),
                Expense.aggregate([
                    { $match: expenseMatch },
                    { $group: { _id: null, total: { $sum: "$amount" } } }
                ])
            ]);

            const income = incomeData[0]?.total || 0;
            const expense = expenseData[0]?.total || 0;
            const profit = income - expense;

            return {
                label: typeof yr === 'number' ? `Year ${yr}` : `${yr.month}/${yr.year}`,
                year: typeof yr === 'number' ? yr : yr.year,
                month: typeof yr === 'number' ? null : yr.month,
                income,
                expense,
                profit,
                margin: income > 0 ? ((profit / income) * 100).toFixed(2) : 0
            };
        }));

        const [current, previous] = results;
        const growth = current && previous ? {
            income: current.income - previous.income,
            expense: current.expense - previous.expense,
            profit: current.profit - previous.profit,
            incomeGrowthPercentage: previous.income > 0 ? ((current.income - previous.income) / previous.income * 100).toFixed(2) : 0,
            profitGrowthPercentage: previous.profit > 0 ? ((current.profit - previous.profit) / previous.profit * 100).toFixed(2) : 0
        } : null;

        res.status(200).json({
            success: true,
            comparison: results,
            growth,
            compareWith,
            filter: {
                accountType: accountType || 'all',
                accountId: accountId || null
            }
        });

    } catch (error) {
        console.error("Error getting profit comparison:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getAllAccountsSummary = async (req, res) => {
    try {
        const schoolId = req.user.school;

        // Get all bank accounts
        const bankAccounts = await BankAccount.find({
            school: schoolId,
            isActive: true
        }).lean();

        // Get cash account (only one per school)
        const cashAccount = await CashAccount.findOne({
            school: schoolId,
            isActive: true
        }).lean();

        const accountSummaries = [];

        // Process bank accounts
        for (const account of bankAccounts) {
            const [feePayments, expenses] = await Promise.all([
                FeePayment.aggregate([
                    {
                        $match: {
                            school: schoolId,
                            bankAccountId: account._id,
                            status: { $in: ['approved', 'paid'] }
                        }
                    },
                    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
                ]),
                Expense.aggregate([
                    {
                        $match: {
                            school: schoolId,
                            bankAccountId: account._id,
                            status: { $in: ['approved', 'paid'] }
                        }
                    },
                    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
                ])
            ]);

            const totalReceived = feePayments[0]?.total || 0;
            const totalPaid = expenses[0]?.total || 0;
            const receivedCount = feePayments[0]?.count || 0;
            const paidCount = expenses[0]?.count || 0;

            accountSummaries.push({
                _id: account._id,
                type: 'bank',
                name: account.bankName,
                accountNumber: account.accountNumber,
                branchName: account.branchName,
                openingBalance: account.amount || 0,
                totalReceived,
                totalPaid,
                currentBalance: (account.amount || 0) + totalReceived - totalPaid,
                transactionCount: receivedCount + paidCount,
                receivedCount,
                paidCount
            });
        }

        // Process cash account
        if (cashAccount) {
            const [feePayments, expenses] = await Promise.all([
                FeePayment.aggregate([
                    {
                        $match: {
                            school: schoolId,
                            cashAccountId: cashAccount._id,
                            status: { $in: ['approved', 'paid'] }
                        }
                    },
                    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
                ]),
                Expense.aggregate([
                    {
                        $match: {
                            school: schoolId,
                            cashAccountId: cashAccount._id,
                            status: { $in: ['approved', 'paid'] }
                        }
                    },
                    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
                ])
            ]);

            const totalReceived = feePayments[0]?.total || 0;
            const totalPaid = expenses[0]?.total || 0;
            const receivedCount = feePayments[0]?.count || 0;
            const paidCount = expenses[0]?.count || 0;

            accountSummaries.push({
                _id: cashAccount._id,
                type: 'cash',
                name: cashAccount.title,
                description: cashAccount.description,
                openingBalance: cashAccount.amount || 0,
                totalReceived,
                totalPaid,
                currentBalance: (cashAccount.amount || 0) + totalReceived - totalPaid,
                transactionCount: receivedCount + paidCount,
                receivedCount,
                paidCount
            });
        }

        // Calculate total summary
        const totalOpeningBalance = accountSummaries.reduce((sum, acc) => sum + acc.openingBalance, 0);
        const totalReceived = accountSummaries.reduce((sum, acc) => sum + acc.totalReceived, 0);
        const totalPaid = accountSummaries.reduce((sum, acc) => sum + acc.totalPaid, 0);
        const totalCurrentBalance = accountSummaries.reduce((sum, acc) => sum + acc.currentBalance, 0);
        const totalTransactions = accountSummaries.reduce((sum, acc) => sum + acc.transactionCount, 0);

        res.status(200).json({
            success: true,
            summary: {
                totalAccounts: accountSummaries.length,
                totalBankAccounts: bankAccounts.length,
                hasCashAccount: !!cashAccount,
                totalOpeningBalance,
                totalReceived,
                totalPaid,
                totalCurrentBalance,
                totalTransactions
            },
            accounts: accountSummaries
        });

    } catch (error) {
        console.error("Error getting accounts summary:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getFinancialDetails = async (req, res) => {
    try {
        const schoolId = req.user.school || req.user._id || (req.user.schoolInfo && req.user.schoolInfo.id);

        const {
            period = 'all',
            startDate,
            endDate,
            accountType,
            accountId,
            transactionType
        } = req.query;

        let filterStartDate = null;
        let filterEndDate = null;
        let dateFilter = {};
        let dateRange = {};

        if (period === 'today') {
            const today = new Date();
            filterStartDate = new Date(today.setHours(0, 0, 0, 0));
            filterEndDate = new Date(today.setHours(23, 59, 59, 999));
            dateFilter = { $gte: filterStartDate, $lte: filterEndDate };
            dateRange = { start: filterStartDate, end: filterEndDate };
        } else if (period === 'this_month') {
            const now = new Date();
            filterStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
            filterEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            filterEndDate.setHours(23, 59, 59, 999);
            dateFilter = { $gte: filterStartDate, $lte: filterEndDate };
            dateRange = { start: filterStartDate, end: filterEndDate };
        } else if (period === 'this_year') {
            const now = new Date();
            filterStartDate = new Date(now.getFullYear(), 0, 1);
            filterEndDate = new Date(now.getFullYear(), 11, 31);
            filterEndDate.setHours(23, 59, 59, 999);
            dateFilter = { $gte: filterStartDate, $lte: filterEndDate };
            dateRange = { start: filterStartDate, end: filterEndDate };
        } else if (startDate && endDate) {
            filterStartDate = new Date(startDate);
            filterStartDate.setHours(0, 0, 0, 0);
            filterEndDate = new Date(endDate);
            filterEndDate.setHours(23, 59, 59, 999);
            dateFilter = { $gte: filterStartDate, $lte: filterEndDate };
            dateRange = { start: filterStartDate, end: filterEndDate };
        } else if (startDate) {
            filterStartDate = new Date(startDate);
            filterStartDate.setHours(0, 0, 0, 0);
            dateFilter = { $gte: filterStartDate };
            dateRange = { start: filterStartDate, end: null };
        } else if (endDate) {
            filterEndDate = new Date(endDate);
            filterEndDate.setHours(23, 59, 59, 999);
            dateFilter = { $lte: filterEndDate };
            dateRange = { start: null, end: filterEndDate };
        }

        let bankAccountIds = [];
        let cashAccountIds = [];

        if (accountId && accountType) {
            if (accountType === 'bank') {
                const bankAccount = await BankAccount.findOne({
                    _id: accountId,
                    school: schoolId,
                    isActive: true
                });
                if (bankAccount) {
                    bankAccountIds = [bankAccount._id];
                }
            } else if (accountType === 'cash') {
                const cashAccount = await CashAccount.findOne({
                    _id: accountId,
                    school: schoolId,
                    isActive: true
                });
                if (cashAccount) {
                    cashAccountIds = [cashAccount._id];
                }
            }
        } else {
            if (accountType === 'bank' || !accountType || accountType === 'all') {
                const bankAccounts = await BankAccount.find({
                    school: schoolId,
                    isActive: true
                }).lean();
                bankAccountIds = bankAccounts.map(a => a._id);
            }

            if (accountType === 'cash' || !accountType || accountType === 'all') {
                const cashAccounts = await CashAccount.find({
                    school: schoolId,
                    isActive: true
                }).lean();
                cashAccountIds = cashAccounts.map(a => a._id);
            }
        }

        let openingBalance = 0;
        let accountDetails = [];

        if (bankAccountIds.length > 0) {
            const bankAccounts = await BankAccount.find({
                _id: { $in: bankAccountIds },
                school: schoolId,
                isActive: true
            }).lean();

            bankAccounts.forEach(acc => {
                accountDetails.push({
                    _id: acc._id,
                    type: 'bank',
                    name: acc.bankName,
                    accountNumber: acc.accountNumber,
                    openingBalance: acc.amount || 0
                });
                openingBalance += acc.amount || 0;
            });
        }

        if (cashAccountIds.length > 0) {
            const cashAccounts = await CashAccount.find({
                _id: { $in: cashAccountIds },
                school: schoolId,
                isActive: true
            }).lean();

            cashAccounts.forEach(acc => {
                accountDetails.push({
                    _id: acc._id,
                    type: 'cash',
                    name: acc.title,
                    description: acc.description,
                    openingBalance: acc.amount || 0
                });
                openingBalance += acc.amount || 0;
            });
        }

        const baseMatch = {
            school: schoolId,
            status: { $in: ['approved', 'paid'] }
        };

        let previousPeriodFilter = {};
        if (filterStartDate) {
            previousPeriodFilter = {
                $lt: filterStartDate
            };
        }

        const previousFeeMatch = {
            ...baseMatch,
            $or: [
                { bankAccountId: { $in: bankAccountIds } },
                { cashAccountId: { $in: cashAccountIds } }
            ],
            ...(Object.keys(previousPeriodFilter).length > 0 ? { updatedAt: previousPeriodFilter } : {})
        };

        const previousExpenseMatch = {
            ...baseMatch,
            $or: [
                { bankAccountId: { $in: bankAccountIds } },
                { cashAccountId: { $in: cashAccountIds } }
            ],
            ...(Object.keys(previousPeriodFilter).length > 0 ? { date: previousPeriodFilter } : {})
        };

        const [previousCollections, previousExpenses] = await Promise.all([
            FeePayment.aggregate([
                { $match: previousFeeMatch },
                { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
            ]),
            Expense.aggregate([
                { $match: previousExpenseMatch },
                { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
            ])
        ]);

        const previousTotalReceived = previousCollections[0]?.total || 0;
        const previousTotalPaid = previousExpenses[0]?.total || 0;

        const midOpeningBalance = openingBalance + previousTotalReceived - previousTotalPaid;

        const feeMatch = {
            ...baseMatch,
            $or: [
                { bankAccountId: { $in: bankAccountIds } },
                { cashAccountId: { $in: cashAccountIds } }
            ]
        };

        if (filterStartDate && filterEndDate) {
            feeMatch.updatedAt = { $gte: filterStartDate, $lte: filterEndDate };
        } else if (filterStartDate) {
            feeMatch.updatedAt = { $gte: filterStartDate };
        } else if (filterEndDate) {
            feeMatch.updatedAt = { $lte: filterEndDate };
        }

        const expenseMatch = {
            ...baseMatch,
            $or: [
                { bankAccountId: { $in: bankAccountIds } },
                { cashAccountId: { $in: cashAccountIds } }
            ]
        };

        if (filterStartDate && filterEndDate) {
            expenseMatch.date = { $gte: filterStartDate, $lte: filterEndDate };
        } else if (filterStartDate) {
            expenseMatch.date = { $gte: filterStartDate };
        } else if (filterEndDate) {
            expenseMatch.date = { $lte: filterEndDate };
        }

        const shouldGetCollections = !transactionType || transactionType === 'all' || transactionType === 'collection';
        const shouldGetExpenses = !transactionType || transactionType === 'all' || transactionType === 'expense';

        let feePayments = [];
        let expenses = [];
        let feePaymentsByMonth = [];
        let expensesByMonth = [];
        let recentCollections = [];
        let recentExpenses = [];

        if (shouldGetCollections) {
            [feePayments, feePaymentsByMonth, recentCollections] = await Promise.all([
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
                FeePayment.aggregate([
                    { $match: feeMatch },
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%m", date: "$updatedAt" } },
                            total: { $sum: "$amount" },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]),
                FeePayment.find(feeMatch)
                    .populate('studentId', 'name registrationNumber')
                    .populate('feeId', 'title month')
                    .sort({ updatedAt: -1 })
                    .limit(5)
                    .lean()
            ]);
        }

        if (shouldGetExpenses) {
            [expenses, expensesByMonth, recentExpenses] = await Promise.all([
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
                Expense.aggregate([
                    { $match: expenseMatch },
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
                            total: { $sum: "$amount" },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]),
                Expense.find(expenseMatch)
                    .sort({ date: -1, createdAt: -1 })
                    .limit(5)
                    .lean()
            ]);
        }

        const totalReceived = feePayments[0]?.total || 0;
        const totalPaid = expenses[0]?.total || 0;
        const receivedCount = feePayments[0]?.count || 0;
        const paidCount = expenses[0]?.count || 0;

        const currentBalance = midOpeningBalance + totalReceived - totalPaid;

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
                _id: accountType === 'cash' && cashAccountIds.length === 1 ? cashAccountIds[0] :
                    accountType === 'bank' && bankAccountIds.length === 1 ? bankAccountIds[0] : 'all',
                title: accountType === 'cash' ? 'Cash Account' :
                    accountType === 'bank' ? 'Bank Accounts' : 'All Accounts',
                description: `${accountType || 'All'} financial transactions`,
                accounts: accountDetails,
                previousPeriodBalance: {
                    collections: previousTotalReceived,
                    expenses: previousTotalPaid,
                    net: previousTotalReceived - previousTotalPaid
                },
                midOpeningBalance: midOpeningBalance,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),

                summary: {
                    openingBalance: openingBalance,
                    midOpeningBalance: midOpeningBalance,
                    totalCollection: {
                        amount: totalReceived,
                        count: receivedCount
                    },
                    totalExpenses: {
                        amount: totalPaid,
                        count: paidCount
                    },
                    currentBalance: currentBalance,
                    totalTransactions: receivedCount + paidCount,
                    netChange: totalReceived - totalPaid
                },

                monthlyBreakdown: monthlyBreakdown,

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
                    period: period || 'all',
                    startDate: filterStartDate || null,
                    endDate: filterEndDate || null,
                    accountType: accountType || 'all',
                    accountId: accountId || null,
                    transactionType: transactionType || 'all'
                }
            }
        });

    } catch (error) {
        console.error("Error getting financial details:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getDetailReporting,
    getAccountRunningBalance,
    getOverallSchoolRunningBalance,
    getNetProfit,
    getDetailedProfitReport,
    getProfitComparison,
    getAllAccountsSummary,
    getFinancialDetails,
};