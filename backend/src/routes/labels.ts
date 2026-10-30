import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

const router = Router();

export const DEFAULT_LABEL_COLORS = [
  "#0C66E4", // Blue
  "#1F845A", // Green
  "#E56910", // Amber / Orange
  "#AE2E24", // Red
  "#8247E5", // Purple
  "#008272", // Teal
  "#C9372C", // Rose
  "#5E4DB2", // Indigo
];

export function getRandomLabelColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DEFAULT_LABEL_COLORS.length;
  return DEFAULT_LABEL_COLORS[index];
}

const createLabelSchema = z.object({
  name: z
    .string()
    .min(1, "Nama label wajib diisi")
    .max(50, "Nama label maksimal 50 karakter")
    .transform((val) => val.trim()),
  color: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Format warna harus hex (contoh: #0C66E4)")
    .optional(),
}).strict();

// GET /api/projects/:key/labels - List all labels for a project
router.get(
  "/projects/:key/labels",
  authenticateToken,
  requirePermission("project:view"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const projectKey = req.params.key.toUpperCase();

      const project = await prisma.project.findUnique({
        where: { key: projectKey },
        select: { id: true },
      });

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      const labels = await prisma.label.findMany({
        where: { projectId: project.id },
        include: {
          _count: {
            select: { issues: true },
          },
        },
        orderBy: { name: "asc" },
      });

      res.json({ labels });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/projects/:key/labels - Create or find label
router.post(
  "/projects/:key/labels",
  authenticateToken,
  requirePermission("label:manage"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const projectKey = req.params.key.toUpperCase();
      const body = createLabelSchema.parse(req.body);

      const project = await prisma.project.findUnique({
        where: { key: projectKey },
        select: { id: true },
      });

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      const color = body.color || getRandomLabelColor(body.name);

      const label = await prisma.label.upsert({
        where: {
          projectId_name: {
            projectId: project.id,
            name: body.name,
          },
        },
        create: {
          name: body.name,
          color,
          projectId: project.id,
        },
        update: body.color ? { color: body.color } : {},
      });

      res.status(201).json({ label });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/projects/:key/labels/:id - Delete a label
router.delete(
  "/projects/:key/labels/:id",
  authenticateToken,
  requirePermission("label:manage"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const projectKey = req.params.key.toUpperCase();
      const labelId = req.params.id;

      const project = await prisma.project.findUnique({
        where: { key: projectKey },
        select: { id: true },
      });

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      const label = await prisma.label.findFirst({
        where: { id: labelId, projectId: project.id },
      });

      if (!label) {
        res.status(404).json({ message: "Label tidak ditemukan" });
        return;
      }

      await prisma.label.delete({
        where: { id: label.id },
      });

      res.json({ message: "Label berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
