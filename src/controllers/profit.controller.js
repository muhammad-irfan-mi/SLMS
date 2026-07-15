// const mongoose = require("mongoose");
// const FeeDetail = require("../models/FeeDetail");
// const FeePayment = require("../models/FeePayment");
// const Expense = require("../models/Expense");
// const BankAccount = require("../models/BankAccount");


// const getDateRange = (period, customStartDate, customEndDate) => {
//     const now = new Date();
//     const start = new Date();
//     const end = new Date();

//     if (customStartDate && customEndDate) {
//         return {
//             start: new Date(customStartDate),
//             end: new Date(customEndDate)
//         };
//     }

//     switch (period) {
//         case 'today':
//             start.setHours(0, 0, 0, 0);
//             end.setHours(23, 59, 59, 999);
//             break;
//         case 'yesterday':
//             start.setDate(start.getDate() - 1);
//             start.setHours(0, 0, 0, 0);
//             end.setDate(end.getDate() - 1);
//             end.setHours(23, 59, 59, 999);
//             break;
//         case 'this_week':
//             const day = now.getDay();
//             start.setDate(now.getDate() - day);
//             start.setHours(0, 0, 0, 0);
//             end.setHours(23, 59, 59, 999);
//             break;
//         case 'this_month':
//             start.setDate(1);
//             start.setHours(0, 0, 0, 0);
//             end.setHours(23, 59, 59, 999);
//             break;
//         case 'last_month':
//             start.setMonth(start.getMonth() - 1);
//             start.setDate(1);
//             start.setHours(0, 0, 0, 0);
//             end.setMonth(end.getMonth() - 1);
//             end.setDate(new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate());
//             end.setHours(23, 59, 59, 999);
//             break;
//         case 'this_year':
//             start.setMonth(0, 1);
//             start.setHours(0, 0, 0, 0);
//             end.setHours(23, 59, 59, 999);
//             break;
//         case 'last_year':
//             start.setFullYear(start.getFullYear() - 1);
//             start.setMonth(0, 1);
//             start.setHours(0, 0, 0, 0);
//             end.setFullYear(end.getFullYear() - 1);
//             end.setMonth(11, 31);
//             end.setHours(23, 59, 59, 999);
//             break;
//         default:
//             start.setDate(1);
//             start.setHours(0, 0, 0, 0);
//             end.setHours(23, 59, 59, 999);
//     }

//     return { start, end };
// };


// const getBankAccountRunningBalance = async (req, res) => {
//     try {
//         const schoolId = req.user.school;
//         const { bankAccountId } = req.params;
//         const {
//             startDate,
//             endDate,
//             includeAll = 'false'
//         } = req.query;

//         const bankAccount = await BankAccount.findOne({
//             _id: bankAccountId,
//             school: schoolId,
//             isActive: true
//         });

//         if (!bankAccount) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Bank account not found"
//             });
//         }

//         // Set date range
//         let start, end;
//         if (startDate && endDate) {
//             start = new Date(startDate);
//             start.setHours(0, 0, 0, 0);
//             end = new Date(endDate);
//             end.setHours(23, 59, 59, 999);
//         } else {
//             const dateRange = getDateRange('this_month');
//             start = dateRange.start;
//             end = dateRange.end;
//         }

//         // Opening balance (the initial amount in bank account)
//         const openingBalance = bankAccount.amount || 0;

//         // Build query for transactions
//         const transactionFilter = {
//             school: schoolId,
//             bankAccountId: bankAccountId,
//             status: { $in: ['approved', 'paid'] }
//         };

//         if (includeAll === 'false') {
//             transactionFilter.updatedAt = { $gte: start, $lte: end };
//         }

//         // Get all fee payments for this bank account (Credit transactions)
//         const feePayments = await FeePayment.find({
//             ...transactionFilter,
//             status: { $in: ['approved', 'paid'] }
//         })
//             .populate('feeId', 'title month finalAmount discountAmount')
//             .populate('studentId', 'name registrationNumber')
//             .sort({ createdAt: 1 });

//         // Get all expenses for this bank account (Debit transactions)
//         const expenses = await Expense.find({
//             ...transactionFilter,
//             status: { $in: ['approved', 'paid'] }
//         })
//             .sort({ date: 1, createdAt: 1 });

//         // Combine and sort transactions by date
//         const transactions = [];

//         // Add fee payments as credit transactions
//         feePayments.forEach(payment => {
//             transactions.push({
//                 _id: payment._id,
//                 type: 'fee_payment',
//                 transactionType: 'credit',
//                 amount: payment.amount,
//                 date: payment.updatedAt || payment.createdAt,
//                 description: `Fee Payment - ${payment.feeId?.title || 'Fee'}`,
//                 studentName: payment.studentId?.name || 'Unknown Student',
//                 feeMonth: payment.feeId?.month || '',
//                 status: payment.status,
//                 reference: payment._id.toString()
//             });
//         });

//         // Add expenses as debit transactions
//         expenses.forEach(expense => {
//             transactions.push({
//                 _id: expense._id,
//                 type: 'expense',
//                 transactionType: 'debit',
//                 amount: expense.amount,
//                 date: expense.date || expense.createdAt,
//                 description: expense.title || 'Expense',
//                 category: expense.category || 'other',
//                 status: expense.status,
//                 reference: expense._id.toString()
//             });
//         });

//         // Sort by date
//         transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

//         // Calculate running balance
//         let runningBalance = openingBalance;
//         const transactionHistory = transactions.map(transaction => {
//             if (transaction.transactionType === 'credit') {
//                 runningBalance += transaction.amount;
//             } else if (transaction.transactionType === 'debit') {
//                 runningBalance -= transaction.amount;
//             }

