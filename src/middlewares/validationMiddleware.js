/**
 * Validation middleware for request data
 */

/**
 * Validate registration data
 */
const validateRegister = (req, res, next) => {
  const { businessName, email, phone, password } = req.body;
  const errors = [];

  // Business name validation
  if (!businessName || businessName.trim().length < 2) {
    errors.push("Business name must be at least 2 characters long");
  }

  // Email validation
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!email || !emailRegex.test(email)) {
    errors.push("Valid email is required");
  }

  // Phone validation
  const phoneRegex = /^[0-9+\-\s()]+$/;
  if (!phone || !phoneRegex.test(phone)) {
    errors.push("Valid phone number is required");
  }

  // Password validation
  if (!password) {
    errors.push("Password is required");
  } else {
    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }
    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }
    if (!/[0-9]/.test(password)) {
      errors.push("Password must contain at least one number");
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  next();
};

/**
 * Validate login data
 */
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email) {
    errors.push("Email is required");
  }

  if (!password) {
    errors.push("Password is required");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  next();
};

/**
 * Validate password change data
 */
const validatePasswordChange = (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const errors = [];

  if (!currentPassword) {
    errors.push("Current password is required");
  }

  if (!newPassword) {
    errors.push("New password is required");
  } else {
    if (newPassword.length < 8) {
      errors.push("New password must be at least 8 characters long");
    }
    if (!/[A-Z]/.test(newPassword)) {
      errors.push("New password must contain at least one uppercase letter");
    }
    if (!/[a-z]/.test(newPassword)) {
      errors.push("New password must contain at least one lowercase letter");
    }
    if (!/[0-9]/.test(newPassword)) {
      errors.push("New password must contain at least one number");
    }
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    errors.push("Passwords do not match");
  }

  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.push("New password must be different from current password");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  next();
};

/**
 * Validate email
 */
const validateEmail = (req, res, next) => {
  const { email } = req.body;
  const emailRegex = /^\S+@\S+\.\S+$/;

  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Valid email is required",
    });
  }

  next();
};

/**
 * Sanitize input to prevent XSS
 */
const sanitizeInput = (req, res, next) => {
  // Basic sanitization - remove HTML tags
  const sanitize = (str) => {
    if (typeof str !== "string") return str;
    return str.replace(/<[^>]*>/g, "").trim();
  };

  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === "string") {
        req.body[key] = sanitize(req.body[key]);
      }
    });
  }

  // Sanitize query
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      if (typeof req.query[key] === "string") {
        req.query[key] = sanitize(req.query[key]);
      }
    });
  }

  next();
};

/**
 * Validate MongoDB ObjectId
 */
const validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const id = req.params[paramName];
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;

    if (!id || !objectIdRegex.test(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} format`,
      });
    }

    next();
  };
};

/**
 * Validate pagination parameters
 */
const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;

  if (page) {
    const pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Page must be a positive number",
      });
    }
    req.query.page = pageNum;
  } else {
    req.query.page = 1;
  }

  if (limit) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 100",
      });
    }
    req.query.limit = limitNum;
  } else {
    req.query.limit = 10;
  }

  next();
};

/**
 * Validate date range
 */
const validateDateRange = (req, res, next) => {
  const { startDate, endDate } = req.query;

  if (startDate) {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid start date format",
      });
    }
    req.query.startDate = start;
  }

  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid end date format",
      });
    }
    req.query.endDate = end;
  }

  if (startDate && endDate && req.query.startDate > req.query.endDate) {
    return res.status(400).json({
      success: false,
      message: "Start date must be before end date",
    });
  }

  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validatePasswordChange,
  validateEmail,
  sanitizeInput,
  validateObjectId,
  validatePagination,
  validateDateRange,
};
