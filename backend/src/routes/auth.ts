import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { generateToken } from "../lib/jwt.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

// POST /api/auth/register
router.post("/register", authRateLimiter, async (req, res, next) => {
  try {
    const { email, name, password } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      res.status(409).json({ message: "User with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0c66e4,0052cc,2684ff`,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    const token = generateToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post("/login", authRateLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/demo-login - Only available in non-production AND when DEMO_MODE=true
router.post("/demo-login", authRateLimiter, async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === "production" || process.env.DEMO_MODE !== "true") {
      res.status(404).json({ message: "Demo mode is disabled" });
      return;
    }

    let demoUser = await prisma.user.findUnique({
      where: { email: "alex.lead@jira-lite.local" },
    });

    if (!demoUser) {
      const passwordHash = await bcrypt.hash("demo12345", 10);
      demoUser = await prisma.user.create({
        data: {
          email: "alex.lead@jira-lite.local",
          name: "Alex Morgan",
          passwordHash,
          avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Alex%20Morgan&backgroundColor=0c66e4",
        },
      });
    }

    const token = generateToken(demoUser);
    res.json({
      token,
      user: {
        id: demoUser.id,
        email: demoUser.email,
        name: demoUser.name,
        avatarUrl: demoUser.avatarUrl,
        createdAt: demoUser.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
