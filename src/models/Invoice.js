const mongoose = require("mongoose");

// Invoice Item Schema
const invoiceItemSchema = new mongoose.Schema(
  {
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, "Item description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0.01, "Quantity must be greater than 0"],
      default: 1,
    },
    unitPrice: {
      type: Number,
      required: [true, "Unit price is required"],
      min: [0, "Unit price cannot be negative"],
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, "Subtotal cannot be negative"],
    },
    // Optional fields
    unit: {
      type: String,
      trim: true,
      default: "unit",
    },
    taxRate: {
      type: Number,
      min: [0, "Tax rate cannot be negative"],
      max: [100, "Tax rate cannot exceed 100%"],
      default: 0,
    },
    discount: {
      type: Number,
      min: [0, "Discount cannot be negative"],
      default: 0,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    // Link to inventory (optional)
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
    },
  },
  {
    timestamps: true,
  }
);

// Calculate subtotal before saving
invoiceItemSchema.pre("save", function (next) {
  let subtotal = this.quantity * this.unitPrice;

  // Apply discount
  if (this.discount > 0) {
    if (this.discountType === "percentage") {
      subtotal -= (subtotal * this.discount) / 100;
    } else {
      subtotal -= this.discount;
    }
  }

  this.subtotal = Math.max(0, subtotal);
  next();
});

// Invoice Schema
const invoiceSchema = new mongoose.Schema(
  {
    // References
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Client reference is required"],
      index: true,
    },

    // Invoice Details
    invoiceNumber: {
      type: String,
      required: [true, "Invoice number is required"],
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    termsAndConditions: {
      type: String,
      trim: true,
      maxlength: [2000, "Terms cannot exceed 2000 characters"],
    },

    // Financial Details
    subtotal: {
      type: Number,
      required: true,
      min: [0, "Subtotal cannot be negative"],
      default: 0,
    },
    taxRate: {
      type: Number,
      min: [0, "Tax rate cannot be negative"],
      max: [100, "Tax rate cannot exceed 100%"],
      default: 0,
    },
    taxAmount: {
      type: Number,
      min: [0, "Tax amount cannot be negative"],
      default: 0,
    },
    discount: {
      type: Number,
      min: [0, "Discount cannot be negative"],
      default: 0,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    shippingFee: {
      type: Number,
      min: [0, "Shipping fee cannot be negative"],
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      min: [0, "Total cannot be negative"],
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: [0, "Amount paid cannot be negative"],
    },
    amountDue: {
      type: Number,
      default: 0,
      min: [0, "Amount due cannot be negative"],
    },

    // Dates
    issueDate: {
      type: Date,
      required: [true, "Issue date is required"],
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    paidDate: Date,

    // Status
    status: {
      type: String,
      enum: [
        "draft",
        "sent",
        "viewed",
        "partial",
        "paid",
        "overdue",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
    },

    // Payment Details
    paymentMethod: {
      type: String,
      enum: [
        "cash",
        "bank_transfer",
        "card",
        "cheque",
        "mobile_money",
        "other",
      ],
    },
    paymentReference: String,

    // Tracking
    sentAt: Date,
    viewedAt: Date,
    remindersSent: {
      type: Number,
      default: 0,
    },
    lastReminderAt: Date,

    // Currency
    currency: {
      type: String,
      default: "NGN",
      uppercase: true,
    },

    // Attachments
    attachments: [
      {
        name: String,
        url: String,
        size: Number,
        type: String,
      },
    ],

    // Custom Fields
    customFields: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes
invoiceSchema.index({ user: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ user: 1, status: 1 });
invoiceSchema.index({ user: 1, client: 1 });
invoiceSchema.index({ user: 1, dueDate: 1 });
invoiceSchema.index({ issueDate: -1 });
invoiceSchema.index({ dueDate: 1 });

// Virtual for invoice items
invoiceSchema.virtual("items", {
  ref: "InvoiceItem",
  localField: "_id",
  foreignField: "invoice",
});

// Virtual for days until due
invoiceSchema.virtual("daysUntilDue").get(function () {
  if (this.status === "paid") return 0;
  const today = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for is overdue
invoiceSchema.virtual("isOverdue").get(function () {
  if (this.status === "paid" || this.status === "cancelled") return false;
  return new Date() > new Date(this.dueDate);
});

// Virtual for balance
invoiceSchema.virtual("balance").get(function () {
  return this.total - this.amountPaid;
});

// Pre-save middleware to calculate totals
invoiceSchema.pre("save", function (next) {
  // Calculate tax amount
  this.taxAmount = this.subtotal * (this.taxRate / 100);

  // Calculate total after discount
  let total = this.subtotal + this.taxAmount + this.shippingFee;

  if (this.discount > 0) {
    if (this.discountType === "percentage") {
      total -= (this.subtotal * this.discount) / 100;
    } else {
      total -= this.discount;
    }
  }

  this.total = Math.max(0, total);
  this.amountDue = Math.max(0, this.total - this.amountPaid);

  // Update payment status
  if (this.amountPaid === 0) {
    this.paymentStatus = "unpaid";
  } else if (this.amountPaid >= this.total) {
    this.paymentStatus = "paid";
    this.status = "paid";
    if (!this.paidDate) {
      this.paidDate = new Date();
    }
  } else {
    this.paymentStatus = "partial";
    this.status = "partial";
  }

  // Update overdue status
  if (this.isOverdue && this.status !== "paid" && this.status !== "cancelled") {
    this.status = "overdue";
  }

  next();
});

// Method to add payment
invoiceSchema.methods.addPayment = function (amount) {
  this.amountPaid += amount;
  if (this.amountPaid >= this.total) {
    this.status = "paid";
    this.paymentStatus = "paid";
    this.paidDate = new Date();
  } else {
    this.status = "partial";
    this.paymentStatus = "partial";
  }
  this.amountDue = Math.max(0, this.total - this.amountPaid);
  return this.save();
};

// Method to mark as sent
invoiceSchema.methods.markAsSent = function () {
  if (this.status === "draft") {
    this.status = "sent";
    this.sentAt = new Date();
  }
  return this.save();
};

// Method to mark as viewed
invoiceSchema.methods.markAsViewed = function () {
  if (!this.viewedAt) {
    this.viewedAt = new Date();
    if (this.status === "sent") {
      this.status = "viewed";
    }
  }
  return this.save();
};

// Static method to generate invoice number
invoiceSchema.statics.generateInvoiceNumber = async function (userId) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  // Find last invoice for this user
  const lastInvoice = await this.findOne({
    user: userId,
    invoiceNumber: new RegExp(`^${prefix}`),
  }).sort({ invoiceNumber: -1 });

  let nextNumber = 1;
  if (lastInvoice) {
    const lastNumber = parseInt(lastInvoice.invoiceNumber.split("-").pop());
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
};

// Static method to get overdue invoices
invoiceSchema.statics.getOverdueInvoices = function (userId) {
  return this.find({
    user: userId,
    status: { $nin: ["paid", "cancelled"] },
    dueDate: { $lt: new Date() },
  }).populate("client");
};

const Invoice = mongoose.model("Invoice", invoiceSchema);
const InvoiceItem = mongoose.model("InvoiceItem", invoiceItemSchema);

module.exports = { Invoice, InvoiceItem };
