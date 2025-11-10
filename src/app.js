const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const { generalLimiter } = require("./config/rateLimiter");

// Import routes
const authRoutes = require("./routes/authRoutes");
// ... other routes

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || "*",
    credentials: true,
  })
);

// Logging
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Body parsing
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
app.use(generalLimiter);

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/clients', clientRoutes);
// ... other routes

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

module.exports = app;
