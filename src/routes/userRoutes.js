// ==================== userRoutes.js ====================
const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  updateUserPlan,
  getUserStats,
} = require("../controllers/userController");
const { authenticate, requireAdmin } = require("../middlewares/authMiddleware");
const {
  validateObjectId,
  validatePagination,
} = require("../middlewares/validationMiddleware");

// Admin only routes
router.get("/", authenticate, requireAdmin, validatePagination, getAllUsers);
router.get("/stats", authenticate, requireAdmin, getUserStats);
router.put(
  "/:id/plan",
  authenticate,
  requireAdmin,
  validateObjectId("id"),
  updateUserPlan
);
router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  validateObjectId("id"),
  deleteUser
);

// User routes
router.get("/:id", authenticate, validateObjectId("id"), getUserById);
router.put("/:id", authenticate, validateObjectId("id"), updateUser);

module.exports = router;
