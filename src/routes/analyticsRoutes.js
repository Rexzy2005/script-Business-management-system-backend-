// ==================== analyticsRoutes.js ====================
const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getRevenueAnalytics,
  getClientAnalytics,
  getInvoiceAnalytics,
  getInventoryAnalytics,
} = require("../controllers/analyticsController");
const { authenticate, requirePlanFeature } = require("../middlewares/authMiddleware");
const { analyticsLimiter } = require("../config/rateLimiter");
const { validateDateRange } = require("../middlewares/validationMiddleware");

// All analytics routes require authentication
router.get(
  "/dashboard",
  authenticate,
  analyticsLimiter,
  validateDateRange,
  getDashboardStats
);
router.get(
  "/revenue",
  authenticate,
  analyticsLimiter,
  validateDateRange,
  getRevenueAnalytics
);
router.get("/clients", authenticate, analyticsLimiter, getClientAnalytics);
router.get(
  "/invoices",
  authenticate,
  analyticsLimiter,
  validateDateRange,
  getInvoiceAnalytics
);
router.get("/inventory", authenticate, analyticsLimiter, getInventoryAnalytics);

module.exports = router;
