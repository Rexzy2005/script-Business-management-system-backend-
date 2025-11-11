const Subscription = require("../models/Subscription");
const User = require("../models/User");
const Payment = require("../models/Payment");
const axios = require("axios");

/**
 * @route   GET /api/subscriptions/current
 * @desc    Get current user's subscription
 * @access  Private
 */
const getCurrentSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      user: req.userId,
    })
      .sort({ createdAt: -1 })
      .populate("payment", "amount status transactionRef");

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No subscription found",
      });
    }

    res.status(200).json({
      success: true,
      data: { subscription },
    });
  } catch (error) {
    console.error("Get current subscription error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching subscription",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/subscriptions/initialize
 * @desc    Initialize subscription payment (monthly or yearly)
 * @access  Private
 */
const initializeSubscription = async (req, res) => {
  try {
    const { planType } = req.body; // "monthly" or "yearly"

    if (!planType || !["monthly", "yearly"].includes(planType)) {
      return res.status(400).json({
        success: false,
        message: "Plan type must be 'monthly' or 'yearly'",
      });
    }

    // Get user
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Set amount based on plan type
    const amount = planType === "yearly" ? 2000 : 200;

    // Find or create subscription
    let subscription = await Subscription.findOrCreate(
      req.userId,
      planType,
      amount
    );

    // Generate transaction reference
    const tx_ref = `SUB-${Date.now()}-${user._id.toString().slice(-6)}`;

    // Initialize Flutterwave payment
    const flutterwavePayload = {
      tx_ref: tx_ref,
      amount: amount,
      currency: "NGN",
      redirect_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/subscription/verify`,
      customer: {
        email: user.email,
        phone_number: user.phone || "2340000000000",
        name: user.businessName,
      },
      customizations: {
        title: `${planType === "yearly" ? "Yearly" : "Monthly"} Premium Plan - Script Business Management`,
        description: `Premium plan subscription payment (₦${amount})`,
        logo: process.env.BUSINESS_LOGO || "",
      },
      meta: {
        user_id: user._id.toString(),
        subscription_id: subscription._id.toString(),
        plan_type: planType,
        subscription: true,
      },
    };

    // Call Flutterwave API
    let flutterwaveResponse;
    try {
      if (!process.env.FLUTTERWAVE_SECRET_KEY) {
        return res.status(500).json({
          success: false,
          message: "Payment gateway configuration error. Please contact support.",
          error: "FLUTTERWAVE_SECRET_KEY not configured",
        });
      }

      flutterwaveResponse = await axios.post(
        "https://api.flutterwave.com/v3/payments",
        flutterwavePayload,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.error("Flutterwave API error:", error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to initialize payment. Please try again.",
        error: error.response?.data?.message || error.message,
      });
    }

    // Update subscription with payment reference
    subscription.paymentReference = tx_ref;
    subscription.planType = planType;
    subscription.amount = amount;
    await subscription.save();

    // Create pending payment record
    await Payment.create({
      user: req.userId,
      amount: amount,
      currency: "NGN",
      method: "flutterwave",
      gateway: "flutterwave",
      transactionRef: tx_ref,
      externalRef: flutterwaveResponse.data.data?.id || null,
      status: "pending",
      gatewayResponse: flutterwaveResponse.data,
      metadata: {
        subscription: true,
        subscriptionId: subscription._id.toString(),
        planType: planType,
      },
    });

    res.status(200).json({
      success: true,
      message: "Subscription payment initialized",
      data: {
        subscription: {
          id: subscription._id,
          planType,
          amount,
        },
        payment: {
          tx_ref: tx_ref,
          amount: amount,
          currency: "NGN",
          paymentLink: flutterwaveResponse.data.data?.link,
        },
      },
    });
  } catch (error) {
    console.error("Initialize subscription error:", error);
    res.status(500).json({
      success: false,
      message: "Error initializing subscription",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/subscriptions/verify
 * @desc    Verify subscription payment and activate subscription
 * @access  Private
 */
const verifySubscription = async (req, res) => {
  try {
    const { transaction_id, tx_ref } = req.body;

    if (!transaction_id || !tx_ref) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID and reference are required",
      });
    }

    // Verify payment with Flutterwave
    let verificationResponse;
    try {
      verificationResponse = await axios.get(
        `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          },
        }
      );
    } catch (error) {
      console.error("Flutterwave verification error:", error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to verify payment with Flutterwave",
        error: error.response?.data?.message || error.message,
      });
    }

    const { data: transactionData } = verificationResponse.data;

    // Check if payment was successful
    if (transactionData.status !== "successful") {
      return res.status(400).json({
        success: false,
        message: "Payment was not successful",
        transactionStatus: transactionData.status,
      });
    }

    // Find subscription by payment reference
    const subscription = await Subscription.findOne({
      paymentReference: tx_ref,
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found for this payment reference",
      });
    }

    // Verify amount matches
    const expectedAmount = subscription.amount;
    if (parseFloat(transactionData.amount) !== expectedAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment amount mismatch. Expected ${expectedAmount} Naira, got ${transactionData.amount}`,
      });
    }

    // Check if already activated
    if (subscription.status === "active" && subscription.paymentVerifiedAt) {
      return res.status(200).json({
        success: true,
        message: "Subscription already activated",
        data: { subscription },
      });
    }

    // Find and update payment record
    const payment = await Payment.findOne({ transactionRef: tx_ref });
    if (payment) {
      payment.status = "completed";
      payment.externalRef = transaction_id;
      payment.gatewayResponse = verificationResponse.data;
      payment.completedAt = new Date();
      payment.verified = true;
      payment.verifiedAt = new Date();

      if (transactionData.card) {
        payment.cardDetails = {
          last4: transactionData.card.last_4digits,
          cardType: transactionData.card.type,
          cardBrand: transactionData.card.issuer,
        };
      }

      await payment.save();

      // Activate subscription
      await subscription.activate(payment._id, transaction_id);
    } else {
      // Create payment record if it doesn't exist
      const newPayment = await Payment.create({
        user: subscription.user,
        amount: subscription.amount,
        currency: "NGN",
        method: "flutterwave",
        gateway: "flutterwave",
        transactionRef: tx_ref,
        externalRef: transaction_id,
        status: "completed",
        gatewayResponse: verificationResponse.data,
        completedAt: new Date(),
        verified: true,
        verifiedAt: new Date(),
        metadata: {
          subscription: true,
          subscriptionId: subscription._id.toString(),
          planType: subscription.planType,
        },
      });

      await subscription.activate(newPayment._id, transaction_id);
    }

    // Update user status to active
    const user = await User.findById(subscription.user);
    if (user) {
      user.status = "active";
      user.plan.status = "active";
      user.plan.type = "premium";
      user.plan.paymentTransactionId = transaction_id;
      user.plan.paymentVerifiedAt = new Date();
      user.plan.startDate = new Date();
      user.plan.endDate = subscription.endDate;
      user.plan.features = subscription.features;
      await user.save();
    }

    const updatedSubscription = await Subscription.findById(subscription._id)
      .populate("payment", "amount status transactionRef");

    res.status(200).json({
      success: true,
      message: "Subscription activated successfully!",
      data: { subscription: updatedSubscription },
    });
  } catch (error) {
    console.error("Verify subscription error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying subscription",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/subscriptions/renew
 * @desc    Renew subscription (monthly or yearly)
 * @access  Private
 */
const renewSubscription = async (req, res) => {
  try {
    const { planType } = req.body; // "monthly" or "yearly"

    if (!planType || !["monthly", "yearly"].includes(planType)) {
      return res.status(400).json({
        success: false,
        message: "Plan type must be 'monthly' or 'yearly'",
      });
    }

    // Get current subscription
    const subscription = await Subscription.findOne({
      user: req.userId,
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No subscription found. Please create a new subscription.",
      });
    }

    // Set amount based on plan type
    const amount = planType === "yearly" ? 2000 : 200;

    // Update subscription plan type and amount if changed
    subscription.planType = planType;
    subscription.amount = amount;

    // Generate transaction reference
    const user = await User.findById(req.userId);
    const tx_ref = `RENEW-${Date.now()}-${user._id.toString().slice(-6)}`;

    // Initialize Flutterwave payment
    const flutterwavePayload = {
      tx_ref: tx_ref,
      amount: amount,
      currency: "NGN",
      redirect_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/subscription/verify`,
      customer: {
        email: user.email,
        phone_number: user.phone || "2340000000000",
        name: user.businessName,
      },
      customizations: {
        title: `${planType === "yearly" ? "Yearly" : "Monthly"} Premium Plan Renewal`,
        description: `Premium plan renewal payment (₦${amount})`,
        logo: process.env.BUSINESS_LOGO || "",
      },
      meta: {
        user_id: user._id.toString(),
        subscription_id: subscription._id.toString(),
        plan_type: planType,
        renewal: true,
      },
    };

    // Call Flutterwave API
    let flutterwaveResponse;
    try {
      flutterwaveResponse = await axios.post(
        "https://api.flutterwave.com/v3/payments",
        flutterwavePayload,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.error("Flutterwave API error:", error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to initialize payment. Please try again.",
        error: error.response?.data?.message || error.message,
      });
    }

    // Update subscription with payment reference
    subscription.paymentReference = tx_ref;
    await subscription.save();

    // Create pending payment record
    await Payment.create({
      user: req.userId,
      amount: amount,
      currency: "NGN",
      method: "flutterwave",
      gateway: "flutterwave",
      transactionRef: tx_ref,
      externalRef: flutterwaveResponse.data.data?.id || null,
      status: "pending",
      gatewayResponse: flutterwaveResponse.data,
      metadata: {
        subscription: true,
        subscriptionId: subscription._id.toString(),
        planType: planType,
        renewal: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "Subscription renewal payment initialized",
      data: {
        subscription: {
          id: subscription._id,
          planType,
          amount,
        },
        payment: {
          tx_ref: tx_ref,
          amount: amount,
          currency: "NGN",
          paymentLink: flutterwaveResponse.data.data?.link,
        },
      },
    });
  } catch (error) {
    console.error("Renew subscription error:", error);
    res.status(500).json({
      success: false,
      message: "Error renewing subscription",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/subscriptions/cancel
 * @desc    Cancel subscription (prevents auto-renewal)
 * @access  Private
 */
const cancelSubscription = async (req, res) => {
  try {
    const { reason } = req.body;

    const subscription = await Subscription.findOne({
      user: req.userId,
      status: { $in: ["active", "pending"] },
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found",
      });
    }

    await subscription.cancel(reason || "User requested cancellation");

    res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully",
      data: { subscription },
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling subscription",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/subscriptions/status
 * @desc    Check subscription status
 * @access  Private
 */
const getSubscriptionStatus = async (req, res) => {
  try {
    const subscription = await Subscription.findActiveForUser(req.userId);

    if (!subscription) {
      return res.status(200).json({
        success: true,
        data: {
          hasActiveSubscription: false,
          message: "No active subscription",
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        hasActiveSubscription: true,
        subscription: {
          id: subscription._id,
          planType: subscription.planType,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          daysRemaining: subscription.daysRemaining,
          isActive: subscription.isActive,
          isExpired: subscription.isExpired,
          isInGracePeriod: subscription.isInGracePeriod,
          autoRenew: subscription.autoRenew,
        },
      },
    });
  } catch (error) {
    console.error("Get subscription status error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking subscription status",
      error: error.message,
    });
  }
};

module.exports = {
  getCurrentSubscription,
  initializeSubscription,
  verifySubscription,
  renewSubscription,
  cancelSubscription,
  getSubscriptionStatus,
};