//             return {
//                 ...transaction,
//                 runningBalance: runningBalance
//             };
//         });

//         // Calculate summary
//         const totalCredits = feePayments.reduce((sum, p) => sum + p.amount, 0);
//         const totalDebits = expenses.reduce((sum, e) => sum + e.amount, 0);
//         const currentBalance = openingBalance + totalCredits - totalDebits;

//         // Get filtered transactions if date range is applied
//         let filteredTransactions = transactionHistory;
//         if (includeAll === 'false') {
//             filteredTransactions = transactionHistory.filter(t => {
//                 const tDate = new Date(t.date);
//                 return tDate >= start && tDate <= end;
//             });
//         }

//         res.status(200).json({
//             success: true,
//             bankAccount: {
//                 _id: bankAccount._id,
//                 bankName: bankAccount.bankName,
//                 accountNumber: bankAccount.accountNumber,
//                 branchName: bankAccount.branchName,
//                 openingBalance: openingBalance
//             },
//             dateRange: includeAll === 'false' ? { start, end } : null,
//             summary: {
//                 openingBalance,
//                 totalCredits: totalCredits,
//                 totalDebits: totalDebits,
//                 currentBalance: currentBalance,
//                 totalTransactions: transactionHistory.length,
//                 creditCount: feePayments.length,
//                 debitCount: expenses.length
//             },
//             transactions: filteredTransactions,
//             currentBalance: currentBalance
//         });

//     } catch (error) {
//         console.error("Error getting bank account running balance:", error);
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// const getNetProfit = async (req, res) => {
//     try {
//         const schoolId = req.user.school;
//         const {
//             period = 'this_month',
//             startDate,
//             endDate,
//             category,
//             bankAccountId,
//         } = req.query;

//         let start, end;

//         if (period === 'all') {
//             start = null;
//             end = null;
//         } else if (startDate && endDate) {
//             const parseDate = (dateStr) => {
//                 if (!dateStr) return null;
//                 if (/^\d{4}-\d{2}$/.test(dateStr)) {
//                     const [year, month] = dateStr.split('-').map(Number);
//                     return new Date(year, month - 1, 1);
//                 }
//                 if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
//                     return new Date(dateStr);
//                 }
//                 const parsed = new Date(dateStr);
//                 if (!isNaN(parsed.getTime())) {
//                     return parsed;
//                 }
//                 return null;
//             };

//             const parsedStart = parseDate(startDate);
//             const parsedEnd = parseDate(endDate);

//             if (!parsedStart || !parsedEnd) {
//                 return res.status(400).json({
//                     success: false,
//                     message: "Invalid date format. Use YYYY-MM-DD or YYYY-MM"
//                 });
//             }

//             start = new Date(parsedStart);
//             start.setHours(0, 0, 0, 0);

//             end = new Date(parsedEnd);
//             if (/^\d{4}-\d{2}$/.test(endDate)) {
//                 const [year, month] = endDate.split('-').map(Number);
//                 end = new Date(year, month, 0);
//                 end.setHours(23, 59, 59, 999);
//             } else {
//                 end.setHours(23, 59, 59, 999);
//             }
//         } else {
//             const dateRange = getDateRange(period);
//             start = dateRange.start;
//             end = dateRange.end;
//         }

//         const feeFilter = {
//             school: schoolId,
//             status: { $in: ['approved', 'paid'] }
//         };

//         if (period !== 'all' && start && end) {
//             feeFilter.updatedAt = { $gte: start, $lte: end };
//         }

//         if (bankAccountId) {
//             feeFilter.bankAccountId = new mongoose.Types.ObjectId(bankAccountId);
//         }

//         const expenseFilter = {
//             school: schoolId,
//             status: { $in: ['approved', 'paid'] }
//         };

//         if (period !== 'all' && start && end) {
//             expenseFilter.date = { $gte: start, $lte: end };
//         }

//         if (bankAccountId) {
//             expenseFilter.bankAccountId = new mongoose.Types.ObjectId(bankAccountId);
//         }

//         if (category) {
//             expenseFilter.category = category;
//         }

//         const queries = [
//             FeePayment.aggregate([
//                 { $match: feeFilter },
//                 {
//                     $group: {
//                         _id: null,
//                         totalIncome: { $sum: "$amount" },
//                         totalPayments: { $sum: 1 },
//                         totalDiscount: { $sum: "$discountAmount" }
//                     }
//                 }
//             ]),

//             // Get expenses
//             Expense.aggregate([
//                 { $match: expenseFilter },
//                 {
//                     $group: {
//                         _id: null,
//                         totalExpenses: { $sum: "$amount" },
//                         totalExpenseCount: { $sum: 1 }
//                     }
//                 }
//             ]),

//             // Get category-wise expenses
//             Expense.aggregate([
//                 { $match: expenseFilter },
//                 {
//                     $group: {
//                         _id: "$category",
//                         total: { $sum: "$amount" },
//                         count: { $sum: 1 }
//                     }
//                 },
//                 { $sort: { total: -1 } }
//             ])
//         ];

