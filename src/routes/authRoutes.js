const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/authController");
const { authenticate } = require("../middlewares/authMiddleware");
const { authLimiter } = require("../config/rateLimiter");

/**
 * Public Routes
 */

// @route   POST /api/auth/register
// @desc    Register a new user (legacy endpoint - use register-with-payment for premium signup)
// @access  Public
router.post("/register", authLimiter, register);

// @route   POST /api/auth/register-with-payment
// @desc    Register a new user and initiate premium plan payment (500 Naira)
// @access  Public
router.post("/register-with-payment", authLimiter, registerWithPayment);

// @route   POST /api/auth/verify-signup-payment
// @desc    Verify signup payment and activate user account
// @access  Public
router.post("/verify-signup-payment", authLimiter, verifySignupPayment);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post("/login", authLimiter, login);

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post("/refresh", refreshToken);

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post("/forgot-password", authLimiter, forgotPassword);

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post("/reset-password", authLimiter, resetPassword);

// @route   POST /api/auth/verify-email
// @desc    Verify email with token
// @access  Public
router.post("/verify-email", verifyEmail);

/**
 * Protected Routes (require authentication)
 */

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post("/logout", authenticate, logout);

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get("/me", authenticate, getProfile);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put("/profile", authenticate, updateProfile);

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put("/change-password", authenticate, changePassword);

module.exports = router;
