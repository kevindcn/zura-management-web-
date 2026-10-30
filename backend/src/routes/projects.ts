import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { validateMemberMutation, ALL_ROLES } from "../lib/permissions.js";
import { notifyUser } from "../lib/notifications.js";
import { memberActionRateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

const createProjectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters").max(255, "Project name maximum 255 characters"),
  key: z
    .string()
    .min(2, "Key must be 2-6 uppercase letters")
    .max(6, "Key must be 2-6 uppercase letters")
    .regex(/^[A-Z0-9]+$/, "Key must contain only uppercase letters and numbers"),
  description: z.string().max(10000, "Description maximum 10,000 characters").optional(),
});

const updateProjectSchema = z
  .object({
    name: z.string().min(2, "Nama project minimal 2 karakter").max(255).optional(),
    description: z.string().max(10000).optional().nullable(),
  })
  .strict();

const memberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"], {
    errorMap: () => ({ message: "Role must be ADMIN, MEMBER, or VIEWER" }),
  }),
});

const addMemberSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
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

// GET /api/projects/:key - Detail project with statuses and members (NO auto-join)
router.get("/:key", authenticateToken, requirePermission("project:view"), async (req: AuthRequest, res: Response, next) => {
  try {
    const key = req.params.key.toUpperCase();

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

    res.json({ project });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:key/activities - Recent activities across the project
router.get("/:key/activities", authenticateToken, requirePermission("project:view"), async (req: AuthRequest, res: Response, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const project = await prisma.project.findUnique({
      where: { key },
      select: { id: true },
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const activities = await prisma.activity.findMany({
      where: {
        issue: { projectId: project.id },
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        issue: {
          select: {
            id: true,
            key: true,
            title: true,
            type: true,
            status: { select: { id: true, name: true, category: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    res.json({ activities });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:key - Update project details (name, description)
router.patch("/:key", authenticateToken, requirePermission("project:settings"), async (req: AuthRequest, res: Response, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const { name, description } = updateProjectSchema.parse(req.body);

    const existingProject = await prisma.project.findUnique({
      where: { key },
    });

    if (!existingProject) {
      res.status(404).json({ message: "Project tidak ditemukan" });
      return;
    }

    const updated = await prisma.project.update({
      where: { id: existingProject.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
      },
      include: {
        statuses: { orderBy: { position: "asc" } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        lead: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { issues: true } },
      },
    });

    res.json({ project: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:key/available-users - Search users not yet in this project
router.get("/:key/available-users", authenticateToken, requirePermission("member:manage"), async (req: AuthRequest, res: Response, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const project = await prisma.project.findUnique({
      where: { key },
      include: { members: { select: { userId: true } } },
    });

    if (!project) {
      res.status(404).json({ message: "Project tidak ditemukan" });
      return;
    }

    const existingMemberUserIds = project.members.map((m) => m.userId);

    const availableUsers = await prisma.user.findMany({
      where: {
        id: { notIn: existingMemberUserIds },
        ...(q
          ? {
              OR: [
                { email: { contains: q.toLowerCase() } },
                { name: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
      take: 10,
    });

    res.json({ users: availableUsers });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:key/members - Add a new member to the project with security checks
router.post(
  "/:key/members",
  memberActionRateLimiter,
  authenticateToken,
  requirePermission("member:manage"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const key = req.params.key.toUpperCase();
      const { userId: targetUserId, email, role } = addMemberSchema.parse(req.body);

      const project = await prisma.project.findUnique({
        where: { key },
        include: { members: true },
      });

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      // Security Check: Privilege Escalation Prevention
      // Only project Lead or existing ADMIN can grant the ADMIN role
      if (role === "ADMIN") {
        const isActorLead = project.leadId === req.user?.id;
        const actorMembership = project.members.find((m) => m.userId === req.user?.id);
        if (!isActorLead && actorMembership?.role !== "ADMIN") {
          res.status(403).json({
            message: "Hanya Pemilik Project atau Admin yang memiliki hak istimewa untuk mengangkat peran ADMIN.",
            code: "INSUFFICIENT_PRIVILEGE",
          });
          return;
        }
      }

      // Security Check: User Existence and Verification
      let targetUser: { id: string; name: string; email: string; avatarUrl: string | null } | null = null;
      if (targetUserId) {
        targetUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: { id: true, name: true, email: true, avatarUrl: true },
        });
      } else if (email) {
        targetUser = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
          select: { id: true, name: true, email: true, avatarUrl: true },
        });
      }

      if (!targetUser) {
        res.status(404).json({
          message: email
            ? `Pengguna dengan email '${email}' belum terdaftar. Untuk alasan keamanan, pengguna harus memiliki akun Zura terdaftar terlebih dahulu.`
            : "Pengguna tidak ditemukan",
          code: "USER_NOT_REGISTERED",
        });
        return;
      }

      // Security Check: Prevent Duplicate Membership
      const existingMember = project.members.find((m) => m.userId === targetUser!.id);
      if (existingMember) {
        res.status(409).json({
          message: `Pengguna '${targetUser!.name}' (${targetUser!.email}) sudah menjadi anggota di project ini dengan peran ${existingMember.role}.`,
          code: "ALREADY_MEMBER",
        });
        return;
      }

      // Create membership
      const member = await prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: targetUser!.id,
          role,
        },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      // Security Notification: Notify the newly added user
      await notifyUser({
        recipientId: targetUser!.id,
        actorId: req.user!.id,
        type: "ASSIGNED",
        title: "Akses Project Diberikan",
        message: `${req.user?.name || "Admin"} telah menambahkan Anda ke project '${project.name}' (${project.key}) sebagai ${role}.`,
        projectId: project.id,
      });

      res.status(201).json({ member });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/projects/:key/members/:userId - Change member role (with admin & lead lock)
router.patch(
  "/:key/members/:userId",
  memberActionRateLimiter,
  authenticateToken,
  requirePermission("member:manage"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const key = req.params.key.toUpperCase();
      const { userId: targetUserId } = req.params;
      const { role: newRole } = memberRoleSchema.parse(req.body);

      const project = await prisma.project.findUnique({
        where: { key },
        include: { members: true },
      });

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      // Security Check: Privilege Escalation Prevention
      // Only project Lead or existing ADMIN can grant the ADMIN role
      if (newRole === "ADMIN") {
        const isActorLead = project.leadId === req.user?.id;
        const actorMembership = project.members.find((m) => m.userId === req.user?.id);
        if (!isActorLead && actorMembership?.role !== "ADMIN") {
          res.status(403).json({
            message: "Hanya Pemilik Project atau Admin yang memiliki hak istimewa untuk mengangkat peran ADMIN.",
            code: "INSUFFICIENT_PRIVILEGE",
          });
          return;
        }
      }

      // Validate admin & lead locks
      const validation = validateMemberMutation({
        projectLeadId: project.leadId,
        members: project.members,
        targetUserId,
        actorUserId: req.user?.id,
        newRole,
      });

      if (!validation.allowed) {
        res.status(400).json({ message: validation.reason });
        return;
      }

      const member = await prisma.projectMember.update({
        where: {
          projectId_userId: {
            projectId: project.id,
            userId: targetUserId,
          },
        },
        data: { role: newRole },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      // Security Notification: Notify member of role update
      await notifyUser({
        recipientId: targetUserId,
        actorId: req.user!.id,
        type: "ASSIGNED",
        title: "Peran Project Diperbarui",
        message: `Peran Anda di project '${project.name}' (${project.key}) telah diubah menjadi ${newRole} oleh ${req.user?.name || "Admin"}.`,
        projectId: project.id,
      });

      res.json({ member });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/projects/:key/members/:userId - Remove member (with admin & lead lock)
router.delete("/:key/members/:userId", authenticateToken, requirePermission("member:manage"), async (req: AuthRequest, res: Response, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const { userId: targetUserId } = req.params;

    const project = await prisma.project.findUnique({
      where: { key },
      include: { members: true },
    });

    if (!project) {
      res.status(404).json({ message: "Project tidak ditemukan" });
      return;
    }

    // Validate admin & lead locks
    const validation = validateMemberMutation({
      projectLeadId: project.leadId,
      members: project.members,
      targetUserId,
      actorUserId: req.user?.id,
      isDelete: true,
    });

    if (!validation.allowed) {
      res.status(400).json({ message: validation.reason });
      return;
    }

    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: targetUserId,
        },
      },
    });

    res.json({ message: "Anggota berhasil dihapus dari project" });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:key - Delete project (lead only)
router.delete("/:key", authenticateToken, requirePermission("project:delete"), async (req: AuthRequest, res: Response, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const project = await prisma.project.findUnique({ where: { key } });

    if (!project) {
      res.status(404).json({ message: "Project tidak ditemukan" });
      return;
    }

    // Explicit Lead Only Enforcement (Temuan 7 Roadmap 06)
    if (project.leadId !== req.user?.id) {
      res.status(403).json({ message: "Hanya pemilik project (lead) yang berhak menghapus project" });
      return;
    }

    await prisma.project.delete({ where: { id: project.id } });
    res.json({ message: "Project berhasil dihapus" });
  } catch (err) {
    next(err);
  }
});

const createStatusSchema = z.object({
  name: z.string().trim().min(1, "Nama tahapan/kolom status wajib diisi").max(50, "Nama maksimal 50 karakter"),
  category: z.enum(["TO_DO", "IN_PROGRESS", "DONE"]).default("IN_PROGRESS"),
  position: z.number().optional(),
});

// POST /api/projects/:key/statuses - Create a new status / kanban column
router.post(
  "/:key/statuses",
  authenticateToken,
  requirePermission("issue:create"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const key = req.params.key.toUpperCase();
      const { name, category, position } = createStatusSchema.parse(req.body);

      const project = await prisma.project.findUnique({
        where: { key },
        include: { statuses: { orderBy: { position: "asc" } } },
      });

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      // Check duplicate name in same project
      const duplicate = project.statuses.find(
        (s) => s.name.toLowerCase() === name.toLowerCase()
      );
      if (duplicate) {
        res.status(409).json({ message: `Kolom dengan nama '${name}' sudah ada di project ini` });
        return;
      }

      // Calculate position
      let finalPosition = position;
      if (finalPosition === undefined) {
        const maxPos = project.statuses.length > 0
          ? Math.max(...project.statuses.map((s) => s.position))
          : 0;
        finalPosition = maxPos + 1000;
      }

      const status = await prisma.status.create({
        data: {
          name,
          category,
          position: finalPosition,
          projectId: project.id,
        },
      });

      res.status(201).json({ status });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/projects/:key/statuses/:statusId - Update status name / category
router.patch(
  "/:key/statuses/:statusId",
  authenticateToken,
  requirePermission("issue:create"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const key = req.params.key.toUpperCase();
      const { statusId } = req.params;
      const { name, category, position } = z
        .object({
          name: z.string().trim().min(1).max(50).optional(),
          category: z.enum(["TO_DO", "IN_PROGRESS", "DONE"]).optional(),
          position: z.number().optional(),
        })
        .parse(req.body);

      const project = await prisma.project.findUnique({
        where: { key },
        include: { statuses: true },
      });

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      const existing = project.statuses.find((s) => s.id === statusId);
      if (!existing) {
        res.status(404).json({ message: "Kolom status tidak ditemukan" });
        return;
      }

      if (name && name.toLowerCase() !== existing.name.toLowerCase()) {
        const duplicate = project.statuses.find(
          (s) => s.id !== statusId && s.name.toLowerCase() === name.toLowerCase()
        );
        if (duplicate) {
          res.status(409).json({ message: `Kolom dengan nama '${name}' sudah ada di project ini` });
          return;
        }
      }

      const updatedStatus = await prisma.status.update({
        where: { id: statusId },
        data: {
          name: name ?? undefined,
          category: category ?? undefined,
          position: position ?? undefined,
        },
      });

      res.json({ status: updatedStatus });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/projects/:key/statuses/:statusId - Delete a status / kanban column
router.delete(
  "/:key/statuses/:statusId",
  authenticateToken,
  requirePermission("issue:create"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const key = req.params.key.toUpperCase();
      const { statusId } = req.params;

      const project = await prisma.project.findUnique({
        where: { key },
        include: { statuses: true },
      });

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      const status = project.statuses.find((s) => s.id === statusId);
      if (!status) {
        res.status(404).json({ message: "Kolom status tidak ditemukan" });
        return;
      }

      if (project.statuses.length <= 1) {
        res.status(400).json({ message: "Papan minimal harus memiliki 1 kolom status" });
        return;
      }

      const issuesCount = await prisma.issue.count({
        where: { statusId },
      });

      if (issuesCount > 0) {
        res.status(400).json({
          message: `Kolom '${status.name}' masih memiliki ${issuesCount} kartu issue. Pindahkan kartu sebelum menghapus kolom.`,
        });
        return;
      }

      await prisma.status.delete({ where: { id: statusId } });
      res.json({ message: "Kolom status berhasil dihapus", statusId });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/projects/:key/statuses/reorder - Reorder statuses in a project
router.put(
  "/:key/statuses/reorder",
  authenticateToken,
  requirePermission("issue:create"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const key = req.params.key.toUpperCase();
      const { statusIds } = z
        .object({
          statusIds: z.array(z.string()).min(1),
        })
        .parse(req.body);

      const project = await prisma.project.findUnique({
        where: { key },
        include: { statuses: true },
      });

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      await prisma.$transaction(
        statusIds.map((id, index) =>
          prisma.status.update({
            where: { id },
            data: { position: (index + 1) * 1000 },
          })
        )
      );

      const updatedStatuses = await prisma.status.findMany({
        where: { projectId: project.id },
        orderBy: { position: "asc" },
      });

      res.json({ statuses: updatedStatuses });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