//         if (period !== 'all') {
//             queries.push(
//                 FeePayment.aggregate([
//                     { $match: feeFilter },
//                     {
//                         $group: {
//                             _id: { $dateToString: { format: "%Y-%m", date: "$updatedAt" } },
//                             total: { $sum: "$amount" },
//                             count: { $sum: 1 }
//                         }
//                     },
//                     { $sort: { _id: 1 } }
//                 ]),
//                 Expense.aggregate([
//                     { $match: expenseFilter },
//                     {
//                         $group: {
//                             _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
//                             total: { $sum: "$amount" },
//                             count: { $sum: 1 }
//                         }
//                     },
//                     { $sort: { _id: 1 } }
//                 ])
//             );
//         }

//         const results = await Promise.all(queries);

//         const feeIncomeData = results[0] || [];
//         const expenseData = results[1] || [];
//         const categoryExpenses = results[2] || [];
//         const monthlyFeeIncome = results[3] || [];
//         const monthlyExpenses = results[4] || [];

//         const incomeData = feeIncomeData[0] || {
//             totalIncome: 0,
//             totalPayments: 0,
//             totalDiscount: 0
//         };

//         const expenses = expenseData[0] || {
//             totalExpenses: 0,
//             totalExpenseCount: 0
//         };

//         const totalIncome = incomeData.totalIncome || 0;
//         const totalExpenses = expenses.totalExpenses || 0;
//         const netProfit = totalIncome - totalExpenses;
//         const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0;

//         // Category breakdown
//         const categoryBreakdown = {};
//         categoryExpenses.forEach(item => {
//             categoryBreakdown[item._id || 'uncategorized'] = {
//                 total: item.total,
//                 count: item.count,
//                 percentage: totalExpenses > 0 ? ((item.total / totalExpenses) * 100).toFixed(2) : 0
//             };
//         });

//         // Combine monthly data - only if not all-time
//         let monthlyProfit = {};
//         if (period !== 'all') {
//             const allMonths = new Set([
//                 ...monthlyFeeIncome.map(m => m._id),
//                 ...monthlyExpenses.map(m => m._id)
//             ]);

//             allMonths.forEach(month => {
//                 const feeMonth = monthlyFeeIncome.find(m => m._id === month);
//                 const expMonth = monthlyExpenses.find(m => m._id === month);
//                 const income = feeMonth?.total || 0;
//                 const expense = expMonth?.total || 0;
//                 monthlyProfit[month] = {
//                     income,
//                     expense,
//                     profit: income - expense,
//                     incomeCount: feeMonth?.count || 0,
//                     expenseCount: expMonth?.count || 0,
//                     margin: income > 0 ? ((income - expense) / income * 100).toFixed(2) : 0
//                 };
//             });
//         }

//         // Get bank account details if provided
//         let bankAccountDetails = null;
//         if (bankAccountId) {
//             const bankAccount = await BankAccount.findOne({
//                 _id: bankAccountId,
//                 school: schoolId,
//                 isActive: true
//             });

//             if (bankAccount) {
//                 // Calculate running balance for this bank account (all time)
//                 const [totalFeePayments, totalExpensesForBank] = await Promise.all([
//                     FeePayment.aggregate([
//                         {
//                             $match: {
//                                 school: schoolId,
//                                 bankAccountId: new mongoose.Types.ObjectId(bankAccountId),
//                                 status: { $in: ['approved', 'paid'] }
//                             }
//                         },
//                         { $group: { _id: null, total: { $sum: "$amount" } } }
//                     ]),
//                     Expense.aggregate([
//                         {
//                             $match: {
//                                 school: schoolId,
//                                 bankAccountId: new mongoose.Types.ObjectId(bankAccountId),
//                                 status: { $in: ['approved', 'paid'] }
//                             }
//                         },
//                         { $group: { _id: null, total: { $sum: "$amount" } } }
//                     ])
//                 ]);

//                 const totalFees = totalFeePayments[0]?.total || 0;
//                 const totalExps = totalExpensesForBank[0]?.total || 0;

//                 bankAccountDetails = {
//                     _id: bankAccount._id,
//                     bankName: bankAccount.bankName,
//                     accountNumber: bankAccount.accountNumber,
//                     openingBalance: bankAccount.amount || 0,
//                     totalFeeReceived: totalFees,
//                     totalExpenses: totalExps,
//                     currentBalance: (bankAccount.amount || 0) + totalFees - totalExps
//                 };
//             }
//         }

//         // Prepare response
//         const response = {
//             success: true,
//             period,
//             dateRange: period === 'all' ? null : { start, end },
//             isAllTime: period === 'all',
//             bankAccount: bankAccountDetails,
//             summary: {
//                 totalIncome,
//                 totalExpenses,
//                 netProfit,
//                 profitMargin: parseFloat(profitMargin),
//                 totalPaymentsMade: incomeData.totalPayments || 0,
//                 totalExpenseCount: expenses.totalExpenseCount || 0,
//                 totalDiscount: incomeData.totalDiscount || 0
//             },
//             expenseBreakdown: {
//                 byCategory: categoryBreakdown,
//                 topCategories: categoryExpenses.slice(0, 5),
//                 totalExpenses
//             },
//             incomeBreakdown: {
//                 totalPayments: incomeData.totalPayments || 0,
//                 totalDiscount: incomeData.totalDiscount || 0
//             }
//         };

//         if (period !== 'all') {
//             response.monthlyProfit = monthlyProfit;
//         }

//         res.status(200).json(response);

//     } catch (error) {
//         console.error("Error calculating net profit:", error);
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };
// const getDetailedProfitReport = async (req, res) => {
//     try {
//         const schoolId = req.user.school;
//         const {
//             period = 'this_month',
//             year = new Date().getFullYear(),
//             month,
//             category,
//             bankAccountId
//         } = req.query;

//         // Get date range
//         let startDate, endDate;

