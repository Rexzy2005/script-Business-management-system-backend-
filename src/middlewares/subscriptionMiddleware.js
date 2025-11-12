const Subscription = require("../models/Subscription");

/**
 * Middleware to check if user has active subscription
 * Returns 403 if subscription is not active
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findActiveForUser(req.userId);

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: "Active subscription required to access this feature",
        code: "SUBSCRIPTION_REQUIRED",
        requiresSubscription: true,
      });
    }

    // Check if subscription is expired
    if (new Date() > new Date(subscription.endDate)) {
      return res.status(403).json({
        success: false,
        message: "Your subscription has expired. Please renew to continue.",
        code: "SUBSCRIPTION_EXPIRED",
        requiresRenewal: true,
        subscription: {
          endDate: subscription.endDate,
          planType: subscription.planType,
        },
      });
    }

    // Attach subscription to request
    req.subscription = subscription;
    next();
  } catch (error) {
    console.error("Subscription middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking subscription status",
      error: error.message,
    });
  }
};

/**
 * Middleware to check subscription status but allow access
 * Attaches subscription info to request without blocking
 */
const checkSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findActiveForUser(req.userId);
    req.subscription = subscription || null;
    req.hasActiveSubscription = !!subscription;
    next();
  } catch (error) {
    console.error("Subscription check error:", error);
    // Don't block request, just set defaults
    req.subscription = null;
    req.hasActiveSubscription = false;
    next();
  }
};

module.exports = {
  requireActiveSubscription,
  checkSubscription,
};

