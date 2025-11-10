const mongoose = require("mongoose");

// MongoDB connection options
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4, skip trying IPv6
};

// Connection state tracking
let isConnected = false;

/**
 * Connect to MongoDB with retry logic
 * @param {number} retries - Number of retry attempts
 * @param {number} delay - Delay between retries in ms
 */
const connectDB = async (retries = 5, delay = 5000) => {
  // If already connected, return
  if (isConnected) {
    console.log("✅ Using existing MongoDB connection");
    return;
  }

  let attempts = 0;

  while (attempts < retries) {
    try {
      attempts++;
      console.log(
        `🔄 Attempting MongoDB connection (${attempts}/${retries})...`
      );

      const conn = await mongoose.connect(process.env.MONGODB_URI, options);

      isConnected = true;

      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      console.log(`📊 Database: ${conn.connection.name}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);

      // Handle connection events
      setupConnectionHandlers();

      return conn;
    } catch (error) {
      console.error(
        `❌ MongoDB Connection Error (Attempt ${attempts}/${retries}):`,
        error.message
      );

      if (attempts === retries) {
        console.error("🚨 Failed to connect to MongoDB after maximum retries");
        console.error("💡 Please check:");
        console.error("   - MongoDB is running");
        console.error("   - MONGODB_URI is correct in .env file");
        console.error("   - Network connectivity");
        process.exit(1);
      }

      console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

/**
 * Setup MongoDB connection event handlers
 */
const setupConnectionHandlers = () => {
  // When successfully connected
  mongoose.connection.on("connected", () => {
    console.log("🔗 Mongoose connected to MongoDB");
    isConnected = true;
  });

  // When connection is disconnected
  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️  Mongoose disconnected from MongoDB");
    isConnected = false;
  });

  // When connection encounters an error
  mongoose.connection.on("error", (err) => {
    console.error("❌ Mongoose connection error:", err.message);
    isConnected = false;
  });

  // When connection is reconnected
  mongoose.connection.on("reconnected", () => {
    console.log("🔄 Mongoose reconnected to MongoDB");
    isConnected = true;
  });

  // Handle application termination
  process.on("SIGINT", async () => {
    await gracefulDisconnect("SIGINT");
  });

  process.on("SIGTERM", async () => {
    await gracefulDisconnect("SIGTERM");
  });
};

/**
 * Gracefully disconnect from MongoDB
 * @param {string} signal - Signal that triggered disconnect
 */
const gracefulDisconnect = async (signal) => {
  try {
    await mongoose.connection.close();
    console.log(`\n🔌 MongoDB connection closed through ${signal} signal`);
    isConnected = false;
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during MongoDB disconnect:", error.message);
    process.exit(1);
  }
};

/**
 * Get current connection status
 * @returns {boolean} Connection status
 */
const getConnectionStatus = () => {
  return isConnected && mongoose.connection.readyState === 1;
};

/**
 * Check database health
 * @returns {Object} Health status
 */
const checkDatabaseHealth = async () => {
  try {
    if (!getConnectionStatus()) {
      return { status: "disconnected", message: "Not connected to database" };
    }

    // Ping database
    await mongoose.connection.db.admin().ping();

    return {
      status: "healthy",
      connected: true,
      host: mongoose.connection.host,
      database: mongoose.connection.name,
      readyState: mongoose.connection.readyState,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      connected: false,
      error: error.message,
    };
  }
};

module.exports = {
  connectDB,
  getConnectionStatus,
  checkDatabaseHealth,
  gracefulDisconnect,
};
