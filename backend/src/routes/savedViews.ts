import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

const router = Router();

const createSavedViewSchema = z
  .object({
    name: z
      .string()
      .min(1, "Filter name is required")
      .max(100, "Filter name must be 100 characters or fewer")
      .transform((val) => val.trim()),
    query: z.string().max(255).optional().nullable(),
    type: z.string().max(50).optional().nullable(),
    priority: z.string().max(50).optional().nullable(),
    statusId: z.string().max(50).optional().nullable(),
    assignee: z.string().max(100).optional().nullable(),
    isShared: z.boolean().default(false),
  })
  .strict();

// GET /api/projects/:key/saved-views - List saved views for current user and shared in project
router.get(
  "/projects/:key/saved-views",
  authenticateToken,
  requirePermission("project:view"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const projectKey = req.params.key.toUpperCase();
      const userId = req.user!.id;

      const project = await prisma.project.findUnique({
        where: { key: projectKey },
        select: { id: true },
      });

      if (!project) {
        res.status(404).json({ message: "Project not found" });
        return;
      }

      const savedViews = await prisma.savedView.findMany({
        where: {
          projectId: project.id,
          OR: [{ userId }, { isShared: true }],
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ savedViews });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/projects/:key/saved-views - Create a saved view
router.post(
  "/projects/:key/saved-views",
  authenticateToken,
  requirePermission("project:view"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const projectKey = req.params.key.toUpperCase();
      const userId = req.user!.id;
      const data = createSavedViewSchema.parse(req.body);

      const project = await prisma.project.findUnique({
        where: { key: projectKey },
        select: { id: true },
      });

      if (!project) {
        res.status(404).json({ message: "Project not found" });
        return;
      }

      const savedView = await prisma.savedView.create({
        data: {
          ...data,
          projectId: project.id,
          userId,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      res.status(201).json({ savedView });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/saved-views/:id - Delete a saved view (owner or admin only)
router.delete(
  "/saved-views/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const savedView = await prisma.savedView.findUnique({
        where: { id },
        include: {
          project: {
            include: {
              members: {
                where: { userId },
                select: { role: true },
              },
            },
          },
        },
      });

      if (!savedView) {
        res.status(404).json({ message: "Saved filter not found" });
        return;
      }

      const isOwner = savedView.userId === userId;
      const isLead = savedView.project.leadId === userId;
      const isAdmin =
        isLead || savedView.project.members[0]?.role?.toUpperCase() === "ADMIN";

      if (!isOwner && !isAdmin) {
        res.status(403).json({
          message: "You do not have permission to delete this filter",
        });
        return;
      }

      await prisma.savedView.delete({
        where: { id },
      });

      res.json({ message: "Saved filter deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
