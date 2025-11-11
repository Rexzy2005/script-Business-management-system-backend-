const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // Business Information (Primary - used at signup)
    businessName: {
      type: String,
      required: [true, "Business name is required"],
      trim: true,
      minlength: [2, "Business name must be at least 2 characters"],
      maxlength: [100, "Business name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^[0-9+\-\s()]+$/, "Please provide a valid phone number"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // Don't include password in queries by default
    },

    // Additional Business Profile Info (Updated later by user)
    businessInfo: {
      address: {
        street: String,
        city: String,
        state: String,
        country: String,
        postalCode: String,
      },
      taxId: String,
      website: String,
      logo: String, // URL to logo image
      industry: {
        type: String,
        enum: [
          "retail",
          "services",
          "manufacturing",
          "wholesale",
          "technology",
          "healthcare",
          "other",
        ],
        default: "other",
      },
    },

    // Role & Permissions
    role: {
      type: String,
      enum: ["owner", "admin", "manager", "staff"],
      default: "owner",
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },

    // Subscription Plan
    plan: {
      type: {
        type: String,
        enum: ["free", "basic", "professional", "enterprise", "premium"],
        default: "free",
      },
      startDate: {
        type: Date,
        default: Date.now,
      },
      endDate: Date,
      status: {
        type: String,
        enum: ["active", "expired", "cancelled", "pending"],
        default: "pending",
      },
      features: {
        maxInvoices: { type: Number, default: 10 },
        maxClients: { type: Number, default: 5 },
        maxInventoryItems: { type: Number, default: 50 },
        advancedAnalytics: { type: Boolean, default: false },
        multiUser: { type: Boolean, default: false },
      },
      // Payment tracking for premium signup
      paymentReference: String, // Flutterwave transaction reference
      paymentTransactionId: String, // Flutterwave transaction ID
      paymentVerifiedAt: Date,
    },

    // Account Status
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "pending"],
      default: "pending", // Changed to pending - user must pay before activation
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,

    // Password Reset
    passwordResetToken: String,
    passwordResetExpires: Date,

    // Login tracking
    lastLogin: Date,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,

    // Settings & Preferences
    settings: {
      currency: {
        type: String,
        default: "NGN",
      },
      timezone: {
        type: String,
        default: "Africa/Lagos",
      },
      dateFormat: {
        type: String,
        default: "DD/MM/YYYY",
      },
      language: {
        type: String,
        default: "en",
      },
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        lowStock: { type: Boolean, default: true },
        invoiceDue: { type: Boolean, default: true },
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ businessName: 1 });
userSchema.index({ status: 1 });
userSchema.index({ "plan.type": 1 });

// Virtual for account lock status
userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre("save", async function (next) {
  // Only hash password if it's modified
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function () {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  // Otherwise increment
  const updates = { $inc: { loginAttempts: 1 } };
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours

  // Lock account after max attempts
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }

  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 },
  });
};

// Static method to check plan limits
userSchema.statics.checkPlanLimit = async function (userId, limitType) {
  const user = await this.findById(userId);
  if (!user) throw new Error("User not found");

  const limit = user.plan.features[limitType];
  if (limit === -1 || limit === undefined) return true; // Unlimited

  // Here you would count the actual resources
  // This is a placeholder - implement based on your needs
  return true;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
