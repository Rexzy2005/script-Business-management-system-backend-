// ==================== paymentRoutes.js ====================
const express = require("express");
const router = express.Router();
const {
  createPayment,
  initializeFlutterwavePayment,
  verifyFlutterwavePayment,
  getAllPayments,
  getPaymentById,
  updatePaymentStatus,
  refundPayment,
  getPaymentStats,
} = require("../controllers/paymentController");
const { authenticate, optionalAuthenticate } = require("../middlewares/authMiddleware");
const { paymentLimiter } = require("../config/rateLimiter");
const {
  validateObjectId,
  validatePagination,
  validateDateRange,
  sanitizeInput,
} = require("../middlewares/validationMiddleware");

// Flutterwave routes
router.post(
  "/flutterwave/initialize",
  authenticate,
  paymentLimiter,
  initializeFlutterwavePayment
);
router.post("/flutterwave/verify", authenticate, verifyFlutterwavePayment);

// Compatibility route for /api/payments/initialize
// This handles payment initialization requests
// Note: For signup, use /api/auth/register-with-payment instead
router.post(
  "/initialize",
  paymentLimiter,
  optionalAuthenticate,
  async (req, res) => {
    try {
      // Check if it's a subscription payment
      const { planType, subscription } = req.body;
      
      if (req.userId && (subscription || planType)) {
        // Authenticated subscription payment
        const subscriptionController = require("../controllers/subscriptionController");
        return subscriptionController.initializeSubscription(req, res);
      }
      
      if (req.userId) {
        // Authenticated invoice payment
        return initializeFlutterwavePayment(req, res);
      }
      
      // Not authenticated - return helpful error
      return res.status(401).json({
        success: false,
        message: "Authentication required. For signup, please use /api/auth/register-with-payment",
        code: "AUTHENTICATION_REQUIRED",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error initializing payment",
        error: error.message,
      });
    }
  }
);

// Stats route
router.get("/stats", authenticate, validateDateRange, getPaymentStats);

// CRUD routes
router.post("/", authenticate, paymentLimiter, sanitizeInput, createPayment);
router.get(
  "/",
  authenticate,
  validatePagination,
  validateDateRange,
  getAllPayments
);
router.get("/:id", authenticate, validateObjectId("id"), getPaymentById);
router.put(
  "/:id/status",
  authenticate,
  validateObjectId("id"),
  updatePaymentStatus
);

// Actions
router.post("/:id/refund", authenticate, validateObjectId("id"), refundPayment);

module.exports = router;
