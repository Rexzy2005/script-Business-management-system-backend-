// ==================== clientRoutes.js ====================
const express = require("express");
const router = express.Router();
const {
  createClient,
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
  searchClients,
  getClientStats,
  getActiveClients,
} = require("../controllers/clientController");
const { authenticate } = require("../middlewares/authMiddleware");
const {
  validateObjectId,
  validatePagination,
  sanitizeInput,
} = require("../middlewares/validationMiddleware");

// Search & special routes (before :id)
router.get("/search", authenticate, searchClients);
router.get("/active", authenticate, getActiveClients);

// CRUD routes
router.post("/", authenticate, sanitizeInput, createClient);
router.get("/", authenticate, validatePagination, getAllClients);
router.get("/:id", authenticate, validateObjectId("id"), getClientById);
router.put(
  "/:id",
  authenticate,
  validateObjectId("id"),
  sanitizeInput,
  updateClient
);
router.delete("/:id", authenticate, validateObjectId("id"), deleteClient);

// Stats
router.get("/:id/stats", authenticate, validateObjectId("id"), getClientStats);

module.exports = router;
