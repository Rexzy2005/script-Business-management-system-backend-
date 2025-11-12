const app = require("./app.js");
const { connectDB } = require("./config/database.js");
const config = require("./config/env");

/**
 * Start the server
 */
const startServer = async () => {
  try {
    // Display startup banner
    console.log("\n" + "=".repeat(60));
    console.log("🚀 BUSINESS MANAGEMENT SYSTEM API");
    console.log("=".repeat(60) + "\n");

    // Connect to MongoDB
    await connectDB();

    // Start Express server
    const server = app.listen(config.port, () => {
      console.log("\n" + "=".repeat(60));
      console.log(`✅ Server Status: RUNNING`);
      console.log(`🌍 Environment: ${config.env.toUpperCase()}`);
      console.log(`🔌 Port: ${config.port}`);
      console.log(`📍 URL: http://localhost:${config.port}`);
      console.log(
        `🔗 API: http://localhost:${config.port}/api/${config.apiVersion}`
      );
      console.log(`💚 Health: http://localhost:${config.port}/health`);
      console.log("=".repeat(60) + "\n");

      console.log("📋 Available Endpoints:");
      console.log(`   - Auth:      /api/${config.apiVersion}/auth`);
      console.log(`   - Users:     /api/${config.apiVersion}/users`);
      console.log(`   - Clients:   /api/${config.apiVersion}/clients`);
      console.log(`   - Invoices:  /api/${config.apiVersion}/invoices`);
      console.log(`   - Inventory: /api/${config.apiVersion}/inventory`);
      console.log(`   - Payments:  /api/${config.apiVersion}/payments`);
      console.log(`   - Analytics: /api/${config.apiVersion}/analytics`);
      console.log("\n" + "=".repeat(60) + "\n");

      if (config.env === "development") {
        console.log("💡 Development Tips:");
        console.log("   - Use Postman or Thunder Client to test endpoints");
        console.log("   - Check /health for server status");
        console.log("   - Logs are verbose in development mode");
        console.log("\n" + "=".repeat(60) + "\n");
      }
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal) => {
      console.log(`\n\n⚠️  ${signal} signal received: closing HTTP server`);

      server.close(async () => {
        console.log("🔌 HTTP server closed");

        // Close database connection
        const { gracefulDisconnect } = require("./config/database.js");
        await gracefulDisconnect(signal);

        console.log("👋 Process terminated gracefully\n");
        process.exit(0);
      });

      // Force close after 30 seconds
      setTimeout(() => {
        console.error("⚠️  Forced shutdown after timeout");
        process.exit(1);
      }, 30000);
    };

    // Listen for termination signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("\n❌ Failed to start server:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Start the server
startServer();
