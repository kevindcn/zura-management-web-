import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import issueRoutes from "./routes/issues.js";
import commentRoutes from "./routes/comments.js";
import sprintRoutes from "./routes/sprints.js";
import labelRoutes from "./routes/labels.js";
import notificationRoutes from "./routes/notifications.js";
import savedViewRoutes from "./routes/savedViews.js";
import uploadRoutes from "./routes/upload.js";
import { errorHandler } from "./middleware/error.js";

const uploadsDir = path.resolve(process.cwd(), "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export function createApp() {
  const app = express();

  // Parse allowed origins from FRONTEND_URL (supports comma-separated list)
  const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  // CORS whitelist
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, supertest, curl)
        if (!origin) {
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        callback(new Error(`Origin '${origin}' not allowed by CORS whitelist`));
      },
      credentials: true,
    })
  );

  // Serve static uploaded files
  app.use("/uploads", express.static(uploadsDir));

  // Generous limit for JSON and forms to support rich text and attachments
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Security headers (nosniff, frameguard, xss-protection)
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // Request logging in development
  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    app.use((req, res, next) => {
      console.log(`[${req.method}] ${req.url}`);
      next();
    });
  }

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      app: "Zura API",
      time: new Date().toISOString(),
    });
  });

  // API Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api", issueRoutes);
  app.use("/api", commentRoutes);
  app.use("/api", sprintRoutes);
  app.use("/api", labelRoutes);
  app.use("/api", notificationRoutes);
  app.use("/api", savedViewRoutes);

  // Error Handling Middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
