const { verifyAccessToken, extractTokenFromHeader } = require("../utils/jwt");
const User = require("../models/User");

/**
 * Authenticate user from JWT token
 * Attaches user object to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // Verify token
    const { valid, expired, decoded, error } = verifyAccessToken(token);

    if (expired) {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please refresh your token.",
        code: "TOKEN_EXPIRED",
      });
    }

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
        error: error,
      });
    }

    // Get user from database
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found. Token invalid.",
      });
    }

    // Check if user account is active
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Please contact support.`,
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(403).json({
        success: false,
        message:
          "Account is locked due to multiple failed login attempts. Please try again later.",
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;
    req.token = token;

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication failed.",
      error: error.message,
    });
  }
};

/**
 * Optional authentication
 * Attaches user if token is valid, but doesn't fail if no token
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return next();
    }

    const { valid, decoded } = verifyAccessToken(token);

    if (valid && decoded) {
      const user = await User.findById(decoded.userId).select("-password");
      if (user && user.status === "active") {
        req.user = user;
        req.userId = user._id;
      }
    }

    next();
  } catch (error) {
    // Don't fail, just continue without user
    next();
  }
};

/**
 * Require specific role(s)
 * Must be used after authenticate middleware
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
        requiredRole: allowedRoles,
        userRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Require admin privileges
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (!req.user.isAdmin && req.user.role !== "owner") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required.",
    });
  }

  next();
};

/**
 * Require email verification
 */
const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      message:
        "Email verification required. Please verify your email to continue.",
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  next();
};

/**
 * Check if user owns the resource
 * Compares req.user._id with req.params.userId or resource's user field
 */
const requireOwnership = (resourceUserField = "user") => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Admin and owner can access all resources
    if (req.user.isAdmin || req.user.role === "owner") {
      return next();
    }

    // Check if userId in params matches authenticated user
    if (req.params.userId && req.params.userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only access your own resources.",
      });
    }

    // For resource ownership check (will be validated in controller)
    req.resourceUserField = resourceUserField;
    next();
  };
};

/**
 * Rate limit check for authenticated users
 * Can have higher limits than unauthenticated users
 */
const checkAuthRateLimit = (req, res, next) => {
  // This is a placeholder - actual rate limiting is handled by express-rate-limit
  // But you can add user-specific logic here

  if (req.user && req.user.plan && req.user.plan.type === "enterprise") {
    // Enterprise users might have higher limits
    req.rateLimit = {
      limit: 1000,
      windowMs: 15 * 60 * 1000,
    };
  }

  next();
};

/**
 * Validate subscription plan access
 */
const requirePlanFeature = (feature) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Check if plan is active
    if (req.user.plan.status !== "active") {
      return res.status(403).json({
        success: false,
        message:
          "Your subscription plan is inactive. Please renew to continue.",
        code: "PLAN_INACTIVE",
      });
    }

    // Check specific feature
    if (feature && !req.user.plan.features[feature]) {
      return res.status(403).json({
        success: false,
        message: `This feature is not available in your ${req.user.plan.type} plan.`,
        requiredFeature: feature,
        currentPlan: req.user.plan.type,
        code: "FEATURE_NOT_AVAILABLE",
      });
    }

    next();
  };
};

/**
 * Check resource limits based on plan
 */
const checkPlanLimit = (resourceType, countField) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const limit = req.user.plan.features[resourceType];

    // -1 or undefined means unlimited
    if (limit === -1 || limit === undefined) {
      return next();
    }

    // Get current count (this should be passed from controller or queried)
    const currentCount = req[countField] || 0;

    if (currentCount >= limit) {
      return res.status(403).json({
        success: false,
        message: `You have reached the limit of ${limit} ${resourceType} for your ${req.user.plan.type} plan.`,
        limit: limit,
        current: currentCount,
        resourceType: resourceType,
        code: "PLAN_LIMIT_REACHED",
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireRole,
  requireAdmin,
  requireVerifiedEmail,
  requireOwnership,
  checkAuthRateLimit,
  requirePlanFeature,
  checkPlanLimit,
};
