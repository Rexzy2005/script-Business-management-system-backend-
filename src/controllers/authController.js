const User = require("../models/User");
const Payment = require("../models/Payment");
const { generateTokens, verifyRefreshToken } = require("../utils/jwt");
const crypto = require("crypto");
const axios = require("axios");

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user with business name, email, phone, and password
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { businessName, email, phone, password } = req.body;

    // Validate required fields
    if (!businessName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all required fields: businessName, email, phone, password",
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Create user
    const user = await User.create({
      businessName: businessName.trim(),
      email: email.toLowerCase(),
      phone: phone.trim(),
      password,
      role: "owner", // First user is owner
      isAdmin: false,
    });

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // Generate JWT tokens
    const tokens = generateTokens(user._id, user.email, user.role);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: userResponse,
        tokens,
      },
      verificationToken:
        process.env.NODE_ENV === "development" ? verificationToken : undefined,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Error registering user",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user and include password field
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(403).json({
        success: false,
        message:
          "Account is locked due to multiple failed login attempts. Please try again later.",
        lockUntil: user.lockUntil,
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Check account status - user must have paid (status must be active)
    if (user.status === "pending") {
      return res.status(403).json({
        success: false,
        message: "Please complete your premium plan payment to activate your account. If you've already paid, please wait a moment for verification.",
        code: "PAYMENT_PENDING",
        requiresPayment: true,
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Please contact support.`,
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT tokens
    const tokens = generateTokens(user._id, user.email, user.role);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: userResponse,
        tokens,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Error logging in",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    // Verify refresh token
    const { valid, expired, decoded } = verifyRefreshToken(refreshToken);

    if (expired) {
      return res.status(401).json({
        success: false,
        message: "Refresh token expired. Please login again.",
        code: "REFRESH_TOKEN_EXPIRED",
      });
    }

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    // Get user
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Check account status - user must have paid (status must be active)
    if (user.status === "pending") {
      return res.status(403).json({
        success: false,
        message: "Please complete your premium plan payment to activate your account.",
        code: "PAYMENT_PENDING",
        requiresPayment: true,
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Please contact support.`,
      });
    }

    // Generate new tokens
    const tokens = generateTokens(user._id, user.email, user.role);

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        tokens,
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Error refreshing token",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    // In a JWT system, logout is primarily client-side (remove token)
    // But we can log the logout event or invalidate refresh tokens if stored

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Error logging out",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
      error: error.message,
    });
  }
};

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile and business info
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const { businessName, phone, businessInfo, settings } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update core fields
    if (businessName) user.businessName = businessName.trim();
    if (phone) user.phone = phone.trim();
    
    // Update business profile info
    if (businessInfo) {
      user.businessInfo = {
        ...user.businessInfo,
        ...businessInfo,
      };
    }
    
    // Update settings
    if (settings) {
      user.settings = {
        ...user.settings,
        ...settings,
      };
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long",
      });
    }

    // Get user with password
    const user = await User.findById(req.userId).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Error changing password",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide email",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if user exists
      return res.status(200).json({
        success: true,
        message:
          "If an account exists with this email, a password reset link will be sent.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // TODO: Send email with reset link
    // const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    // await sendEmail(user.email, 'Password Reset', resetUrl);

    res.status(200).json({
      success: true,
      message:
        "If an account exists with this email, a password reset link will be sent.",
      resetToken:
        process.env.NODE_ENV === "development" ? resetToken : undefined,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing request",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide token and new password",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Hash token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with valid token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Update password
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Error resetting password",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email with token
 * @access  Public
 */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
    }

    // Hash token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with valid token
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    // Update user
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying email",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/auth/register-with-payment
 * @desc    Register a new user and initiate premium plan payment (500 Naira)
 * @access  Public
 */
const registerWithPayment = async (req, res) => {
  try {
    const { businessName, email, phone, password } = req.body;

    // Validate required fields
    if (!businessName || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all required fields: businessName, email, password",
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Validate and sanitize phone number (make it optional but validate format if provided)
    let phoneNumber = phone ? phone.trim() : "";
    // If phone is provided, validate it's actually a phone number (not an email)
    if (phoneNumber && phoneNumber.includes("@")) {
      // Looks like an email was sent instead of phone - make it empty
      phoneNumber = "";
    }
    // Basic phone validation - allow empty or valid phone format
    if (phoneNumber && !/^[0-9+\-\s()]+$/.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid phone number or leave it empty",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Create user with pending status (will be activated after payment)
    const user = await User.create({
      businessName: businessName.trim(),
      email: email.toLowerCase(),
      phone: phoneNumber || "0000000000", // Use placeholder if no phone provided
      password,
      role: "owner",
      isAdmin: false,
      status: "pending", // Account pending until payment is verified
      plan: {
        type: "premium",
        status: "pending",
        startDate: new Date(),
      },
    });

    // Generate transaction reference for payment
    const tx_ref = `SIGNUP-${Date.now()}-${user._id.toString().slice(-6)}`;
    const amount = 500; // 500 Naira premium plan

    // Initialize Flutterwave payment
    const flutterwavePayload = {
      tx_ref: tx_ref,
      amount: amount,
      currency: "NGN",
      redirect_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/signup/payment-verify`,
      customer: {
        email: email.toLowerCase(),
        phone_number: phoneNumber || "2340000000000", // Use placeholder if no phone
        name: businessName.trim(),
      },
      customizations: {
        title: "Premium Plan Signup - Script Business Management",
        description: "Premium plan subscription payment (₦500)",
        logo: process.env.BUSINESS_LOGO || "",
      },
      meta: {
        user_id: user._id.toString(),
        signup: true,
        plan: "premium",
      },
    };

    // Call Flutterwave API to initialize payment
    let flutterwaveResponse;
    try {
      flutterwaveResponse = await axios.post(
        "https://api.flutterwave.com/v3/payments",
        flutterwavePayload,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.error("Flutterwave API error:", error.response?.data || error.message);
      // Delete the user if payment initialization fails
      await User.findByIdAndDelete(user._id);
      return res.status(500).json({
        success: false,
        message: "Failed to initialize payment. Please try again.",
        error: error.response?.data?.message || error.message,
      });
    }

    // Store payment reference in user
    user.plan.paymentReference = tx_ref;
    await user.save();

    // Create pending payment record
    await Payment.create({
      user: user._id,
      amount: amount,
      currency: "NGN",
      method: "flutterwave",
      gateway: "flutterwave",
      transactionRef: tx_ref,
      externalRef: flutterwaveResponse.data.data?.id || null,
      status: "pending",
      gatewayResponse: flutterwaveResponse.data,
      metadata: {
        signup: true,
        plan: "premium",
      },
    });

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: "User registered. Please complete payment to activate your account.",
      data: {
        user: userResponse,
        payment: {
          tx_ref: tx_ref,
          amount: amount,
          currency: "NGN",
          paymentLink: flutterwaveResponse.data.data?.link,
          customer: {
            email: email.toLowerCase(),
            phone: phoneNumber || "",
            name: businessName.trim(),
          },
        },
      },
    });
  } catch (error) {
    console.error("Register with payment error:", error);
    res.status(500).json({
      success: false,
      message: "Error registering user",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/auth/verify-signup-payment
 * @desc    Verify signup payment and activate user account
 * @access  Public
 */
const verifySignupPayment = async (req, res) => {
  try {
    const { transaction_id, tx_ref } = req.body;

    if (!transaction_id || !tx_ref) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID and reference are required",
      });
    }

    // Verify payment with Flutterwave
    let verificationResponse;
    try {
      verificationResponse = await axios.get(
        `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          },
        }
      );
    } catch (error) {
      console.error("Flutterwave verification error:", error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to verify payment with Flutterwave",
        error: error.response?.data?.message || error.message,
      });
    }

    const { data: transactionData } = verificationResponse.data;

    // Check if payment was successful
    if (transactionData.status !== "successful") {
      return res.status(400).json({
        success: false,
        message: "Payment was not successful",
        transactionStatus: transactionData.status,
      });
    }

    // Verify amount matches (500 Naira)
    const expectedAmount = 500;
    if (parseFloat(transactionData.amount) !== expectedAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment amount mismatch. Expected ${expectedAmount} Naira, got ${transactionData.amount}`,
      });
    }

    // Find user by payment reference
    const user = await User.findOne({ "plan.paymentReference": tx_ref });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found for this payment reference",
      });
    }

    // Check if payment was already verified
    if (user.status === "active" && user.plan.status === "active") {
      // Payment already verified, return success
      const tokens = generateTokens(user._id, user.email, user.role);
      const userResponse = user.toObject();
      delete userResponse.password;

      return res.status(200).json({
        success: true,
        message: "Payment already verified. Account is active.",
        data: {
          user: userResponse,
          tokens,
        },
      });
    }

    // Find and update payment record
    const payment = await Payment.findOne({ transactionRef: tx_ref });
    if (payment) {
      payment.status = "completed";
      payment.externalRef = transaction_id;
      payment.gatewayResponse = verificationResponse.data;
      payment.completedAt = new Date();
      payment.verified = true;
      payment.verifiedAt = new Date();
      
      // Extract card details if available
      if (transactionData.card) {
        payment.cardDetails = {
          last4: transactionData.card.last_4digits,
          cardType: transactionData.card.type,
          cardBrand: transactionData.card.issuer,
        };
      }
      
      await payment.save();
    }

    // Activate user account
    user.status = "active";
    user.plan.status = "active";
    user.plan.type = "premium";
    user.plan.paymentTransactionId = transaction_id;
    user.plan.paymentVerifiedAt = new Date();
    user.plan.startDate = new Date();
    // Set plan end date to 1 year from now (or adjust as needed)
    user.plan.endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    
    // Set premium plan features
    user.plan.features = {
      maxInvoices: -1, // Unlimited
      maxClients: -1, // Unlimited
      maxInventoryItems: -1, // Unlimited
      advancedAnalytics: true,
      multiUser: true,
    };

    await user.save();

    // Generate JWT tokens
    const tokens = generateTokens(user._id, user.email, user.role);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: "Payment verified successfully. Your account has been activated!",
      data: {
        user: userResponse,
        tokens,
      },
    });
  } catch (error) {
    console.error("Verify signup payment error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying payment",
      error: error.message,
    });
  }
};

module.exports = {
  register,
  registerWithPayment,
  verifySignupPayment,
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
};
