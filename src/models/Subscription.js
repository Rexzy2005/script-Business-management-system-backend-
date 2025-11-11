const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    // User reference
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },

    // Plan details
    planType: {
      type: String,
      required: [true, "Plan type is required"],
      enum: ["monthly", "yearly"],
      index: true,
    },
    planName: {
      type: String,
      default: "premium",
    },

    // Pricing
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount must be positive"],
    },
    currency: {
      type: String,
      default: "NGN",
      uppercase: true,
    },

    // Subscription period
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
      default: Date.now,
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
      index: true,
    },
    nextBillingDate: {
      type: Date,
      index: true,
    },

    // Status
    status: {
      type: String,
      required: true,
      enum: ["active", "expired", "cancelled", "pending", "suspended"],
      default: "pending",
      index: true,
    },

    // Auto-renewal
    autoRenew: {
      type: Boolean,
      default: true,
    },
    cancelledAt: Date,
    cancellationReason: String,

    // Payment information
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    paymentReference: {
      type: String,
      index: true,
    },
    paymentTransactionId: String,
    paymentVerifiedAt: Date,

    // Features and limits
    features: {
      maxInvoices: {
        type: Number,
        default: -1, // -1 means unlimited
      },
      maxClients: {
        type: Number,
        default: -1,
      },
      maxInventoryItems: {
        type: Number,
        default: -1,
      },
      advancedAnalytics: {
        type: Boolean,
        default: true,
      },
      multiUser: {
        type: Boolean,
        default: true,
      },
      prioritySupport: {
        type: Boolean,
        default: true,
      },
      dataExport: {
        type: Boolean,
        default: true,
      },
      customBranding: {
        type: Boolean,
        default: false,
      },
    },

    // Renewal history
    renewalHistory: [
      {
        renewalDate: Date,
        amount: Number,
        payment: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Payment",
        },
        paymentReference: String,
      },
    ],

    // Trial information (if applicable)
    isTrial: {
      type: Boolean,
      default: false,
    },
    trialEndDate: Date,

    // Grace period (days after expiry before suspension)
    gracePeriodDays: {
      type: Number,
      default: 7,
    },

    // Metadata
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ user: 1, endDate: 1 });
subscriptionSchema.index({ status: 1, endDate: 1 });
subscriptionSchema.index({ paymentReference: 1 });

// Virtual for days remaining
subscriptionSchema.virtual("daysRemaining").get(function () {
  if (this.status !== "active") return 0;
  const now = new Date();
  const end = new Date(this.endDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

// Virtual for is active
subscriptionSchema.virtual("isActive").get(function () {
  return this.status === "active" && new Date() <= new Date(this.endDate);
});

// Virtual for is expired
subscriptionSchema.virtual("isExpired").get(function () {
  return this.status === "expired" || (this.status === "active" && new Date() > new Date(this.endDate));
});

// Virtual for is in grace period
subscriptionSchema.virtual("isInGracePeriod").get(function () {
  if (this.status !== "active") return false;
  const now = new Date();
  const end = new Date(this.endDate);
  const graceEnd = new Date(end.getTime() + this.gracePeriodDays * 24 * 60 * 60 * 1000);
  return now > end && now <= graceEnd;
});

// Pre-save middleware
subscriptionSchema.pre("save", function (next) {
  // Set next billing date for active subscriptions
  if (this.status === "active" && this.autoRenew && !this.nextBillingDate) {
    if (this.planType === "yearly") {
      this.nextBillingDate = new Date(this.endDate);
    } else {
      this.nextBillingDate = new Date(this.endDate);
    }
  }

  // Auto-update status based on dates
  if (this.status === "active") {
    const now = new Date();
    const end = new Date(this.endDate);
    if (now > end) {
      // Check if in grace period
      const graceEnd = new Date(end.getTime() + this.gracePeriodDays * 24 * 60 * 60 * 1000);
      if (now > graceEnd) {
        this.status = "expired";
      }
    }
  }

  next();
});

// Method to activate subscription
subscriptionSchema.methods.activate = function (paymentId, transactionId) {
  this.status = "active";
  this.payment = paymentId;
  this.paymentTransactionId = transactionId;
  this.paymentVerifiedAt = new Date();
  this.startDate = new Date();
  
  // Set end date based on plan type
  if (this.planType === "yearly") {
    this.endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  } else {
    this.endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  
  this.nextBillingDate = new Date(this.endDate);
  return this.save();
};

// Method to renew subscription
subscriptionSchema.methods.renew = async function (paymentId, transactionId) {
  if (this.status !== "active" && this.status !== "expired") {
    throw new Error("Can only renew active or expired subscriptions");
  }

  // Add to renewal history
  this.renewalHistory.push({
    renewalDate: new Date(),
    amount: this.amount,
    payment: paymentId,
    paymentReference: transactionId,
  });

  // Update dates
  const currentEndDate = new Date(this.endDate);
  const now = new Date();
  
  // If subscription hasn't expired, extend from current end date
  // Otherwise, start from now
  const baseDate = currentEndDate > now ? currentEndDate : now;

  if (this.planType === "yearly") {
    this.endDate = new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000);
  } else {
    this.endDate = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  this.status = "active";
  this.payment = paymentId;
  this.paymentTransactionId = transactionId;
  this.paymentVerifiedAt = new Date();
  this.nextBillingDate = new Date(this.endDate);
  this.cancelledAt = undefined;
  this.cancellationReason = undefined;

  return this.save();
};

// Method to cancel subscription
subscriptionSchema.methods.cancel = function (reason = "") {
  this.status = "cancelled";
  this.autoRenew = false;
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  return this.save();
};

// Method to suspend subscription
subscriptionSchema.methods.suspend = function (reason = "") {
  this.status = "suspended";
  this.cancellationReason = reason;
  return this.save();
};

// Static method to find active subscription for user
subscriptionSchema.statics.findActiveForUser = function (userId) {
  return this.findOne({
    user: userId,
    status: "active",
    endDate: { $gte: new Date() },
  }).sort({ createdAt: -1 });
};

// Static method to find or create subscription
subscriptionSchema.statics.findOrCreate = async function (userId, planType, amount) {
  let subscription = await this.findOne({
    user: userId,
    status: { $in: ["active", "pending"] },
  }).sort({ createdAt: -1 });

  if (!subscription) {
    subscription = await this.create({
      user: userId,
      planType,
      amount,
      status: "pending",
      startDate: new Date(),
      endDate: new Date(),
    });
  }

  return subscription;
};

// Static method to check if user has active subscription
subscriptionSchema.statics.hasActiveSubscription = async function (userId) {
  const subscription = await this.findActiveForUser(userId);
  return !!subscription;
};

// Static method to get subscription stats
subscriptionSchema.statics.getStats = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalRevenue: { $sum: "$amount" },
      },
    },
  ]);

  const planTypeStats = await this.aggregate([
    {
      $group: {
        _id: "$planType",
        count: { $sum: 1 },
        totalRevenue: { $sum: "$amount" },
      },
    },
  ]);

  return {
    byStatus: stats,
    byPlanType: planTypeStats,
  };
};

const Subscription = mongoose.model("Subscription", subscriptionSchema);

module.exports = Subscription;

