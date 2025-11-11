const Expense = require("../models/Expense");

const createExpense = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      amount,
      category = "other",
      description = "",
      date = Date.now(),
      receiptUrl,
    } = req.body;
    if (typeof amount === "undefined" || amount === null) {
      return res
        .status(400)
        .json({ success: false, message: "Amount is required" });
    }
    const expense = await Expense.create({
      user: userId,
      amount,
      category,
      description,
      date,
      receiptUrl,
      createdBy: req.userId,
    });
    res.status(201).json({ success: true, data: { expense } });
  } catch (error) {
    console.error("Create expense error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error creating expense",
        error: error.message,
      });
  }
};

const getExpenses = async (req, res) => {
  try {
    const { page = 1, limit = 50, startDate, endDate } = req.query;
    const query = { user: req.userId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    const skip = (page - 1) * limit;
    const items = await Expense.find(query)
      .sort({ date: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));
    const total = await Expense.countDocuments(query);
    res
      .status(200)
      .json({
        success: true,
        data: {
          items,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
  } catch (error) {
    console.error("Get expenses error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching expenses",
        error: error.message,
      });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
    });
    if (!expense)
      return res
        .status(404)
        .json({ success: false, message: "Expense not found" });
    res.status(200).json({ success: true, message: "Expense deleted" });
  } catch (error) {
    console.error("Delete expense error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error deleting expense",
        error: error.message,
      });
  }
};

module.exports = { createExpense, getExpenses, deleteExpense };
