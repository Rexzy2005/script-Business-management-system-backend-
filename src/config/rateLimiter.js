const rateLimit = require("express-rate-limit");
const config = require("./env");

/**
 * General API rate limiter
 * Limits: 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 minutes
  max: config.rateLimit.maxRequests, // 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
    retryAfter: "Check the Retry-After header for wait time",
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests, please slow down.",
      error: "RATE_LIMIT_EXCEEDED",
      retryAfter: req.rateLimit.resetTime,
    });
  },
  skip: (req) => {
    // Skip rate limiting for health check endpoints
    return req.path === "/api/health" || req.path === "/health";
  },
});

/**
 * Authentication rate limiter (stricter)
 * Limits: 5 requests per 5 minutes per IP
 * Applied to login, register, password reset endpoints
 */
const authLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs, // 5 minutes
  max: config.rateLimit.authMaxRequests, // 5 requests per windowMs
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
    error: "AUTH_RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    console.warn(`⚠️  Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      success: false,
      message:
        "Too many authentication attempts. Please try again in 5 minutes.",
      error: "AUTH_RATE_LIMIT_EXCEEDED",
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

/**
 * Payment rate limiter (very strict)
 * Limits: 10 requests per 10 minutes per IP
 * Applied to payment initiation endpoints
 */
const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // 10 requests per windowMs
  message: {
    success: false,
    message: "Too many payment requests, please try again later.",
    error: "PAYMENT_RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️  Payment rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: "Too many payment requests. Please wait before trying again.",
      error: "PAYMENT_RATE_LIMIT_EXCEEDED",
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

/**
 * Invoice creation rate limiter
 * Limits: 50 requests per 15 minutes per IP
 */
const invoiceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: {
    success: false,
    message: "Too many invoice operations, please try again later.",
    error: "INVOICE_RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Analytics/Reports rate limiter
 * Limits: 30 requests per 15 minutes per IP
 * Analytics queries can be resource-intensive
 */
const analyticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: {
    success: false,
    message: "Too many analytics requests, please try again later.",
    error: "ANALYTICS_RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * File upload rate limiter
 * Limits: 20 uploads per hour per IP
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: {
    success: false,
    message: "Too many file uploads, please try again later.",
    error: "UPLOAD_RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Create a custom rate limiter
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} max - Maximum requests in window
 * @param {string} message - Custom error message
 * @returns {Function} Rate limiter middleware
 */
const createCustomLimiter = (windowMs, max, message = "Too many requests") => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      error: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

module.exports = {
  generalLimiter,
  authLimiter,
  paymentLimiter,
  invoiceLimiter,
  analyticsLimiter,
  uploadLimiter,
  createCustomLimiter,
};