//         if (period === 'today') {
//             startDate = new Date();
//             startDate.setHours(0, 0, 0, 0);
//             endDate = new Date();
//             endDate.setHours(23, 59, 59, 999);
//         } else if (period === 'this_month') {
//             startDate = new Date(year, new Date().getMonth(), 1);
//             startDate.setHours(0, 0, 0, 0);
//             endDate = new Date(year, new Date().getMonth() + 1, 0);
//             endDate.setHours(23, 59, 59, 999);
//         } else if (period === 'last_month') {
//             startDate = new Date(year, new Date().getMonth() - 1, 1);
//             startDate.setHours(0, 0, 0, 0);
//             endDate = new Date(year, new Date().getMonth(), 0);
//             endDate.setHours(23, 59, 59, 999);
//         } else if (period === 'this_year') {
//             startDate = new Date(year, 0, 1);
//             startDate.setHours(0, 0, 0, 0);
//             endDate = new Date(year, 11, 31);
//             endDate.setHours(23, 59, 59, 999);
//         } else if (period === 'last_year') {
//             startDate = new Date(year - 1, 0, 1);
//             startDate.setHours(0, 0, 0, 0);
//             endDate = new Date(year - 1, 11, 31);
//             endDate.setHours(23, 59, 59, 999);
//         } else if (month) {
//             startDate = new Date(year, month - 1, 1);
//             startDate.setHours(0, 0, 0, 0);
//             endDate = new Date(year, month, 0);
//             endDate.setHours(23, 59, 59, 999);
//         } else {
//             startDate = new Date(year, new Date().getMonth(), 1);
//             startDate.setHours(0, 0, 0, 0);
//             endDate = new Date(year, new Date().getMonth() + 1, 0);
//             endDate.setHours(23, 59, 59, 999);
//         }

//         // Build fee filter
//         const feeFilter = {
//             school: schoolId,
//             status: { $in: ['approved', 'paid'] },
//             updatedAt: { $gte: startDate, $lte: endDate }
//         };

//         if (bankAccountId) {
//             feeFilter.bankAccountId = new mongoose.Types.ObjectId(bankAccountId);
//         }

//         // Build expense filter
//         const expenseFilter = {
//             school: schoolId,
//             status: { $in: ['approved', 'paid'] },
//             date: { $gte: startDate, $lte: endDate }
//         };

//         if (bankAccountId) {
//             expenseFilter.bankAccountId = new mongoose.Types.ObjectId(bankAccountId);
//         }

//         if (category) {
//             expenseFilter.category = category;
//         }

//         // Get daily fee income
//         const dailyFees = await FeePayment.aggregate([
//             { $match: feeFilter },
//             {
//                 $group: {
//                     _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
//                     total: { $sum: "$amount" },
//                     count: { $sum: 1 },
//                     totalDiscount: { $sum: "$discountAmount" }
//                 }
//             },
//             { $sort: { _id: 1 } }
//         ]);

//         // Get daily expenses
//         const dailyExpenses = await Expense.aggregate([
//             { $match: expenseFilter },
//             {
//                 $group: {
//                     _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
//                     total: { $sum: "$amount" },
//                     count: { $sum: 1 }
//                 }
//             },
//             { $sort: { _id: 1 } }
//         ]);

//         // Create maps
//         const feeMap = {};
//         dailyFees.forEach(d => {
//             feeMap[d._id] = {
//                 total: d.total,
//                 count: d.count,
//                 totalDiscount: d.totalDiscount || 0
//             };
//         });

//         const expenseMap = {};
//         dailyExpenses.forEach(d => {
//             expenseMap[d._id] = {
//                 total: d.total,
//                 count: d.count
//             };
//         });

//         // Get all unique dates
//         const allDates = new Set([
//             ...Object.keys(feeMap),
//             ...Object.keys(expenseMap)
//         ]);

//         const sortedDates = Array.from(allDates).sort();

//         // Build daily profit
//         const dailyProfit = {};
//         let totalIncome = 0;
//         let totalExpenses = 0;
//         let totalDiscount = 0;

//         sortedDates.forEach(date => {
//             const income = feeMap[date]?.total || 0;
//             const expense = expenseMap[date]?.total || 0;
//             const discount = feeMap[date]?.totalDiscount || 0;

//             totalIncome += income;
//             totalExpenses += expense;
//             totalDiscount += discount;

//             dailyProfit[date] = {
//                 income,
//                 expense,
//                 profit: income - expense,
//                 incomeCount: feeMap[date]?.count || 0,
//                 expenseCount: expenseMap[date]?.count || 0,
//                 discount
//             };
//         });

//         const netProfit = totalIncome - totalExpenses;
//         const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0;

//         // Category breakdown
//         const categoryExpenses = await Expense.aggregate([
//             { $match: expenseFilter },
//             {
//                 $group: {
//                     _id: "$category",
//                     total: { $sum: "$amount" },
//                     count: { $sum: 1 }
//                 }
//             },
//             { $sort: { total: -1 } }
//         ]);

//         const categoryBreakdown = {};
//         categoryExpenses.forEach(item => {
//             categoryBreakdown[item._id || 'uncategorized'] = {
//                 total: item.total,
//                 count: item.count,
//                 percentage: totalExpenses > 0 ? ((item.total / totalExpenses) * 100).toFixed(2) : 0
//             };
//         });

//         // Get recent transactions
//         const recentFeePayments = await FeePayment.find(feeFilter)
//             .populate('studentId', 'name registrationNumber')
//             .populate('feeId', 'title month')
//             .sort({ updatedAt: -1 })
//             .limit(10);

