// controllers/profit.controller.js - Fixed version

const mongoose = require("mongoose");
const FeeDetail = require("../models/FeeDetail");
const Expense = require("../models/Expense");

// ==================== HELPER FUNCTIONS ====================

const getDateRange = (period, customStartDate, customEndDate) => {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  if (customStartDate && customEndDate) {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start: new Date(customStartDate), end: new Date(customEndDate) };
  }

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
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
    case 'last_month':
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() - 1);
      end.setDate(new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate());
      end.setHours(23, 59, 59, 999);
      break;
    case 'this_year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
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
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
  }

  return { start, end };
};

// ==================== GET NET PROFIT ====================

const getNetProfit = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const { 
      period = 'this_month', 
      startDate, 
      endDate,
      category
    } = req.query;

    // Get date range
    let start, end;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      const dateRange = getDateRange(period);
      start = dateRange.start;
      end = dateRange.end;
    }

    // Fee statuses to include
    const feeStatuses = ['paid', 'approved', 'partially_paid'];

    // Build fee filter
    const feeFilter = {
      school: schoolId,
      status: { $in: feeStatuses },
      updatedAt: { $gte: start, $lte: end }
    };

    // Build expense filter (no status filter)
    const expenseFilter = {
      school: schoolId,
      date: { $gte: start, $lte: end }
    };

    if (category) {
      expenseFilter.category = category;
    }

    // Parallel queries
    const [feeIncome, expenseData, categoryExpenses] = await Promise.all([
      // Get fee income
      FeeDetail.aggregate([
        { $match: feeFilter },
        {
          $group: {
            _id: null,
            totalIncome: { $sum: "$paidAmount" },
            totalFees: { $sum: 1 },
            totalOriginalAmount: { $sum: "$finalAmount" },
            totalDiscount: { $sum: "$discountAmount" }
          }
        }
      ]),

      // Get expenses (no status filter)
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

      // Get category-wise expenses
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
      ])
    ]);

    // Process data
    const incomeData = feeIncome[0] || { 
      totalIncome: 0, 
      totalFees: 0, 
      totalOriginalAmount: 0, 
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
    const collectionRate = incomeData.totalOriginalAmount > 0 ? ((totalIncome / incomeData.totalOriginalAmount) * 100).toFixed(2) : 0;

    // Category breakdown
    const categoryBreakdown = {};
    categoryExpenses.forEach(item => {
      categoryBreakdown[item._id] = {
        total: item.total,
        count: item.count,
        percentage: totalExpenses > 0 ? ((item.total / totalExpenses) * 100).toFixed(2) : 0
      };
    });

    // Monthly breakdown for fees
    const monthlyFeeIncome = await FeeDetail.aggregate([
      { $match: feeFilter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$updatedAt" } },
          total: { $sum: "$paidAmount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Monthly breakdown for expenses
    const monthlyExpenses = await Expense.aggregate([
      { $match: expenseFilter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Combine monthly data
    const monthlyProfit = {};
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

    res.status(200).json({
      success: true,
      period,
      dateRange: { start, end },
      summary: {
        totalIncome,
        totalExpenses,
        netProfit,
        profitMargin: parseFloat(profitMargin),
        totalFeesCollected: incomeData.totalFees || 0,
        totalExpenseCount: expenses.totalExpenseCount || 0,
        collectionRate: parseFloat(collectionRate),
        totalDiscount: incomeData.totalDiscount || 0,
        totalOriginalAmount: incomeData.totalOriginalAmount || 0
      },
      monthlyProfit,
      expenseBreakdown: {
        byCategory: categoryBreakdown,
        topCategories: categoryExpenses.slice(0, 5),
        totalExpenses
      },
      incomeBreakdown: {
        totalFees: incomeData.totalFees || 0,
        totalOriginalAmount: incomeData.totalOriginalAmount || 0,
        totalDiscount: incomeData.totalDiscount || 0,
        collectionRate: parseFloat(collectionRate)
      }
    });

  } catch (error) {
    console.error("Error calculating net profit:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== GET DETAILED PROFIT REPORT ====================

const getDetailedProfitReport = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const { 
      period = 'this_month',
      year = new Date().getFullYear(),
      month,
      category
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

    // Fee statuses
    const feeStatuses = ['paid', 'approved', 'partially_paid'];

    // Fee filter
    const feeFilter = {
      school: schoolId,
      status: { $in: feeStatuses },
      updatedAt: { $gte: startDate, $lte: endDate }
    };

    // Expense filter (no status filter)
    const expenseFilter = {
      school: schoolId,
      date: { $gte: startDate, $lte: endDate }
    };

    if (category) {
      expenseFilter.category = category;
    }

    // Get daily fee income
    const dailyFees = await FeeDetail.aggregate([
      { $match: feeFilter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
          total: { $sum: "$paidAmount" },
          count: { $sum: 1 },
          totalOriginal: { $sum: "$finalAmount" },
          totalDiscount: { $sum: "$discountAmount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get daily expenses (no status filter)
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
        totalOriginal: d.totalOriginal,
        totalDiscount: d.totalDiscount
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
    let totalOriginalAmount = 0;
    let totalDiscount = 0;

    sortedDates.forEach(date => {
      const income = feeMap[date]?.total || 0;
      const expense = expenseMap[date]?.total || 0;
      const originalAmount = feeMap[date]?.totalOriginal || 0;
      const discount = feeMap[date]?.totalDiscount || 0;
      
      totalIncome += income;
      totalExpenses += expense;
      totalOriginalAmount += originalAmount;
      totalDiscount += discount;

      dailyProfit[date] = {
        income,
        expense,
        profit: income - expense,
        incomeCount: feeMap[date]?.count || 0,
        expenseCount: expenseMap[date]?.count || 0,
        originalAmount,
        discount
      };
    });

    const netProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0;
    const collectionRate = totalOriginalAmount > 0 ? ((totalIncome / totalOriginalAmount) * 100).toFixed(2) : 0;

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
      categoryBreakdown[item._id] = {
        total: item.total,
        count: item.count,
        percentage: totalExpenses > 0 ? ((item.total / totalExpenses) * 100).toFixed(2) : 0
      };
    });

    res.status(200).json({
      success: true,
      period,
      year: parseInt(year),
      month: month ? parseInt(month) : null,
      dateRange: { startDate, endDate },
      summary: {
        totalIncome,
        totalExpenses,
        netProfit,
        profitMargin: parseFloat(profitMargin),
        totalOriginalAmount,
        totalDiscount,
        collectionRate: parseFloat(collectionRate),
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
        totalOriginalAmount,
        totalDiscount,
        collectionRate: parseFloat(collectionRate)
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

// ==================== PROFIT COMPARISON ====================

const getProfitComparison = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const { 
      year = new Date().getFullYear(),
      compareWith = 'previous_year'
    } = req.query;

    const feeStatuses = ['paid', 'approved', 'partially_paid'];
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

      const [incomeData, expenseData] = await Promise.all([
        FeeDetail.aggregate([
          {
            $match: {
              school: schoolId,
              status: { $in: feeStatuses },
              updatedAt: { $gte: startDate, $lte: endDate }
            }
          },
          { $group: { _id: null, total: { $sum: "$paidAmount" } } }
        ]),
        Expense.aggregate([
          {
            $match: {
              school: schoolId,
              date: { $gte: startDate, $lte: endDate }
            }
          },
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
      compareWith
    });

  } catch (error) {
    console.error("Error getting profit comparison:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getNetProfit,
  getDetailedProfitReport,
  getProfitComparison
};