const Payment = require("../models/Payment");
const { Invoice } = require("../models/Invoice");
const axios = require("axios");

/**
 * @route   POST /api/payments
 * @desc    Create a new payment
 * @access  Private
 */
const createPayment = async (req, res) => {
  try {
    const {
      invoice,
      client,
      amount,
      method,
      bankDetails,
      chequeDetails,
      cardDetails,
      mobileMoneyDetails,
      notes,
    } = req.body;

    // Validate invoice if provided
    if (invoice) {
      const invoiceDoc = await Invoice.findOne({
        _id: invoice,
        user: req.userId,
      });

      if (!invoiceDoc) {
        return res.status(404).json({
          success: false,
          message: "Invoice not found",
        });
      }

      // Check if amount exceeds remaining balance
      if (amount > invoiceDoc.amountDue) {
        return res.status(400).json({
          success: false,
          message: `Payment amount (${amount}) exceeds invoice balance (${invoiceDoc.amountDue})`,
        });
      }
    }

    // Generate transaction reference
    const transactionRef = Payment.generateTransactionRef();

    // Create payment
    const payment = await Payment.create({
      user: req.userId,
      invoice,
      client,
      amount,
      method,
      transactionRef,
      bankDetails,
      chequeDetails,
      cardDetails,
      mobileMoneyDetails,
      notes,
      status: "pending",
    });

    // Auto-complete for cash payments
    if (method === "cash") {
      await payment.markAsCompleted();
    }

    const populatedPayment = await Payment.findById(payment._id)
      .populate("invoice")
      .populate("client");

    res.status(201).json({
      success: true,
      message: "Payment created successfully",
      data: { payment: populatedPayment },
    });
  } catch (error) {
    console.error("Create payment error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating payment",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/payments/flutterwave/initialize
 * @desc    Initialize Flutterwave payment
 * @access  Private
 */
const initializeFlutterwavePayment = async (req, res) => {
  try {
    const { invoice, amount, email, phone, name } = req.body;

    // Validate invoice
    const invoiceDoc = await Invoice.findOne({
      _id: invoice,
      user: req.userId,
    }).populate("client");

    if (!invoiceDoc) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    // Generate transaction reference
    const transactionRef = Payment.generateTransactionRef();

    // Flutterwave payment payload
    const payload = {
      tx_ref: transactionRef,
      amount: amount,
      currency: "NGN",
      redirect_url: `${process.env.FRONTEND_URL}/payments/verify`,
      customer: {
        email: email || invoiceDoc.client.email,
        phone_number: phone || invoiceDoc.client.phone,
        name: name || invoiceDoc.client.name,
      },
      customizations: {
        title: `Payment for Invoice ${invoiceDoc.invoiceNumber}`,
        description: `Invoice payment`,
        logo: process.env.BUSINESS_LOGO || "",
      },
      meta: {
        invoice_id: invoice,
        user_id: req.userId.toString(),
      },
    };

    // Call Flutterwave API
    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Create pending payment record
    await Payment.create({
      user: req.userId,
      invoice,
      client: invoiceDoc.client._id,
      amount,
      method: "flutterwave",
      gateway: "flutterwave",
      transactionRef,
      externalRef: response.data.data.id,
      status: "pending",
      gatewayResponse: response.data,
    });

    res.status(200).json({
      success: true,
      message: "Payment initialized successfully",
      data: {
        paymentLink: response.data.data.link,
        transactionRef,
      },
    });
  } catch (error) {
    console.error("Initialize Flutterwave payment error:", error);
    res.status(500).json({
      success: false,
      message: "Error initializing payment",
      error: error.response?.data?.message || error.message,
    });
  }
};

/**
 * @route   POST /api/payments/flutterwave/verify
 * @desc    Verify Flutterwave payment
 * @access  Private
 */
const verifyFlutterwavePayment = async (req, res) => {
  try {
    const { transaction_id, tx_ref } = req.body;

    if (!transaction_id || !tx_ref) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID and reference are required",
      });
    }

    // Verify with Flutterwave
    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    const { data } = response.data;

    // Find payment record
    const payment = await Payment.findOne({ transactionRef: tx_ref });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    // Update payment based on verification
    if (data.status === "successful" && data.amount >= payment.amount) {
      payment.status = "completed";
      payment.gatewayResponse = response.data;
      payment.externalRef = data.id;

      // Extract card details if available
      if (data.card) {
        payment.cardDetails = {
          last4: data.card.last_4digits,
          cardType: data.card.type,
          cardBrand: data.card.issuer,
        };
      }

      await payment.markAsCompleted();

      res.status(200).json({
        success: true,
        message: "Payment verified and completed successfully",
        data: { payment },
      });
    } else {
      payment.status = "failed";
      await payment.save();

      res.status(400).json({
        success: false,
        message: "Payment verification failed",
        data: { payment },
      });
    }
  } catch (error) {
    console.error("Verify Flutterwave payment error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying payment",
      error: error.response?.data?.message || error.message,
    });
  }
};

/**
 * @route   GET /api/payments
 * @desc    Get all payments for user
 * @access  Private
 */
const getAllPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      method,
      invoice,
      client,
      startDate,
      endDate,
      sortBy = "paymentDate",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = { user: req.userId };

    if (status) query.status = status;
    if (method) query.method = method;
    if (invoice) query.invoice = invoice;
    if (client) query.client = client;

    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) query.paymentDate.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const payments = await Payment.find(query)
      .populate("invoice", "invoiceNumber total")
      .populate("client", "name email")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get payments error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payments",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/payments/:id
 * @desc    Get payment by ID
 * @access  Private
 */
const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      user: req.userId,
    })
      .populate("invoice")
      .populate("client");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: { payment },
    });
  } catch (error) {
    console.error("Get payment error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payment",
      error: error.message,
    });
  }
};

/**
 * @route   PUT /api/payments/:id/status
 * @desc    Update payment status
 * @access  Private
 */
const updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (
      !["pending", "processing", "completed", "failed", "cancelled"].includes(
        status
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const payment = await Payment.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (status === "completed") {
      await payment.markAsCompleted();
    } else if (status === "failed") {
      await payment.markAsFailed();
    } else {
      payment.status = status;
      await payment.save();
    }

    res.status(200).json({
      success: true,
      message: "Payment status updated successfully",
      data: { payment },
    });
  } catch (error) {
    console.error("Update payment status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating payment status",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/payments/:id/refund
 * @desc    Process payment refund
 * @access  Private
 */
const refundPayment = async (req, res) => {
  try {
    const { amount, reason } = req.body;

    const payment = await Payment.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    await payment.processRefund(amount || payment.amount, reason, req.userId);

    res.status(200).json({
      success: true,
      message: "Payment refunded successfully",
      data: { payment },
    });
  } catch (error) {
    console.error("Refund payment error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error processing refund",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/payments/stats
 * @desc    Get payment statistics
 * @access  Private
 */
const getPaymentStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await Payment.getPaymentStats(
      req.userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get payment stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payment statistics",
      error: error.message,
    });
  }
};

module.exports = {
  createPayment,
  initializeFlutterwavePayment,
  verifyFlutterwavePayment,
  getAllPayments,
  getPaymentById,
  updatePaymentStatus,
  refundPayment,
  getPaymentStats,
};