//         const recentExpenses = await Expense.find(expenseFilter)
//             .sort({ date: -1, createdAt: -1 })
//             .limit(10);

//         res.status(200).json({
//             success: true,
//             period,
//             year: parseInt(year),
//             month: month ? parseInt(month) : null,
//             dateRange: { startDate, endDate },
//             summary: {
//                 totalIncome,
//                 totalExpenses,
//                 netProfit,
//                 profitMargin: parseFloat(profitMargin),
//                 totalDiscount,
//                 totalIncomeCount: dailyFees.reduce((sum, d) => sum + d.count, 0),
//                 totalExpenseCount: dailyExpenses.reduce((sum, d) => sum + d.count, 0),
//                 totalDays: sortedDates.length
//             },
//             dailyProfit,
//             expenseBreakdown: {
//                 byCategory: categoryBreakdown,
//                 topCategories: categoryExpenses.slice(0, 5),
//                 totalExpenses
//             },
//             incomeBreakdown: {
//                 totalDiscount,
//                 collectionRate: 100 // Since we're using approved/paid payments only
//             },
//             recentTransactions: {
//                 feePayments: recentFeePayments,
//                 expenses: recentExpenses
//             }
//         });

//     } catch (error) {
//         console.error("Error getting detailed profit report:", error);
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// const getProfitComparison = async (req, res) => {
//     try {
//         const schoolId = req.user.school;
//         const {
//             year = new Date().getFullYear(),
//             compareWith = 'previous_year',
//             bankAccountId
//         } = req.query;

//         const years = [];

//         if (compareWith === 'previous_year') {
//             years.push(year - 1, parseInt(year));
//         } else if (compareWith === 'same_month_last_year') {
//             const currentMonth = new Date().getMonth() + 1;
//             years.push({
//                 year: year - 1,
//                 month: currentMonth
//             });
//             years.push({
//                 year: parseInt(year),
//                 month: currentMonth
//             });
//         }

//         const results = await Promise.all(years.map(async (yr) => {
//             let startDate, endDate;

//             if (typeof yr === 'number') {
//                 startDate = new Date(`${yr}-01-01`);
//                 startDate.setHours(0, 0, 0, 0);
//                 endDate = new Date(`${yr}-12-31`);
//                 endDate.setHours(23, 59, 59, 999);
//             } else {
//                 startDate = new Date(`${yr.year}-${String(yr.month).padStart(2, '0')}-01`);
//                 startDate.setHours(0, 0, 0, 0);
//                 endDate = new Date(startDate);
//                 endDate.setMonth(endDate.getMonth() + 1);
//                 endDate.setDate(endDate.getDate() - 1);
//                 endDate.setHours(23, 59, 59, 999);
//             }

//             const feeMatch = {
//                 school: schoolId,
//                 status: { $in: ['approved', 'paid'] },
//                 updatedAt: { $gte: startDate, $lte: endDate }
//             };

//             const expenseMatch = {
//                 school: schoolId,
//                 status: { $in: ['approved', 'paid'] },
//                 date: { $gte: startDate, $lte: endDate }
//             };

//             if (bankAccountId) {
//                 feeMatch.bankAccountId = new mongoose.Types.ObjectId(bankAccountId);
//                 expenseMatch.bankAccountId = new mongoose.Types.ObjectId(bankAccountId);
//             }

//             const [incomeData, expenseData] = await Promise.all([
//                 FeePayment.aggregate([
//                     { $match: feeMatch },
//                     { $group: { _id: null, total: { $sum: "$amount" } } }
//                 ]),
//                 Expense.aggregate([
//                     { $match: expenseMatch },
//                     { $group: { _id: null, total: { $sum: "$amount" } } }
//                 ])
//             ]);

//             const income = incomeData[0]?.total || 0;
//             const expense = expenseData[0]?.total || 0;
//             const profit = income - expense;

//             return {
//                 label: typeof yr === 'number' ? `Year ${yr}` : `${yr.month}/${yr.year}`,
//                 year: typeof yr === 'number' ? yr : yr.year,
//                 month: typeof yr === 'number' ? null : yr.month,
//                 income,
//                 expense,
//                 profit,
//                 margin: income > 0 ? ((profit / income) * 100).toFixed(2) : 0
//             };
//         }));

//         const [current, previous] = results;
//         const growth = current && previous ? {
//             income: current.income - previous.income,
//             expense: current.expense - previous.expense,
//             profit: current.profit - previous.profit,
//             incomeGrowthPercentage: previous.income > 0 ? ((current.income - previous.income) / previous.income * 100).toFixed(2) : 0,
//             profitGrowthPercentage: previous.profit > 0 ? ((current.profit - previous.profit) / previous.profit * 100).toFixed(2) : 0
//         } : null;

//         res.status(200).json({
//             success: true,
//             comparison: results,
//             growth,
//             compareWith
//         });

//     } catch (error) {
//         console.error("Error getting profit comparison:", error);
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// module.exports = {
//     getBankAccountRunningBalance,
//     getNetProfit,
//     getDetailedProfitReport,
//     getProfitComparison
// };




const mongoose = require("mongoose");
const FeePayment = require("../models/FeePayment");
const Expense = require("../models/Expense");
const BankAccount = require("../models/BankAccount");
const CashAccount = require("../models/CashAccount");
const FeeDetail = require("../models/FeeDetail");
const SalarySlip = require("../models/SalarySlip");


// const getDateRange = (period, customStartDate, customEndDate) => {
//     const now = new Date();
//     const start = new Date();
//     const end = new Date();

