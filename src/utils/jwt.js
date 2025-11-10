const jwt = require("jsonwebtoken");

/**
 * Generate Access Token
 * Short-lived token for API access (15 minutes)
 */
const generateAccessToken = (userId, email, role) => {
  const payload = {
    userId,
    email,
    role,
    type: "access",
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRY || "15m",
    issuer: "business-management-api",
    audience: "business-management-client",
  });
};

/**
 * Generate Refresh Token
 * Long-lived token for getting new access tokens (7 days)
 */
const generateRefreshToken = (userId, email) => {
  const payload = {
    userId,
    email,
    type: "refresh",
  };

  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRY || "7d",
      issuer: "business-management-api",
      audience: "business-management-client",
    }
  );
};

/**
 * Generate both tokens at once
 */
const generateTokens = (userId, email, role) => {
  return {
    accessToken: generateAccessToken(userId, email, role),
    refreshToken: generateRefreshToken(userId, email),
  };
};

/**
 * Verify Access Token
 */
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "business-management-api",
      audience: "business-management-client",
    });

    if (decoded.type !== "access") {
      throw new Error("Invalid token type");
    }

    return {
      valid: true,
      expired: false,
      decoded,
    };
  } catch (error) {
    return {
      valid: false,
      expired: error.name === "TokenExpiredError",
      decoded: null,
      error: error.message,
    };
  }
};

/**
 * Verify Refresh Token
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      {
        issuer: "business-management-api",
        audience: "business-management-client",
      }
    );

    if (decoded.type !== "refresh") {
      throw new Error("Invalid token type");
    }

    return {
      valid: true,
      expired: false,
      decoded,
    };
  } catch (error) {
    return {
      valid: false,
      expired: error.name === "TokenExpiredError",
      decoded: null,
      error: error.message,
    };
  }
};

/**
 * Decode token without verification (for debugging)
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

/**
 * Extract token from Authorization header
 */
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
};

/**
 * Get token expiry time
 */
const getTokenExpiry = (token) => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return null;
  }

  return new Date(decoded.exp * 1000);
};

/**
 * Check if token is about to expire (within 5 minutes)
 */
const isTokenExpiringSoon = (token, minutes = 5) => {
  const expiry = getTokenExpiry(token);
  if (!expiry) {
    return false;
  }

  const now = new Date();
  const timeUntilExpiry = expiry - now;
  const minutesUntilExpiry = timeUntilExpiry / (1000 * 60);

  return minutesUntilExpiry <= minutes;
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  extractTokenFromHeader,
  getTokenExpiry,
  isTokenExpiringSoon,
};
