import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

const generateToken = (user: { id: string; email: string; name: string }) => {
  const secret = process.env.JWT_SECRET || "default_fallback_secret_jira";
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, secret, {
    expiresIn: "7d",
  });
};

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
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
router.post("/login", async (req, res, next) => {
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

// POST /api/auth/demo-login
router.post("/demo-login", async (req, res, next) => {
  try {
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
