// ==================== invoiceRoutes.js ====================
const express = require("express");
const router = express.Router();
const {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  sendInvoice,
  getOverdueInvoices,
  getInvoiceStats,
} = require("../controllers/invoiceController");
const { authenticate } = require("../middlewares/authMiddleware");
const { invoiceLimiter } = require("../config/rateLimiter");
const {
  validateObjectId,
  validatePagination,
  validateDateRange,
  sanitizeInput,
} = require("../middlewares/validationMiddleware");

// Special routes (before :id)
router.get("/overdue", authenticate, getOverdueInvoices);
router.get("/stats", authenticate, validateDateRange, getInvoiceStats);

// CRUD routes
router.post("/", authenticate, invoiceLimiter, sanitizeInput, createInvoice);
router.get(
  "/",
  authenticate,
  validatePagination,
  validateDateRange,
  getAllInvoices
);
router.get("/:id", authenticate, validateObjectId("id"), getInvoiceById);
router.put(
  "/:id",
  authenticate,
  validateObjectId("id"),
  sanitizeInput,
  updateInvoice
);
router.delete("/:id", authenticate, validateObjectId("id"), deleteInvoice);

// Actions
router.post("/:id/send", authenticate, validateObjectId("id"), sendInvoice);

module.exports = router;
