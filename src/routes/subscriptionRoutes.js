const express = require("express");
const router = express.Router();
const {
  getCurrentSubscription,
  initializeSubscription,
  verifySubscription,
  renewSubscription,
  cancelSubscription,
  getSubscriptionStatus,
} = require("../controllers/subscriptionController");
const { authenticate } = require("../middlewares/authMiddleware");
const { paymentLimiter } = require("../config/rateLimiter");
const {
  validateObjectId,
  sanitizeInput,
} = require("../middlewares/validationMiddleware");

// All routes require authentication
router.use(authenticate);

// Get current subscription
router.get("/current", getCurrentSubscription);

// Get subscription status
router.get("/status", getSubscriptionStatus);

// Initialize subscription payment
router.post(
  "/initialize",
  paymentLimiter,
  sanitizeInput,
  initializeSubscription
);

// Verify subscription payment
router.post("/verify", sanitizeInput, verifySubscription);

// Renew subscription
router.post("/renew", paymentLimiter, sanitizeInput, renewSubscription);

// Cancel subscription
router.post("/cancel", sanitizeInput, cancelSubscription);

module.exports = router;