//     if (customStartDate && customEndDate) {
//         return {
//             start: new Date(customStartDate),
//             end: new Date(customEndDate)
//         };
//     }

//     switch (period) {
//         case 'today':
//             start.setHours(0, 0, 0, 0);
//             end.setHours(23, 59, 59, 999);
//             break;
//         case 'yesterday':
//             start.setDate(start.getDate() - 1);
//             start.setHours(0, 0, 0, 0);
//             end.setDate(end.getDate() - 1);
//             end.setHours(23, 59, 59, 999);
//             break;
//         case 'this_week':
//             const day = now.getDay();
//             start.setDate(now.getDate() - day);
//             start.setHours(0, 0, 0, 0);
//             end.setHours(23, 59, 59, 999);
//             break;
//         case 'this_month':
//             start.setDate(1);
//             start.setHours(0, 0, 0, 0);
//             end.setHours(23, 59, 59, 999);
//             break;
//         case 'last_month':
//             start.setMonth(start.getMonth() - 1);
//             start.setDate(1);
//             start.setHours(0, 0, 0, 0);
//             end.setMonth(end.getMonth() - 1);
//             end.setDate(new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate());
//             end.setHours(23, 59, 59, 999);
//             break;
//         case 'this_year':
//             start.setMonth(0, 1);
//             start.setHours(0, 0, 0, 0);
//             end.setHours(23, 59, 59, 999);
//             break;
//         case 'last_year':
//             start.setFullYear(start.getFullYear() - 1);
//             start.setMonth(0, 1);
//             start.setHours(0, 0, 0, 0);
//             end.setFullYear(end.getFullYear() - 1);
//             end.setMonth(11, 31);
//             end.setHours(23, 59, 59, 999);
//             break;
//         default:
//             start.setDate(1);
//             start.setHours(0, 0, 0, 0);
//             end.setHours(23, 59, 59, 999);
//     }

