const Sale = require("../models/Sale");
const Inventory = require("../models/Inventory");

/**
 * Create a sale
 * Decrements inventory quantities using Inventory.reduceStock
 */
const createSale = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      items = [],
      subtotal = 0,
      discount = 0,
      tax = 0,
      total = 0,
      paymentMethod = "cash",
      paymentStatus = "pending",
      amountPaid = 0,
      amountDue = 0,
      customerName = "",
      notes = "",
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Items are required" });
    }

    // Validate items and prepare updates
    for (const it of items) {
      if (!it.sku || !it.qty) {
        return res
          .status(400)
          .json({ success: false, message: "Each item must have sku and qty" });
      }
    }

    // Attempt to deduct inventory for each item
    // Not using transactions for simplicity; if one fails we'll return error
    for (const it of items) {
      const inv = await Inventory.findOne({
        $or: [{ sku: it.sku }, { _id: it._id }],
        user: userId,
      });
      if (!inv) {
        return res
          .status(404)
          .json({
            success: false,
            message: `Inventory item not found: ${it.sku}`,
          });
      }
      // call reduceStock which will throw on insufficient stock
      await inv.reduceStock(
        Number(it.qty),
        "sale",
        req.body.reference || "",
        `Sale created via API`,
        req.userId
      );
    }

    const sale = await Sale.create({
      user: userId,
      items,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod,
      paymentStatus,
      amountPaid,
      amountDue,
      customerName,
      notes,
      createdBy: req.userId,
    });

    res.status(201).json({ success: true, data: { sale } });
  } catch (error) {
    console.error("Create sale error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error creating sale",
        error: error.message,
      });
  }
};

const getAllSales = async (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate } = req.query;
    const query = { user: req.userId };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const items = await Sale.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));
    const total = await Sale.countDocuments(query);
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
    console.error("Get sales error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching sales",
        error: error.message,
      });
  }
};

const getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findOne({ _id: req.params.id, user: req.userId });
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });
    res.status(200).json({ success: true, data: { sale } });
  } catch (error) {
    console.error("Get sale error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching sale",
        error: error.message,
      });
  }
};

const updateSalePayment = async (req, res) => {
  try {
    const { paymentStatus, amountPaid } = req.body;
    const sale = await Sale.findOne({ _id: req.params.id, user: req.userId });
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });
    if (paymentStatus) sale.paymentStatus = paymentStatus;
    if (typeof amountPaid !== "undefined") sale.amountPaid = amountPaid;
    sale.amountDue = Math.max(0, sale.total - (sale.amountPaid || 0));
    await sale.save();
    res.status(200).json({ success: true, data: { sale } });
  } catch (error) {
    console.error("Update sale payment error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error updating sale payment",
        error: error.message,
      });
  }
};

const cancelSale = async (req, res) => {
  try {
    const sale = await Sale.findOne({ _id: req.params.id, user: req.userId });
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });
    // For now, mark as refunded and optionally restock items
    sale.paymentStatus = "refunded";
    await sale.save();
    // Optionally restock: increase inventory back
    for (const it of sale.items) {
      try {
        const inv = await Inventory.findOne({
          $or: [{ sku: it.sku }, { _id: it._id }],
          user: req.userId,
        });
        if (inv)
          await inv.addStock(
            Number(it.qty),
            "return",
            null,
            `Restock after sale cancellation ${sale._id}`,
            req.userId
          );
      } catch (e) {
        // don't fail overall if restock fails
        console.warn(
          "Failed to restock item after sale cancel:",
          it.sku,
          e.message
        );
      }
    }

    res.status(200).json({ success: true, data: { sale } });
  } catch (error) {
    console.error("Cancel sale error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error cancelling sale",
        error: error.message,
      });
  }
};

module.exports = {
  createSale,
  getAllSales,
  getSaleById,
  updateSalePayment,
  cancelSale,
};
