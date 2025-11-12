const { Invoice, InvoiceItem } = require("../models/Invoice");
const Client = require("../models/Client");
const Inventory = require("../models/Inventory");

/**
 * @route   POST /api/invoices
 * @desc    Create a new invoice with items
 * @access  Private
 */
const createInvoice = async (req, res) => {
  try {
    const {
      client,
      items,
      taxRate,
      discount,
      discountType,
      shippingFee,
      dueDate,
      notes,
      termsAndConditions,
    } = req.body;

    // Validate client exists and belongs to user
    const clientDoc = await Client.findOne({ _id: client, user: req.userId });
    if (!clientDoc) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Generate invoice number
    const invoiceNumber = await Invoice.generateInvoiceNumber(req.userId);

    // Calculate subtotal from items
    let subtotal = 0;
    if (items && items.length > 0) {
      items.forEach((item) => {
        const itemSubtotal = item.quantity * item.unitPrice;
        subtotal += itemSubtotal;
      });
    }

    // Create invoice
    const invoice = await Invoice.create({
      user: req.userId,
      client,
      invoiceNumber,
      subtotal,
      taxRate: taxRate || 0,
      discount: discount || 0,
      discountType: discountType || "percentage",
      shippingFee: shippingFee || 0,
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      notes,
      termsAndConditions,
    });

    // Create invoice items
    if (items && items.length > 0) {
      const invoiceItems = await InvoiceItem.insertMany(
        items.map((item) => ({
          invoice: invoice._id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unit: item.unit,
          taxRate: item.taxRate,
          discount: item.discount,
          discountType: item.discountType,
          inventoryItem: item.inventoryItem,
        }))
      );

      // Update inventory if linked
      for (const item of items) {
        if (item.inventoryItem) {
          const inventoryItem = await Inventory.findById(item.inventoryItem);
          if (inventoryItem && inventoryItem.trackInventory) {
            await inventoryItem.reduceStock(
              item.quantity,
              "sale",
              invoice._id.toString(),
              `Invoice ${invoiceNumber}`,
              req.userId
            );
          }
        }
      }
    }

    // Get populated invoice
    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate("client")
      .populate("items");

    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: { invoice: populatedInvoice },
    });
  } catch (error) {
    console.error("Create invoice error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating invoice",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/invoices
 * @desc    Get all invoices for user with filters
 * @access  Private
 */
const getAllInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      client,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
      sortBy = "issueDate",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = { user: req.userId };

    if (status) {
      if (status.includes(",")) {
        query.status = { $in: status.split(",") };
      } else {
        query.status = status;
      }
    }

    if (client) query.client = client;

    if (startDate || endDate) {
      query.issueDate = {};
      if (startDate) query.issueDate.$gte = new Date(startDate);
      if (endDate) query.issueDate.$lte = new Date(endDate);
    }

    if (minAmount || maxAmount) {
      query.total = {};
      if (minAmount) query.total.$gte = parseFloat(minAmount);
      if (maxAmount) query.total.$lte = parseFloat(maxAmount);
    }

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const invoices = await Invoice.find(query)
      .populate("client", "name email phone")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        invoices,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get invoices error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching invoices",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/invoices/:id
 * @desc    Get invoice by ID with items
 * @access  Private
 */
const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.userId,
    })
      .populate("client")
      .populate("items");

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    // Get invoice items
    const items = await InvoiceItem.find({ invoice: invoice._id });

    res.status(200).json({
      success: true,
      data: {
        invoice,
        items,
      },
    });
  } catch (error) {
    console.error("Get invoice error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching invoice",
      error: error.message,
    });
  }
};

/**
 * @route   PUT /api/invoices/:id
 * @desc    Update invoice
 * @access  Private
 */
const updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    // Don't allow editing paid invoices
    if (invoice.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Cannot edit paid invoices",
      });
    }

    const {
      client,
      items,
      taxRate,
      discount,
      discountType,
      shippingFee,
      dueDate,
      notes,
      termsAndConditions,
      status,
    } = req.body;

    // Update fields
    if (client) invoice.client = client;
    if (taxRate !== undefined) invoice.taxRate = taxRate;
    if (discount !== undefined) invoice.discount = discount;
    if (discountType) invoice.discountType = discountType;
    if (shippingFee !== undefined) invoice.shippingFee = shippingFee;
    if (dueDate) invoice.dueDate = dueDate;
    if (notes !== undefined) invoice.notes = notes;
    if (termsAndConditions !== undefined)
      invoice.termsAndConditions = termsAndConditions;
    if (status) invoice.status = status;

    // Update items if provided
    if (items) {
      // Delete old items
      await InvoiceItem.deleteMany({ invoice: invoice._id });

      // Create new items
      let subtotal = 0;
      for (const item of items) {
        const itemSubtotal = item.quantity * item.unitPrice;
        subtotal += itemSubtotal;

        await InvoiceItem.create({
          invoice: invoice._id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unit: item.unit,
          taxRate: item.taxRate,
          discount: item.discount,
          discountType: item.discountType,
          inventoryItem: item.inventoryItem,
        });
      }

      invoice.subtotal = subtotal;
    }

    await invoice.save();

    const updatedInvoice = await Invoice.findById(invoice._id)
      .populate("client")
      .populate("items");

    res.status(200).json({
      success: true,
      message: "Invoice updated successfully",
      data: { invoice: updatedInvoice },
    });
  } catch (error) {
    console.error("Update invoice error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating invoice",
      error: error.message,
    });
  }
};

/**
 * @route   DELETE /api/invoices/:id
 * @desc    Delete invoice
 * @access  Private
 */
const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    // Don't allow deleting paid invoices
    if (invoice.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete paid invoices. Cancel instead.",
      });
    }

    // Delete invoice items
    await InvoiceItem.deleteMany({ invoice: invoice._id });

    // Delete invoice
    await invoice.deleteOne();

    res.status(200).json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error) {
    console.error("Delete invoice error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting invoice",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/invoices/:id/send
 * @desc    Mark invoice as sent
 * @access  Private
 */
const sendInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    await invoice.markAsSent();

    res.status(200).json({
      success: true,
      message: "Invoice marked as sent",
      data: { invoice },
    });
  } catch (error) {
    console.error("Send invoice error:", error);
    res.status(500).json({
      success: false,
      message: "Error sending invoice",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/invoices/overdue
 * @desc    Get overdue invoices
 * @access  Private
 */
const getOverdueInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.getOverdueInvoices(req.userId);

    res.status(200).json({
      success: true,
      data: {
        invoices,
        count: invoices.length,
      },
    });
  } catch (error) {
    console.error("Get overdue invoices error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching overdue invoices",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/invoices/stats
 * @desc    Get invoice statistics
 * @access  Private
 */
const getInvoiceStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const matchQuery = { user: req.userId };

    if (startDate || endDate) {
      matchQuery.issueDate = {};
      if (startDate) matchQuery.issueDate.$gte = new Date(startDate);
      if (endDate) matchQuery.issueDate.$lte = new Date(endDate);
    }

    const stats = await Invoice.aggregate([
      { $match: matchQuery },
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

    const statusBreakdown = await Invoice.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {
          totalInvoices: 0,
          totalAmount: 0,
          totalPaid: 0,
          totalDue: 0,
          averageAmount: 0,
        },
        byStatus: statusBreakdown,
      },
    });
  } catch (error) {
    console.error("Get invoice stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching invoice statistics",
      error: error.message,
    });
  }
};

module.exports = {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  sendInvoice,
  getOverdueInvoices,
  getInvoiceStats,
};
