// ==================== inventoryRoutes.js ====================
const express = require("express");
const router = express.Router();
const {
  createInventoryItem,
  getAllInventory,
  getInventoryById,
  updateInventoryItem,
  deleteInventoryItem,
  addStock,
  reduceStock,
  adjustStock,
  getLowStockItems,
  getItemsToReorder,
  getCategories,
  getInventoryStats,
  searchInventory,
  updateStock,
} = require("../controllers/inventoryController");
const { authenticate } = require("../middlewares/authMiddleware");
const {
  validateObjectId,
  validatePagination,
  sanitizeInput,
} = require("../middlewares/validationMiddleware");

// Special routes (before :id)
router.get("/search", authenticate, searchInventory);
router.get("/low-stock", authenticate, getLowStockItems);
router.get("/reorder", authenticate, getItemsToReorder);
router.get("/categories", authenticate, getCategories);
router.get("/stats", authenticate, getInventoryStats);

// CRUD routes
router.post("/", authenticate, sanitizeInput, createInventoryItem);
router.get("/", authenticate, validatePagination, getAllInventory);
router.get("/:id", authenticate, validateObjectId("id"), getInventoryById);
router.put(
  "/:id",
  authenticate,
  validateObjectId("id"),
  sanitizeInput,
  updateInventoryItem
);
router.delete(
  "/:id",
  authenticate,
  validateObjectId("id"),
  deleteInventoryItem
);

// Stock management
router.post("/:id/stock/add", authenticate, validateObjectId("id"), addStock);
router.post(
  "/:id/stock/reduce",
  authenticate,
  validateObjectId("id"),
  reduceStock
);
router.post(
  "/:id/stock/adjust",
  authenticate,
  validateObjectId("id"),
  adjustStock
);
// Backwards-compatible endpoint used by frontend: PATCH /api/products/:id/stock
router.patch("/:id/stock", authenticate, validateObjectId("id"), updateStock);

module.exports = router;