//     return { start, end };
// };

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

        // ============================================================
        // 4. BANK & CASH BALANCES
        // ============================================================

        // Get all bank accounts
        const bankAccounts = await BankAccount.find({
            school: schoolId,
            isActive: true
        }).lean();

        const cashAccount = await CashAccount.findOne({
            school: schoolId,
            isActive: true
        }).lean();

        // Calculate total bank balance
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

        // Calculate cash balance
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

        // ============================================================
        // 5. NET PROFIT
        // ============================================================

        const totalRevenue = totalFeePaid;
        const totalCost = totalExpenses + totalSalariesPaid;
        const netProfit = totalRevenue - totalCost;

        // ============================================================
        // 6. BUILD RESPONSE
        // ============================================================

        const response = {
            success: true,
            period: label,
            dateRange: start && end ? { start, end } : null,

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
            }
        };

        // Add breakdown if requested
        if (breakdown === 'true') {
            // Fee status breakdown
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

            // Expense category breakdown
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

            // Payment method breakdown
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

            // Add monthly breakdown for year/date range
            if (period === 'this_year' || period === 'last_year' || (start && end)) {
                // Monthly fee payments
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

                // Monthly expenses
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

                // Monthly salaries
                let monthlySalaries = [];
                try {
                    const Salary = require("../models/Salary");
                    monthlySalaries = await Salary.aggregate([
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

                // Combine monthly data
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

        // Get account based on type
        if (accountType === 'bank') {
            console.log(accountId, schoolId)
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

        // Set date range
        let start, end;
        if (startDate && endDate) {
            const parsedStart = parseDateString(startDate);
            const parsedEnd = parseDateString(endDate);

            if (!parsedStart || !parsedEnd) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid date format. Use YYYY-MM-DD or YYYY-MM"
                });
            }

            start = new Date(parsedStart);
            start.setHours(0, 0, 0, 0);

            end = new Date(parsedEnd);
            if (/^\d{4}-\d{2}$/.test(endDate)) {
                const [year, month] = endDate.split('-').map(Number);
                end = new Date(year, month, 0);
                end.setHours(23, 59, 59, 999);
            } else {
                end.setHours(23, 59, 59, 999);
            }
        } else {
            const dateRange = getDateRange('this_month');
            start = dateRange.start;
            end = dateRange.end;
        }

        // Build query for transactions
        const transactionFilter = {
            school: schoolId,
            status: { $in: ['approved', 'paid'] }
        };

        if (accountType === 'bank') {
            transactionFilter.bankAccountId = new mongoose.Types.ObjectId(accountId);
            transactionFilter.paymentMethod = 'bank';
        } else {
            transactionFilter.cashAccountId = new mongoose.Types.ObjectId(accountId);
            transactionFilter.paymentMethod = 'cash';
        }

        // Get all fee payments (Credit transactions)
        const feePayments = await FeePayment.find(transactionFilter)
            .populate('feeId', 'title month finalAmount discountAmount')
            .populate('studentId', 'name registrationNumber')
            .lean()
            .sort({ createdAt: 1 });

        // Get all expenses (Debit transactions)
        const expenses = await Expense.find(transactionFilter)
            .lean()
            .sort({ date: 1, createdAt: 1 });

        // Combine and sort transactions by date
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

        // Calculate running balance for ALL transactions
        let runningBalance = openingBalance;
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

        // Calculate summary for ALL transactions
        const totalCredits = feePayments.reduce((sum, p) => sum + p.amount, 0);
        const totalDebits = expenses.reduce((sum, e) => sum + e.amount, 0);
        const currentBalance = openingBalance + totalCredits - totalDebits;

        // Filter transactions by date range if not allTime
        let filteredTransactions = allTransactionHistory;
        if (includeAll === 'false' && start && end) {
            filteredTransactions = allTransactionHistory.filter(t => {
                const tDate = new Date(t.date);
                return tDate >= start && tDate <= end;
            });
        }

        res.status(200).json({
            success: true,
            account: accountDetails,
            dateRange: includeAll === 'false' ? { start, end } : null,
            isAllTime: includeAll === 'true',
            summary: {
                openingBalance,
                totalCredits: totalCredits,
                totalDebits: totalDebits,
                currentBalance: currentBalance,
                totalTransactions: allTransactionHistory.length,
                creditCount: feePayments.length,
                debitCount: expenses.length,
                filteredTransactionsCount: filteredTransactions.length
            },
            transactions: filteredTransactions,
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
        if (startDate && endDate) {
            const parseDate = (dateStr) => {
                if (!dateStr) return null;
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

            const parsedStart = parseDate(startDate);
            const parsedEnd = parseDate(endDate);

            if (!parsedStart || !parsedEnd) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid date format. Use YYYY-MM-DD or YYYY-MM"
                });
            }

            start = new Date(parsedStart);
            start.setHours(0, 0, 0, 0);

            end = new Date(parsedEnd);
            if (/^\d{4}-\d{2}$/.test(endDate)) {
                const [year, month] = endDate.split('-').map(Number);
                end = new Date(year, month, 0);
                end.setHours(23, 59, 59, 999);
            } else {
                end.setHours(23, 59, 59, 999);
            }
        } else {
            const dateRange = getDateRange('this_month');
            start = dateRange.start;
            end = dateRange.end;
        }

        // Get all bank accounts
        const bankAccounts = await BankAccount.find({
            school: schoolId,
            isActive: true
        }).lean();

        // Get cash account
        const cashAccount = await CashAccount.findOne({
            school: schoolId,
            isActive: true
        }).lean();

        // Collect all account IDs
        const accountIds = {
            bank: bankAccounts.map(acc => acc._id),
            cash: cashAccount ? [cashAccount._id] : []
        };

        // Build transaction filters for each account type
        const bankFilters = accountIds.bank.map(id => ({
            bankAccountId: new mongoose.Types.ObjectId(id),
            paymentMethod: 'bank'
        }));

        const cashFilters = accountIds.cash.map(id => ({
            cashAccountId: new mongoose.Types.ObjectId(id),
            paymentMethod: 'cash'
        }));

        const allFilters = [...bankFilters, ...cashFilters];

        // Get all fee payments (Credit transactions)
        const feeMatch = {
            school: schoolId,
            status: { $in: ['approved', 'paid'] },
            $or: allFilters.length > 0 ? allFilters : [{ _id: null }]
        };

        // Get all expenses (Debit transactions)
        const expenseMatch = {
            school: schoolId,
            status: { $in: ['approved', 'paid'] },
            $or: allFilters.length > 0 ? allFilters : [{ _id: null }]
        };

        // Add date filters if not all time
        if (includeAll === 'false' && start && end) {
            feeMatch.updatedAt = { $gte: start, $lte: end };
            expenseMatch.date = { $gte: start, $lte: end };
        }

        // Get all fee payments
        const feePayments = await FeePayment.find(feeMatch)
            .populate('feeId', 'title month finalAmount discountAmount')
            .populate('studentId', 'name registrationNumber')
            .populate('bankAccountId', 'bankName accountNumber')
            .populate('cashAccountId', 'title')
            .lean()
            .sort({ updatedAt: 1, createdAt: 1 });

        // Get all expenses
        const expenses = await Expense.find(expenseMatch)
            .populate('bankAccountId', 'bankName accountNumber')
            .populate('cashAccountId', 'title')
            .lean()
            .sort({ date: 1, createdAt: 1 });

        // Calculate total opening balance across all accounts
        let totalOpeningBalance = 0;
        const accountDetails = [];

        // Process bank accounts
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

        // Process cash account
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

        // Combine and sort transactions by date
        const transactions = [];

        // Add fee payments as credit transactions
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

        // Add expenses as debit transactions
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

        // Sort by date
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate running balance
        let runningBalance = totalOpeningBalance;
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

        // Calculate summary
        const totalCredits = feePayments.reduce((sum, p) => sum + p.amount, 0);
        const totalDebits = expenses.reduce((sum, e) => sum + e.amount, 0);
        const currentBalance = totalOpeningBalance + totalCredits - totalDebits;

        // Group by account type for summary
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

        // Calculate per account type totals
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

        // Prepare response
        res.status(200).json({
            success: true,
            dateRange: includeAll === 'false' ? { start, end } : null,
            isAllTime: includeAll === 'true',
            accounts: accountDetails,
            summary: {
                totalAccounts: accountDetails.length,
                totalBankAccounts: bankAccounts.length,
                hasCashAccount: !!cashAccount,
                totalOpeningBalance,
                totalCredits,
                totalDebits,
                currentBalance,
                totalTransactions: transactionHistory.length,
                creditCount: feePayments.length,
                debitCount: expenses.length
            },
            accountTypeSummary,
            transactions: transactionHistory,
            currentBalance
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

        let start, end;

        if (period === 'all') {
            start = null;
            end = null;
        } else if (startDate && endDate) {
            const parsedStart = parseDateString(startDate);
            const parsedEnd = parseDateString(endDate);

            if (!parsedStart || !parsedEnd) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid date format. Use YYYY-MM-DD or YYYY-MM"
                });
            }

            start = new Date(parsedStart);
            start.setHours(0, 0, 0, 0);

            end = new Date(parsedEnd);
            if (/^\d{4}-\d{2}$/.test(endDate)) {
                const [year, month] = endDate.split('-').map(Number);
                end = new Date(year, month, 0);
                end.setHours(23, 59, 59, 999);
            } else {
                end.setHours(23, 59, 59, 999);
            }
        } else {
            const dateRange = getDateRange(period);
            start = dateRange.start;
            end = dateRange.end;
        }

        // Build fee payment filter
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
                    // Get the school's cash account
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

        // Build expense filter
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

        // Build queries
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

        // Process data
        const incomeData = feeIncomeData[0] || {
            totalIncome: 0,
            totalPayments: 0,
            totalDiscount: 0
        };

        const expenses = expenseData[0] || {
            totalExpenses: 0,
            totalExpenseCount: 0
        };

        const totalIncome = incomeData.totalIncome || 0;
        const totalExpenses = expenses.totalExpenses || 0;
        const netProfit = totalIncome - totalExpenses;
        const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0;

        // Category breakdown
        const categoryBreakdown = {};
        categoryExpenses.forEach(item => {
            categoryBreakdown[item._id || 'uncategorized'] = {
                total: item.total,
                count: item.count,
                percentage: totalExpenses > 0 ? ((item.total / totalExpenses) * 100).toFixed(2) : 0
            };
        });

        // Payment method breakdown
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

        // Monthly profit
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

        // Get account details if specific account
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

        // Prepare response
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
            summary: {
                totalIncome,
                totalExpenses,
                netProfit,
                profitMargin: parseFloat(profitMargin),
                totalPaymentsMade: incomeData.totalPayments || 0,
                totalExpenseCount: expenses.totalExpenseCount || 0,
                totalDiscount: incomeData.totalDiscount || 0
            },
            paymentMethodBreakdown: {
                income: feePaymentMethods,
                expenses: expensePaymentMethods
            },
            expenseBreakdown: {
                byCategory: categoryBreakdown,
                topCategories: categoryExpenses.slice(0, 5),
                totalExpenses
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

        let dateFilter = {};
        let dateRange = {};

        if (period === 'today') {
            const today = new Date();
            const startOfDay = new Date(today.setHours(0, 0, 0, 0));
            const endOfDay = new Date(today.setHours(23, 59, 59, 999));
            dateFilter = { $gte: startOfDay, $lte: endOfDay };
            dateRange = { start: startOfDay, end: endOfDay };
        } else if (period === 'this_month') {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            endOfMonth.setHours(23, 59, 59, 999);
            dateFilter = { $gte: startOfMonth, $lte: endOfMonth };
            dateRange = { start: startOfMonth, end: endOfMonth };
        } else if (period === 'this_year') {
            const now = new Date();
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            const endOfYear = new Date(now.getFullYear(), 11, 31);
            endOfYear.setHours(23, 59, 59, 999);
            dateFilter = { $gte: startOfYear, $lte: endOfYear };
            dateRange = { start: startOfYear, end: endOfYear };
        } else if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter = { $gte: start, $lte: end };
            dateRange = { start, end };
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

        const baseMatch = {
            school: schoolId,
            status: { $in: ['approved', 'paid', 'partially_paid'] }
        };

        const feeMatch = {
            ...baseMatch,
            $or: [
                { bankAccountId: { $in: bankAccountIds } },
                { cashAccountId: { $in: cashAccountIds } }
            ]
        };

        if (period !== 'all' && Object.keys(dateFilter).length > 0) {
            feeMatch.updatedAt = dateFilter;
        }

        const expenseMatch = {
            ...baseMatch,
            $or: [
                { bankAccountId: { $in: bankAccountIds } },
                { cashAccountId: { $in: cashAccountIds } }
            ]
        };

        if (period !== 'all' && Object.keys(dateFilter).length > 0) {
            expenseMatch.date = dateFilter;
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

        let openingBalance = 0;

        if (accountType === 'bank' && bankAccountIds.length === 1) {
            const bankAccount = await BankAccount.findById(bankAccountIds[0]);
            openingBalance = bankAccount?.amount || 0;
        } else if (accountType === 'cash' && cashAccountIds.length === 1) {
            const cashAccount = await CashAccount.findById(cashAccountIds[0]);
            openingBalance = cashAccount?.amount || 0;
        } else {
            const [bankAccounts, cashAccounts] = await Promise.all([
                BankAccount.find({ _id: { $in: bankAccountIds }, school: schoolId }).lean(),
                CashAccount.find({ _id: { $in: cashAccountIds }, school: schoolId }).lean()
            ]);
            openingBalance = bankAccounts.reduce((sum, acc) => sum + (acc.amount || 0), 0) +
                cashAccounts.reduce((sum, acc) => sum + (acc.amount || 0), 0);
        }

        const currentBalance = openingBalance + totalReceived - totalPaid;

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
                openingBalance: openingBalance,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),

                summary: {
                    openingBalance: openingBalance,
                    totalCollection: {
                        amount: totalReceived,
                        count: receivedCount
                    },
                    totalExpenses: {
                        amount: totalPaid,
                        count: paidCount
                    },
                    currentBalance: currentBalance,
                    totalTransactions: receivedCount + paidCount
                },

                monthlyBreakdown: monthlyBreakdown,

                recentTransactions: {
                    collections: recentCollections.map(c => ({
                        _id: c._id,
                        amount: c.amount,
                        // studentName: c.studentId?.name || 'Unknown',
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