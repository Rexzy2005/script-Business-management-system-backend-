const dotenv = require("dotenv");
const path = require("path");

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, "../../.env") });

/**
 * Required environment variables
 */
const requiredEnvVars = [
  "NODE_ENV",
  "PORT",
  "MONGODB_URI",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
];

/**
 * Optional environment variables with defaults
 */
const optionalEnvVars = {
  API_VERSION: "v1",
  BCRYPT_SALT_ROUNDS: "12",
  RATE_LIMIT_WINDOW_MS: "900000",
  RATE_LIMIT_MAX_REQUESTS: "100",
  CORS_ORIGIN: "http://localhost:3000",
  LOG_LEVEL: "info",
  MORGAN_FORMAT: "dev",
  INVOICE_PREFIX: "INV",
  CURRENCY: "NGN",
  TAX_RATE: "7.5",
  LOW_STOCK_THRESHOLD: "10",
};

/**
 * Validate required environment variables
 */
const validateEnv = () => {
  const missing = [];
  const warnings = [];

  console.log("🔍 Validating environment variables...\n");

  // Check required variables
  requiredEnvVars.forEach((envVar) => {
    if (!process.env[envVar]) {
      missing.push(envVar);
    } else {
      console.log(
        `✅ ${envVar}: ${maskSensitive(envVar, process.env[envVar])}`
      );
    }
  });

  // Check optional variables and set defaults
  Object.keys(optionalEnvVars).forEach((envVar) => {
    if (!process.env[envVar]) {
      process.env[envVar] = optionalEnvVars[envVar];
      warnings.push(
        `⚠️  ${envVar}: Using default value (${optionalEnvVars[envVar]})`
      );
    } else {
      console.log(
        `✅ ${envVar}: ${maskSensitive(envVar, process.env[envVar])}`
      );
    }
  });

  console.log("\n");

  // Display warnings
  if (warnings.length > 0) {
    console.log("⚠️  Optional variables using defaults:\n");
    warnings.forEach((warning) => console.log(warning));
    console.log("\n");
  }

  // If any required variables are missing, throw error
  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:\n");
    missing.forEach((envVar) => console.error(`   - ${envVar}`));
    console.error(
      "\n💡 Please create a .env file with the required variables."
    );
    console.error("   You can use .env.example as a template.\n");
    throw new Error("Missing required environment variables");
  }

  // Validate specific formats
  validateSpecificFormats();

  console.log("✅ Environment validation complete!\n");
};

/**
 * Validate specific environment variable formats
 */
const validateSpecificFormats = () => {
  // Validate PORT
  const port = parseInt(process.env.PORT);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid number between 1 and 65535");
  }

  // Validate NODE_ENV
  const validEnvs = ["development", "production", "test"];
  if (!validEnvs.includes(process.env.NODE_ENV)) {
    console.warn(
      `⚠️  NODE_ENV "${
        process.env.NODE_ENV
      }" is not standard. Expected: ${validEnvs.join(", ")}`
    );
  }

  // Validate MONGODB_URI
  if (
    !process.env.MONGODB_URI.startsWith("mongodb://") &&
    !process.env.MONGODB_URI.startsWith("mongodb+srv://")
  ) {
    throw new Error("MONGODB_URI must start with mongodb:// or mongodb+srv://");
  }

  // Validate JWT_SECRET length
  if (process.env.JWT_SECRET.length < 32) {
    console.warn(
      "⚠️  JWT_SECRET should be at least 32 characters for security"
    );
  }

  // Check for default/example values in production
  if (process.env.NODE_ENV === "production") {
    checkProductionSecurity();
  }
};

/**
 * Check for insecure default values in production
 */
const checkProductionSecurity = () => {
  const insecureDefaults = [];

  if (
    process.env.JWT_SECRET.includes("change_in_production") ||
    process.env.JWT_SECRET.includes("your_")
  ) {
    insecureDefaults.push("JWT_SECRET appears to be a default value");
  }

  if (
    process.env.MONGODB_URI.includes("localhost") ||
    process.env.MONGODB_URI.includes("127.0.0.1")
  ) {
    insecureDefaults.push("MONGODB_URI is using localhost in production");
  }

  if (
    process.env.FLUTTERWAVE_SECRET_KEY &&
    process.env.FLUTTERWAVE_SECRET_KEY.includes("your_")
  ) {
    insecureDefaults.push(
      "FLUTTERWAVE_SECRET_KEY appears to be a default value"
    );
  }

  if (insecureDefaults.length > 0) {
    console.error(
      "\n🚨 SECURITY WARNING - Production environment detected with insecure defaults:\n"
    );
    insecureDefaults.forEach((warning) => console.error(`   ⚠️  ${warning}`));
    console.error("\n");
    throw new Error("Insecure configuration detected in production");
  }
};

/**
 * Mask sensitive values for logging
 * @param {string} key - Environment variable key
 * @param {string} value - Environment variable value
 * @returns {string} Masked value
 */
const maskSensitive = (key, value) => {
  const sensitiveKeys = ["SECRET", "PASSWORD", "KEY", "URI", "TOKEN"];

  if (sensitiveKeys.some((k) => key.includes(k))) {
    if (value.length <= 8) {
      return "********";
    }
    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
  }

  return value;
};

/**
 * Get configuration object
 * @returns {Object} Configuration object
 */
const getConfig = () => {
  return {
    env: process.env.NODE_ENV,
    port: parseInt(process.env.PORT),
    apiVersion: process.env.API_VERSION,

    database: {
      uri: process.env.MONGODB_URI,
    },

    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    },

    flutterwave: {
      publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
      secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
      encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY,
      webhookHash: process.env.FLUTTERWAVE_WEBHOOK_HASH,
      baseUrl:
        process.env.FLUTTERWAVE_BASE_URL || "https://api.flutterwave.com/v3",
    },

    email: {
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASSWORD,
      from: process.env.EMAIL_FROM,
    },

    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS),
      authWindowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 300000,
      authMaxRequests: parseInt(process.env.RATE_LIMIT_AUTH_MAX_REQUESTS) || 5,
    },

    cors: {
      origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
    },

    security: {
      bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS),
      cookieSecret: process.env.COOKIE_SECRET,
      sessionSecret: process.env.SESSION_SECRET,
    },

    business: {
      invoicePrefix: process.env.INVOICE_PREFIX,
      currency: process.env.CURRENCY,
      taxRate: parseFloat(process.env.TAX_RATE),
      lowStockThreshold: parseInt(process.env.LOW_STOCK_THRESHOLD),
      paymentDueDays: parseInt(process.env.PAYMENT_DUE_DAYS) || 30,
    },

    logging: {
      level: process.env.LOG_LEVEL,
      morganFormat: process.env.MORGAN_FORMAT,
    },
  };
};

// Validate environment on load
try {
  validateEnv();
} catch (error) {
  console.error("Environment validation failed:", error.message);
  process.exit(1);
}

module.exports = getConfig();
