require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./src/config/database");

const app = express();

// Connect to DB
connectDB();

// CORS
app.use(
  cors({
    origin: ["http://localhost:5173", "https://phenomenal-seahorse-76db32.netlify.app"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
const resumeRoutes = require("./src/routes/resumeRoutes");
const paymentRoutes = require("./src/routes/payment");
const authRoutes = require("./src/routes/auth");

app.use("/api/auth", authRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/payment", paymentRoutes);

// Health check
app.get("/health", (req, res) => res.json({ status: "OK", timestamp: new Date().toISOString() }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
