import dotenv from "dotenv";
dotenv.config();

import { getJwtSecret } from "./lib/jwt.js";

// Fail-fast startup check: Server must reject starting if JWT_SECRET is missing
try {
  getJwtSecret();
} catch (err: any) {
  console.error("❌ CRITICAL ERROR:", err.message);
  process.exit(1);
}

import { app } from "./app.js";

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Zura Backend Server is running on http://localhost:${PORT}`);
  });
}

export default app;
