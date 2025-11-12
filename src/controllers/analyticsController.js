const { Invoice } = require("../models/Invoice");
const Payment = require("../models/Payment");
const Client = require("../models/Client");
const Inventory = require("../models/Inventory");
const mongoose = require("mongoose");

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get dashboard overview statistics
 * @access  Private
 */
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.userId;

    // Get date range (default: last 30 days)
    const { startDate, endDate } = req.query;
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Total Revenue (completed payments)
    const revenueStats = await Payment.aggregate([
      {
        $match: {
          user: mongoose.Types.ObjectId(userId),
          status: "completed",
          paymentDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          totalTransactions: { $sum: 1 },
          averageTransaction: { $avg: "$amount" },
        },
      },
    ]);

    // Invoice Statistics
    const invoiceStats = await Invoice.aggregate([
      {
        $match: {
          user: mongoose.Types.ObjectId(userId),
          issueDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: "$total" },
          totalPaid: { $sum: "$amountPaid" },
          totalDue: { $sum: "$amountDue" },
        },
      },
    ]);

    // Invoice Status Breakdown
    const invoiceByStatus = await Invoice.aggregate([
      {
        $match: {
          user: mongoose.Types.ObjectId(userId),
          issueDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
    ]);

    // Total Clients
    const totalClients = await Client.countDocuments({
      user: userId,
      status: "active",
    });

    // New Clients (in date range)
    const newClients = await Client.countDocuments({
      user: userId,
      createdAt: { $gte: start, $lte: end },
    });

    // Inventory Value
    const inventoryValue = await Inventory.getTotalInventoryValue(userId);

    // Low Stock Count
    const lowStockCount = await Inventory.countDocuments({
      user: userId,
      trackInventory: true,
      $expr: { $lte: ["$quantity", "$reorderPoint"] },
    });

    // Overdue Invoices
    const overdueInvoices = await Invoice.countDocuments({
      user: userId,
      status: "overdue",
    });

    // Top Clients by Revenue
    const topClients = await Payment.aggregate([
      {
        $match: {
          user: mongoose.Types.ObjectId(userId),
          status: "completed",
          paymentDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$client",
          totalPaid: { $sum: "$amount" },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { totalPaid: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "clients",
          localField: "_id",
          foreignField: "_id",
          as: "clientInfo",
        },
      },
      { $unwind: "$clientInfo" },
      {
        $project: {
          _id: 1,
          name: "$clientInfo.name",
          email: "$clientInfo.email",
          totalPaid: 1,
          transactionCount: 1,
        },
      },
    ]);

    // Revenue Trend (by day)
    const revenueTrend = await Payment.aggregate([
      {
        $match: {
          user: mongoose.Types.ObjectId(userId),
          status: "completed",
          paymentDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$paymentDate" },
          },
          revenue: { $sum: "$amount" },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        revenue: revenueStats[0] || {
          totalRevenue: 0,
          totalTransactions: 0,
          averageTransaction: 0,
        },
        invoices: invoiceStats[0] || {
          totalInvoices: 0,
          totalAmount: 0,
          totalPaid: 0,
          totalDue: 0,
        },
        invoicesByStatus: invoiceByStatus,
        clients: {
          total: totalClients,
          new: newClients,
        },
        inventory: {
          value: inventoryValue,
          lowStockCount,
        },
        overdueInvoices,
        topClients,
        revenueTrend,
      },
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/analytics/revenue
 * @desc    Get detailed revenue analytics
 * @access  Private
 */
const getRevenueAnalytics = async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate, groupBy = "day" } = req.query;

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Determine date format based on groupBy
    const dateFormats = {
      day: "%Y-%m-%d",
      week: "%Y-W%U",
      month: "%Y-%m",
      year: "%Y",
    };

    const dateFormat = dateFormats[groupBy] || dateFormats.day;

    // Revenue over time
    const revenueOverTime = await Payment.aggregate([
      {
        $match: {
          user: mongoose.Types.ObjectId(userId),
          status: "completed",
          paymentDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: "$paymentDate" },
          },
          revenue: { $sum: "$amount" },
          transactions: { $sum: 1 },
          averageAmount: { $avg: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Revenue by payment method
    const revenueByMethod = await Payment.aggregate([
      {
        $match: {
          user: mongoose.Types.ObjectId(userId),
          status: "completed",
          paymentDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$method",
          revenue: { $sum: "$amount" },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // Total summary
    const summary = await Payment.aggregate([
      {
        $match: {
          user: mongoose.Types.ObjectId(userId),
          status: "completed",
          paymentDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          totalTransactions: { $sum: 1 },
          averageTransaction: { $avg: "$amount" },
          minTransaction: { $min: "$amount" },
          maxTransaction: { $max: "$amount" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: summary[0] || {
          totalRevenue: 0,
          totalTransactions: 0,
          averageTransaction: 0,
          minTransaction: 0,
          maxTransaction: 0,
        },
        overTime: revenueOverTime,
        byMethod: revenueByMethod,
      },
    });
  } catch (error) {
    console.error("Get revenue analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching revenue analytics",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/analytics/clients
 * @desc    Get client analytics
 * @access  Private
 */
const getClientAnalytics = async (req, res) => {
  try {
    const userId = req.userId;

    // Total clients by status
    const clientsByStatus = await Client.aggregate([
      { $match: { user: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Clients by type
    const clientsByType = await Client.aggregate([
      { $match: { user: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$clientType",
          count: { $sum: 1 },
        },
      },
    ]);

    // Top clients by total owed
    const topClientsByRevenue = await Client.find({ user: userId })
      .sort({ totalPaid: -1 })
      .limit(10)
      .select("name email totalPaid totalOwed currentBalance");

    // Clients with outstanding balance
    const clientsWithBalance = await Client.countDocuments({
      user: userId,
      currentBalance: { $gt: 0 },
    });

    // Client growth over time (last 12 months)
    const clientGrowth = await Client.aggregate([
      { $match: { user: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$createdAt" },
          },
          newClients: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ]);

    res.status(200).json({
      success: true,
      data: {
        byStatus: clientsByStatus,
        byType: clientsByType,
        topClients: topClientsByRevenue,
        clientsWithBalance,
        growth: clientGrowth,
      },
    });
  } catch (error) {
    console.error("Get client analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching client analytics",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/analytics/invoices
 * @desc    Get invoice analytics
 * @access  Private
 */
const getInvoiceAnalytics = async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Invoice summary
    const summary = await Invoice.aggregate([
      {
        $match: {
          user: mongoose.Types.ObjectId(userId),
          issueDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: "$total" },
          totalPaid: { $sum: "$amountPaid" },
          totalDue: { $sum: "$amountDue" },
          averageAmount: { $avg: "$total" },
        },
      },
    ]);

    // By status
    const byStatus = await Invoice.aggregate([
      {
        $match: {
          user: mongoose.Types.ObjectId(userId),
          issueDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
    ]);

    // Average payment time (for paid invoices)
    const avgPaymentTime = await Invoice.aggregate([
      {
        $match: {
          user: mongoose.Types.ObjectId(userId),
          status: "paid",
          paidDate: { $exists: true },
        },
      },
      {
        $project: {
          daysToPayment: {
            $divide: [
              { $subtract: ["$paidDate", "$issueDate"] },
              1000 * 60 * 60 * 24,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          averageDays: { $avg: "$daysToPayment" },
        },
      },
    ]);

    // Monthly trend
    const monthlyTrend = await Invoice.aggregate([
      {
        $match: {
          user: mongoose.Types.ObjectId(userId),
          issueDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$issueDate" },
          },
          count: { $sum: 1 },
          total: { $sum: "$total" },
          paid: { $sum: "$amountPaid" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: summary[0] || {
          totalInvoices: 0,
          totalAmount: 0,
          totalPaid: 0,
          totalDue: 0,
          averageAmount: 0,
        },
        byStatus,
        averagePaymentTime: avgPaymentTime[0]?.averageDays || 0,
        monthlyTrend,
      },
    });
  } catch (error) {
    console.error("Get invoice analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching invoice analytics",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/analytics/inventory
 * @desc    Get inventory analytics
 * @access  Private
 */
const getInventoryAnalytics = async (req, res) => {
  try {
    const userId = req.userId;

    // Total value
    const value = await Inventory.getTotalInventoryValue(userId);

    // By category
    const byCategory = await Inventory.aggregate([
      { $match: { user: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalCostValue: { $sum: { $multiply: ["$quantity", "$unitCost"] } },
          totalRetailValue: {
            $sum: { $multiply: ["$quantity", "$retailPrice"] },
          },
        },
      },
      { $sort: { totalRetailValue: -1 } },
    ]);

    // Low stock items
    const lowStockCount = await Inventory.countDocuments({
      user: userId,
      trackInventory: true,
      $expr: { $lte: ["$quantity", "$reorderPoint"] },
    });

    // Out of stock
    const outOfStockCount = await Inventory.countDocuments({
      user: userId,
      quantity: 0,
    });

    // Top items by value
    const topItems = await Inventory.find({ user: userId })
      .sort({ retailValue: -1 })
      .limit(10)
      .select("name sku quantity unitCost retailPrice category");

    res.status(200).json({
      success: true,
      data: {
        value,
        byCategory,
        lowStockCount,
        outOfStockCount,
        topItems,
      },
    });
  } catch (error) {
    console.error("Get inventory analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching inventory analytics",
      error: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
  getRevenueAnalytics,
  getClientAnalytics,
  getInvoiceAnalytics,
  getInventoryAnalytics,
};
