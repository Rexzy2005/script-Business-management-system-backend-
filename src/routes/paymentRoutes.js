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
const { authenticate } = require("../middlewares/authMiddleware");
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
