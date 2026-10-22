import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

const createProjectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  key: z
    .string()
    .min(2, "Key must be 2-6 uppercase letters")
    .max(6, "Key must be 2-6 uppercase letters")
    .regex(/^[A-Z0-9]+$/, "Key must contain only uppercase letters and numbers"),
  description: z.string().optional(),
});

// GET /api/projects - List projects for current user
router.get("/", authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { leadId: userId },
          { members: { some: { userId } } },
        ],
      },
      include: {
        lead: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        _count: {
          select: { issues: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ projects });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects - Create project + default statuses + owner member
router.post("/", authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { name, key, description } = createProjectSchema.parse({
      ...req.body,
      key: req.body.key ? String(req.body.key).toUpperCase().trim() : undefined,
    });
    const userId = req.user!.id;

    const existingProject = await prisma.project.findUnique({
      where: { key },
    });

    if (existingProject) {
      res.status(409).json({ message: `Project with key '${key}' already exists` });
      return;
    }

    const newProject = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name,
          key,
          description,
          leadId: userId,
          members: {
            create: {
              userId,
              role: "ADMIN",
            },
          },
          statuses: {
            create: [
              { name: "To Do", category: "TO_DO", position: 1000 },
              { name: "In Progress", category: "IN_PROGRESS", position: 2000 },
              { name: "In Review", category: "IN_PROGRESS", position: 3000 },
              { name: "Done", category: "DONE", position: 4000 },
            ],
          },
        },
        include: {
          statuses: { orderBy: { position: "asc" } },
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
          lead: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      return project;
    });

    res.status(201).json({ project: newProject });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:key - Detail project with statuses and members
router.get("/:key", authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const userId = req.user!.id;

    const project = await prisma.project.findUnique({
      where: { key },
      include: {
        statuses: { orderBy: { position: "asc" } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        lead: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: {
          select: { issues: true },
        },
      },
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    // Auto-join demo if not a member yet, or check membership
    const isMember = project.members.some((m) => m.userId === userId) || project.leadId === userId;
    if (!isMember) {
      await prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId,
          role: "MEMBER",
        },
      });
    }

    res.json({ project });
  } catch (err) {
    next(err);
  }
});

export default router;
