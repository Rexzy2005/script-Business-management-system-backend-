const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    // References
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      index: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      index: true,
    },

    // Payment Details
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"],
    },
    currency: {
      type: String,
      default: "NGN",
      uppercase: true,
    },

    // Payment Method
    method: {
      type: String,
      required: [true, "Payment method is required"],
      enum: [
        "cash",
        "bank_transfer",
        "card",
        "debit_card",
        "credit_card",
        "cheque",
        "mobile_money",
        "ussd",
        "bank_account",
        "pos",
        "wallet",
        "flutterwave",
        "other",
      ],
    },

    // Payment Gateway Info (for online payments)
    gateway: {
      type: String,
      enum: ["flutterwave", "paystack", "stripe", "other"],
    },
    gatewayResponse: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },

    // Transaction References
    transactionRef: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    externalRef: {
      type: String, // Reference from payment gateway
      sparse: true,
    },
    receiptNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    // Status
    status: {
      type: String,
      required: true,
      enum: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
        "refunded",
      ],
      default: "pending",
      index: true,
    },

    // Dates
    paymentDate: {
      type: Date,
      required: [true, "Payment date is required"],
      default: Date.now,
      index: true,
    },
    processedAt: Date,
    completedAt: Date,
    failedAt: Date,
    refundedAt: Date,

    // Bank Transfer Details
    bankDetails: {
      accountNumber: String,
      accountName: String,
      bankName: String,
      transferDate: Date,
      transferReference: String,
    },

    // Cheque Details
    chequeDetails: {
      chequeNumber: String,
      bankName: String,
      chequeDate: Date,
      clearedDate: Date,
      status: {
        type: String,
        enum: ["pending", "cleared", "bounced"],
      },
    },

    // Card Details (minimal, for reference only)
    cardDetails: {
      last4: String,
      cardType: String, // visa, mastercard, etc.
      expiryMonth: String,
      expiryYear: String,
      cardBrand: String,
    },

    // Mobile Money Details
    mobileMoneyDetails: {
      provider: String, // MTN, Airtel, etc.
      phoneNumber: String,
      transactionId: String,
    },

    // Split Payments (if payment is split across multiple invoices)
    splits: [
      {
        invoice: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Invoice",
        },
        amount: Number,
      },
    ],

    // Fee Information
    fees: {
      gateway: {
        type: Number,
        default: 0,
      },
      transaction: {
        type: Number,
        default: 0,
      },
      total: {
        type: Number,
        default: 0,
      },
    },
    netAmount: Number, // Amount after fees

    // Additional Information
    notes: {
      type: String,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    internalNotes: {
      type: String,
      maxlength: [500, "Internal notes cannot exceed 500 characters"],
    },

    // Verification
    verified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    verifiedAt: Date,

    // Refund Information
    refund: {
      amount: Number,
      reason: String,
      refundedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      refundDate: Date,
      refundReference: String,
    },

    // Receipt
    receiptUrl: String,
    receiptSent: {
      type: Boolean,
      default: false,
    },
    receiptSentAt: Date,

    // Metadata
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },

    // IP and Device Info (for online payments)
    ipAddress: String,
    userAgent: String,
    deviceId: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes
paymentSchema.index({ user: 1, paymentDate: -1 });
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ user: 1, invoice: 1 });
paymentSchema.index({ user: 1, client: 1 });
paymentSchema.index({ transactionRef: 1 }, { unique: true, sparse: true });
paymentSchema.index({ receiptNumber: 1 }, { unique: true, sparse: true });

