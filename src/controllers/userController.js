const User = require("../models/User");

/**
 * @route   GET /api/users
 * @desc    Get all users (Admin only)
 * @access  Private/Admin
 */
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, role, plan, search } = req.query;

    // Build query
    const query = {};

    if (status) query.status = status;
    if (role) query.role = role;
    if (plan) query["plan.type"] = plan;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { "businessInfo.businessName": { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user can access this profile
    if (
      id !== req.userId.toString() &&
      !req.user.isAdmin &&
      req.user.role !== "owner"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view your own profile.",
      });
    }

    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message,
    });
  }
};

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user can update this profile
    if (
      id !== req.userId.toString() &&
      !req.user.isAdmin &&
      req.user.role !== "owner"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only update your own profile.",
      });
    }

    const { name, phone, businessInfo, settings, role, status, isAdmin } =
      req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update basic fields
    if (name) user.name = name;
    if (phone) user.phone = phone;

    if (businessInfo) {
      user.businessInfo = {
        ...user.businessInfo,
        ...businessInfo,
      };
    }

    if (settings) {
      user.settings = {
        ...user.settings,
        ...settings,
      };
    }

    // Only admins can update role, status, and isAdmin
    if (req.user.isAdmin || req.user.role === "owner") {
      if (role) user.role = role;
      if (status) user.status = status;
      if (isAdmin !== undefined) user.isAdmin = isAdmin;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: { user },
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    });
  }
};

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (soft delete - set status to inactive)
 * @access  Private/Admin
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Soft delete - set status to inactive
    user.status = "inactive";
    await user.save();

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

/**
 * @route   PUT /api/users/:id/plan
 * @desc    Update user subscription plan
 * @access  Private/Admin
 */
const updateUserPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { planType, features } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update plan
    user.plan.type = planType;
    user.plan.startDate = new Date();

    // Set end date based on plan
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription
    user.plan.endDate = endDate;

    user.plan.status = "active";

    // Update features if provided
    if (features) {
      user.plan.features = {
        ...user.plan.features,
        ...features,
      };
    } else {
      // Set default features based on plan type
      const planFeatures = {
        free: {
          maxInvoices: 10,
          maxClients: 5,
          maxInventoryItems: 50,
          advancedAnalytics: false,
          multiUser: false,
        },
        basic: {
          maxInvoices: 100,
          maxClients: 50,
          maxInventoryItems: 500,
          advancedAnalytics: false,
          multiUser: false,
        },
        professional: {
          maxInvoices: 1000,
          maxClients: 500,
          maxInventoryItems: 5000,
          advancedAnalytics: true,
          multiUser: true,
        },
        enterprise: {
          maxInvoices: -1, // Unlimited
          maxClients: -1,
          maxInventoryItems: -1,
          advancedAnalytics: true,
          multiUser: true,
        },
      };

      user.plan.features = planFeatures[planType] || planFeatures.free;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "User plan updated successfully",
      data: { user },
    });
  } catch (error) {
    console.error("Update plan error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating plan",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics (Admin only)
 * @access  Private/Admin
 */
const getUserStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          inactiveUsers: {
            $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] },
          },
          verifiedEmails: {
            $sum: { $cond: ["$emailVerified", 1, 0] },
          },
        },
      },
    ]);

    const planStats = await User.aggregate([
      {
        $group: {
          _id: "$plan.type",
          count: { $sum: 1 },
        },
      },
    ]);

    const roleStats = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {
          totalUsers: 0,
          activeUsers: 0,
          inactiveUsers: 0,
          verifiedEmails: 0,
        },
        byPlan: planStats,
        byRole: roleStats,
      },
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user statistics",
      error: error.message,
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  updateUserPlan,
  getUserStats,
};