// Virtual for payment age
paymentSchema.virtual("ageInDays").get(function () {
  const now = new Date();
  const paymentDate = new Date(this.paymentDate);
  const diffTime = Math.abs(now - paymentDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for is pending
paymentSchema.virtual("isPending").get(function () {
  return this.status === "pending" || this.status === "processing";
});

// Virtual for is successful
paymentSchema.virtual("isSuccessful").get(function () {
  return this.status === "completed";
});

// Pre-save middleware
paymentSchema.pre("save", function (next) {
  // Calculate net amount
  if (this.fees && this.fees.total) {
    this.netAmount = this.amount - this.fees.total;
  } else {
    this.netAmount = this.amount;
  }

  // Generate receipt number if completed and not exists
  if (this.status === "completed" && !this.receiptNumber) {
    this.receiptNumber = this.generateReceiptNumber();
  }

  // Set completion date
  if (this.status === "completed" && !this.completedAt) {
    this.completedAt = new Date();
  }

  // Set failed date
  if (this.status === "failed" && !this.failedAt) {
    this.failedAt = new Date();
  }

  next();
});

// Method to generate transaction reference
paymentSchema.methods.generateTransactionRef = function () {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `TXN-${timestamp}-${random}`;
};

// Method to generate receipt number
paymentSchema.methods.generateReceiptNumber = function () {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 10000);
  return `RCP-${year}${month}-${random}`;
};

// Method to mark as completed
paymentSchema.methods.markAsCompleted = async function () {
  this.status = "completed";
  this.completedAt = new Date();

  // Update invoice if linked
  if (this.invoice) {
    const Invoice = mongoose.model("Invoice");
    const invoice = await Invoice.findById(this.invoice);
    if (invoice) {
      await invoice.addPayment(this.amount);
    }
  }

  // Update client financials if linked
  if (this.client) {
    const Client = mongoose.model("Client");
    const client = await Client.findById(this.client);
    if (client) {
      client.totalPaid += this.amount;
      client.stats.lastPaymentDate = new Date();
      await client.save();
    }
  }

  return this.save();
};

// Method to mark as failed
paymentSchema.methods.markAsFailed = function (reason = "") {
  this.status = "failed";
  this.failedAt = new Date();
  if (reason) {
    this.notes = `Failed: ${reason}`;
  }
  return this.save();
};

// Method to process refund
paymentSchema.methods.processRefund = async function (amount, reason, userId) {
  if (this.status !== "completed") {
    throw new Error("Can only refund completed payments");
  }

  if (amount > this.amount) {
    throw new Error("Refund amount cannot exceed payment amount");
  }

  this.status = "refunded";
  this.refundedAt = new Date();
  this.refund = {
    amount,
    reason,
    refundedBy: userId,
    refundDate: new Date(),
    refundReference: `REF-${Date.now()}`,
  };

  // Update invoice if linked
  if (this.invoice) {
    const Invoice = mongoose.model("Invoice");
    const invoice = await Invoice.findById(this.invoice);
    if (invoice) {
      invoice.amountPaid -= amount;
      invoice.amountDue += amount;
      if (invoice.amountPaid === 0) {
        invoice.paymentStatus = "unpaid";
        invoice.status = "sent";
      } else if (invoice.amountPaid < invoice.total) {
        invoice.paymentStatus = "partial";
        invoice.status = "partial";
      }
      await invoice.save();
    }
  }

  return this.save();
};

// Method to verify payment
paymentSchema.methods.verify = function (userId) {
  this.verified = true;
  this.verifiedBy = userId;
  this.verifiedAt = new Date();
  return this.save();
};

// Static method to generate transaction reference
paymentSchema.statics.generateTransactionRef = function () {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 100000);
  return `TXN-${timestamp}-${random}`;
};

// Static method to get payments by date range
paymentSchema.statics.getPaymentsByDateRange = function (
  userId,
  startDate,
  endDate
) {
  return this.find({
    user: userId,
    paymentDate: {
      $gte: startDate,
      $lte: endDate,
    },
  })
    .populate("invoice client")
    .sort({ paymentDate: -1 });
};

// Static method to get payment statistics
paymentSchema.statics.getPaymentStats = async function (
  userId,
  startDate,
  endDate
) {
  const match = {
    user: mongoose.Types.ObjectId(userId),
    status: "completed",
  };

  if (startDate && endDate) {
    match.paymentDate = { $gte: startDate, $lte: endDate };
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        totalTransactions: { $sum: 1 },
        averageAmount: { $avg: "$amount" },
        totalFees: { $sum: "$fees.total" },
        netAmount: { $sum: "$netAmount" },
      },
    },
  ]);

  const methodBreakdown = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$method",
        count: { $sum: 1 },
        total: { $sum: "$amount" },
      },
    },
    { $sort: { total: -1 } },
  ]);

  return {
    summary: stats[0] || {
      totalAmount: 0,
      totalTransactions: 0,
      averageAmount: 0,
      totalFees: 0,
      netAmount: 0,
    },
    byMethod: methodBreakdown,
  };
};

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
