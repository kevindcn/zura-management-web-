import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { getRandomLabelColor } from "./labels.js";
import { notifyUser } from "../lib/notifications.js";
import { isEligibleForReporting, recordIssueEvent } from "../lib/issueEvents.js";

const router = Router();

const createIssueSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title maximum 255 characters"),
  description: z
    .string()
    .max(500000, "Description maximum 500,000 characters")
    .optional(),
  type: z.enum(["EPIC", "STORY", "TASK", "BUG", "SUBTASK"]).default("TASK"),
  priority: z.enum(["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST"]).default("MEDIUM"),
  storyPoints: z.number().int().nonnegative().optional().nullable(),
  statusId: z.string().optional(),
  assigneeId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  sprintId: z.string().optional().nullable(),
  labels: z.array(z.string()).optional(),
});

const createSubtaskSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title maximum 255 characters"),
  assigneeId: z.string().optional().nullable(),
  priority: z.enum(["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST"]).default("MEDIUM"),
  statusId: z.string().optional(),
});

const updateIssueSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(255, "Title maximum 255 characters")
    .optional(),
  description: z
    .string()
    .max(500000, "Description maximum 500,000 characters")
    .nullable()
    .optional(),
  type: z.enum(["EPIC", "STORY", "TASK", "BUG", "SUBTASK"]).optional(),
  priority: z.enum(["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST"]).optional(),
  storyPoints: z.number().int().nonnegative().nullable().optional(),
  statusId: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
});

const moveIssueSchema = z.object({
  statusId: z.string().min(1),
  position: z.number(),
});

// GET /api/projects/:key/issues - List issues for a project
router.get(
  "/projects/:key/issues",
  authenticateToken,
  requirePermission("project:view"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const projectKey = req.params.key.toUpperCase();
      const { q, type, assigneeId, statusId, priority, labelId, page, limit } = req.query;

      const project = await prisma.project.findUnique({
        where: { key: projectKey },
        select: { id: true },
      });

      if (!project) {
        res.status(404).json({ message: "Project not found" });
        return;
      }

      const whereClause: any = {
        projectId: project.id,
      };

      if (q && typeof q === "string" && q.trim()) {
        const search = q.trim();
        whereClause.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { key: { contains: search, mode: "insensitive" } },
        ];
      }

      if (type && typeof type === "string" && type !== "ALL") {
        whereClause.type = type;
      }

      if (priority && typeof priority === "string" && priority !== "ALL") {
        whereClause.priority = priority;
      }

      if (labelId && typeof labelId === "string") {
        whereClause.labels = { some: { id: labelId } };
      }

      if (assigneeId && typeof assigneeId === "string") {
        whereClause.assigneeId = assigneeId === "unassigned" ? null : assigneeId;
      }

      if (statusId && typeof statusId === "string") {
        whereClause.statusId = statusId;
      }

      let issues;
      let pagination;

      if (page !== undefined || limit !== undefined) {
        const pageNum = Math.max(1, parseInt(String(page || 1), 10));
        const limitNum = Math.max(1, Math.min(100, parseInt(String(limit || 25), 10)));
        const total = await prisma.issue.count({ where: whereClause });
        const skip = (pageNum - 1) * limitNum;

        issues = await prisma.issue.findMany({
          where: whereClause,
          include: {
            status: true,
            sprint: {
              select: { id: true, name: true, state: true },
            },
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            reporter: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            _count: {
              select: { comments: true, watchers: true },
            },
            labels: true,
            children: {
              select: {
                id: true,
                key: true,
                title: true,
                statusId: true,
                status: { select: { category: true } },
              },
            },
          },
          orderBy: { position: "asc" },
          skip,
          take: limitNum,
        });

        pagination = {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1,
          hasMore: pageNum * limitNum < total,
        };
      } else {
        issues = await prisma.issue.findMany({
          where: whereClause,
          include: {
            status: true,
            sprint: {
              select: { id: true, name: true, state: true },
            },
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            reporter: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            _count: {
              select: { comments: true, watchers: true },
            },
            labels: true,
            children: {
              select: {
                id: true,
                key: true,
                title: true,
                statusId: true,
                status: { select: { category: true } },
              },
            },
          },
          orderBy: { position: "asc" },
        });

        pagination = {
          total: issues.length,
          page: 1,
          limit: issues.length,
          totalPages: 1,
          hasMore: false,
        };
      }

      res.json({ issues, pagination });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/projects/:key/issues - Create a new issue
router.post(
  "/projects/:key/issues",
  authenticateToken,
  requirePermission("issue:create"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const projectKey = req.params.key.toUpperCase();
      const body = createIssueSchema.parse(req.body);
      const userId = req.user!.id;

      const project = await prisma.project.findUnique({
        where: { key: projectKey },
        include: {
          statuses: { orderBy: { position: "asc" }, take: 1 },
        },
      });

      if (!project) {
        res.status(404).json({ message: "Project not found" });
        return;
      }

      // Default status if not provided: the first status in project (usually "To Do")
      const targetStatusId = body.statusId || (project.statuses[0] ? project.statuses[0].id : null);
      if (!targetStatusId) {
        res.status(400).json({ message: "No workflow status found for this project" });
        return;
      }

      // Atomic transaction for issueCounter and issue creation
      const newIssue = await prisma.$transaction(async (tx) => {
        const updatedProject = await tx.project.update({
          where: { id: project.id },
          data: { issueCounter: { increment: 1 } },
          select: { issueCounter: true },
        });

        const issueNumber = updatedProject.issueCounter;
        const issueKey = `${projectKey}-${issueNumber}`;

        // Calculate position at bottom of status
        const highestCard = await tx.issue.findFirst({
          where: { projectId: project.id, statusId: targetStatusId },
          orderBy: { position: "desc" },
          select: { position: true },
        });

        const nextPosition = highestCard ? highestCard.position + 1000 : 1000;

        const issue = await tx.issue.create({
          data: {
            key: issueKey,
            number: issueNumber,
            title: body.title,
            description: body.description || null,
            type: body.type,
            priority: body.priority,
            storyPoints: body.storyPoints || null,
            startDate: body.startDate ? new Date(body.startDate) : null,
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
            position: nextPosition,
            statusId: targetStatusId,
            projectId: project.id,
            assigneeId: body.assigneeId || null,
            reporterId: userId,
            parentId: body.parentId || null,
            sprintId: body.sprintId || null,
          },
          include: {
            status: true,
            sprint: { select: { id: true, name: true, state: true } },
            assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
            reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
            _count: { select: { comments: true } },
            labels: true,
          },
        });

        // Connect labels if provided
        if (body.labels && body.labels.length > 0) {
          const labelRecords = await Promise.all(
            body.labels.map(async (name: string) => {
              return tx.label.upsert({
                where: {
                  projectId_name: {
                    projectId: project.id,
                    name: name.trim(),
                  },
                },
                create: {
                  name: name.trim(),
                  projectId: project.id,
                  color: getRandomLabelColor(name.trim()),
                },
                update: {},
              });
            })
          );

          await tx.issue.update({
            where: { id: issue.id },
            data: {
              labels: {
                connect: labelRecords.map((l) => ({ id: l.id })),
              },
            },
          });
        }

        // Log activity
        await tx.activity.create({
          data: {
            action: "CREATED",
            field: "issue",
            newValue: issue.title,
            issueId: issue.id,
            userId,
          },
        });

        return issue;
      });

      // Record ADDED_TO_SPRINT event if created directly into an active sprint
      if (newIssue.sprintId && isEligibleForReporting(newIssue.type)) {
        const targetSprint = await prisma.sprint.findUnique({
          where: { id: newIssue.sprintId },
          select: { state: true },
        });
        if (targetSprint?.state === "ACTIVE") {
          await recordIssueEvent(prisma, {
            issueId: newIssue.id,
            sprintId: newIssue.sprintId,
            eventType: "ADDED_TO_SPRINT",
            points: newIssue.storyPoints,
            category: newIssue.status.category,
          });
        }
      }

      // Notify assignee if assigned to someone else
      if (newIssue.assigneeId && newIssue.assigneeId !== userId) {
        await notifyUser({
          recipientId: newIssue.assigneeId,
          actorId: userId,
          type: "ASSIGNED",
          title: "Ditugaskan ke Work Item",
          message: `menugaskan ${newIssue.key} '${newIssue.title}' kepada Anda`,
          issueKey: newIssue.key,
          projectId: newIssue.projectId,
        });
      }

      res.status(201).json({ issue: newIssue });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/issues/:key - Detail issue by key (e.g. ABC-1)
router.get(
  "/issues/:key",
  authenticateToken,
  requirePermission("issue:view"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const key = req.params.key.toUpperCase();

      const issue = await prisma.issue.findUnique({
        where: { key },
        include: {
          status: true,
          sprint: { select: { id: true, name: true, state: true } },
          project: {
            select: { id: true, key: true, name: true, statuses: { orderBy: { position: "asc" } } },
          },
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
          labels: true,
          parent: {
            select: { id: true, key: true, title: true, type: true },
          },
          children: {
            include: {
              status: true,
              assignee: { select: { id: true, name: true, avatarUrl: true } },
            },
            orderBy: { position: "asc" },
          },
          comments: {
            include: {
              author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
            orderBy: { createdAt: "desc" },
          },
          watchers: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          activities: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 30,
          },
        },
      });

      if (!issue) {
        res.status(404).json({ message: "Issue not found" });
        return;
      }

      const userId = req.user!.id;
      const isWatching = issue.watchers?.some((w) => w.userId === userId) || false;
      const watcherCount = issue.watchers?.length || 0;

      res.json({
        issue: {
          ...issue,
          isWatching,
          watcherCount,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/issues/:key/watch - Toggle watching an issue
router.post(
  "/issues/:key/watch",
  authenticateToken,
  requirePermission("issue:view"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const key = req.params.key.toUpperCase();
      const userId = req.user!.id;

      const issue = await prisma.issue.findUnique({
        where: { key },
        select: { id: true, key: true, projectId: true },
      });

      if (!issue) {
        res.status(404).json({ message: "Work item tidak ditemukan" });
        return;
      }

      const existing = await prisma.issueWatcher.findUnique({
        where: {
          issueId_userId: {
            issueId: issue.id,
            userId,
          },
        },
      });

      let isWatching = false;
      if (existing) {
        await prisma.issueWatcher.delete({
          where: { id: existing.id },
        });
        isWatching = false;
      } else {
        await prisma.issueWatcher.create({
          data: {
            issueId: issue.id,
            userId,
          },
        });
        isWatching = true;
      }

      const watcherCount = await prisma.issueWatcher.count({
        where: { issueId: issue.id },
      });

      res.json({
        isWatching,
        watcherCount,
        message: isWatching
          ? `Anda sekarang mengikuti ${key}`
          : `Anda berhenti mengikuti ${key}`,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/issues/:key/watchers - List all watchers for an issue
router.get(
  "/issues/:key/watchers",
  authenticateToken,
  requirePermission("issue:view"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const key = req.params.key.toUpperCase();
      const userId = req.user!.id;

      const issue = await prisma.issue.findUnique({
        where: { key },
        select: {
          id: true,
          watchers: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!issue) {
        res.status(404).json({ message: "Work item tidak ditemukan" });
        return;
      }

      const isWatching = issue.watchers.some((w) => w.userId === userId);
      const watchers = issue.watchers.map((w) => w.user);

      res.json({
        watchers,
        watcherCount: watchers.length,
        isWatching,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/issues/:key - Update issue details
router.patch(
  "/issues/:key",
  authenticateToken,
  requirePermission("issue:edit"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const key = req.params.key.toUpperCase();
      const body = updateIssueSchema.parse(req.body);
      const userId = req.user!.id;

      const currentIssue = await prisma.issue.findUnique({
        where: { key },
        include: { status: true, sprint: true },
      });

      if (!currentIssue) {
        res.status(404).json({ message: "Issue not found" });
        return;
      }

      const updateData: any = {};
      const activitiesToCreate: any[] = [];

      if (body.title !== undefined && body.title !== currentIssue.title) {
        updateData.title = body.title;
        activitiesToCreate.push({
          action: "UPDATED",
          field: "title",
          oldValue: currentIssue.title,
          newValue: body.title,
        });
      }

      if (body.description !== undefined && body.description !== currentIssue.description) {
        updateData.description = body.description;
        activitiesToCreate.push({
          action: "UPDATED",
          field: "description",
          oldValue: "Previous description",
          newValue: "Updated description",
        });
      }

      if (body.type !== undefined && body.type !== currentIssue.type) {
        updateData.type = body.type;
        activitiesToCreate.push({
          action: "UPDATED",
          field: "type",
          oldValue: currentIssue.type,
          newValue: body.type,
        });
      }

      if (body.priority !== undefined && body.priority !== currentIssue.priority) {
        updateData.priority = body.priority;
        activitiesToCreate.push({
          action: "UPDATED",
          field: "priority",
          oldValue: currentIssue.priority,
          newValue: body.priority,
        });
      }

      if (body.storyPoints !== undefined && body.storyPoints !== currentIssue.storyPoints) {
        updateData.storyPoints = body.storyPoints;
        activitiesToCreate.push({
          action: "UPDATED",
          field: "storyPoints",
          oldValue: String(currentIssue.storyPoints ?? "None"),
          newValue: String(body.storyPoints ?? "None"),
        });

        // Record POINTS_CHANGED if issue is in an active sprint
        if (currentIssue.sprintId && currentIssue.sprint?.state === "ACTIVE" && isEligibleForReporting(currentIssue.type)) {
          await recordIssueEvent(prisma, {
            issueId: currentIssue.id,
            sprintId: currentIssue.sprintId,
            eventType: "POINTS_CHANGED",
            points: body.storyPoints,
            previousPoints: currentIssue.storyPoints,
          });
        }
      }

      if (body.assigneeId !== undefined && body.assigneeId !== currentIssue.assigneeId) {
        updateData.assigneeId = body.assigneeId;
        activitiesToCreate.push({
          action: "ASSIGNEE_CHANGED",
          field: "assignee",
          oldValue: currentIssue.assigneeId || "Unassigned",
          newValue: body.assigneeId || "Unassigned",
        });
      }

      if (body.startDate !== undefined) {
        updateData.startDate = body.startDate ? new Date(body.startDate) : null;
      }

      if (body.dueDate !== undefined) {
        updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      }

      if (body.sprintId !== undefined && body.sprintId !== currentIssue.sprintId) {
        updateData.sprintId = body.sprintId;
        if (isEligibleForReporting(currentIssue.type)) {
          if (currentIssue.sprintId && currentIssue.sprint?.state === "ACTIVE") {
            await recordIssueEvent(prisma, {
              issueId: currentIssue.id,
              sprintId: currentIssue.sprintId,
              eventType: "REMOVED_FROM_SPRINT",
            });
          }
          if (body.sprintId) {
            const newSprint = await prisma.sprint.findUnique({
              where: { id: body.sprintId },
              select: { state: true },
            });
            if (newSprint?.state === "ACTIVE") {
              await recordIssueEvent(prisma, {
                issueId: currentIssue.id,
                sprintId: body.sprintId,
                eventType: "ADDED_TO_SPRINT",
                points: body.storyPoints !== undefined ? body.storyPoints : currentIssue.storyPoints,
                category: currentIssue.status.category,
              });
            }
          }
        }
      }

      if (body.statusId !== undefined && body.statusId !== currentIssue.statusId) {
        updateData.statusId = body.statusId;
        const targetStatus = await prisma.status.findUnique({ where: { id: body.statusId } });
        activitiesToCreate.push({
          action: "STATUS_CHANGED",
          field: "status",
          oldValue: currentIssue.status.name,
          newValue: targetStatus ? targetStatus.name : body.statusId,
        });

        // Record STATUS_CHANGED only if category changed
        if (targetStatus && targetStatus.category !== currentIssue.status.category) {
          if (currentIssue.sprintId && currentIssue.sprint?.state === "ACTIVE" && isEligibleForReporting(currentIssue.type)) {
            await recordIssueEvent(prisma, {
              issueId: currentIssue.id,
              sprintId: currentIssue.sprintId,
              eventType: "STATUS_CHANGED",
              category: targetStatus.category,
              previousCategory: currentIssue.status.category,
            });
          }
        }
      }

      if (body.labels !== undefined) {
        if (body.labels.length > 0) {
          const labelRecords = await Promise.all(
            body.labels.map(async (name: string) => {
              return prisma.label.upsert({
                where: {
                  projectId_name: {
                    projectId: currentIssue.projectId,
                    name: name.trim(),
                  },
                },
                create: {
                  name: name.trim(),
                  projectId: currentIssue.projectId,
                  color: getRandomLabelColor(name.trim()),
                },
                update: {},
              });
            })
          );
          updateData.labels = {
            set: labelRecords.map((l) => ({ id: l.id })),
          };
        } else {
          updateData.labels = {
            set: [],
          };
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.issue.update({
          where: { id: currentIssue.id },
          data: updateData,
        });

        for (const act of activitiesToCreate) {
          await tx.activity.create({
            data: {
              ...act,
              issueId: currentIssue.id,
              userId,
            },
          });
        }
      });

      // Retrieve full issue with comments, activities, and watchers intact
      const fullIssue = await prisma.issue.findUnique({
        where: { id: currentIssue.id },
        include: {
          status: true,
          sprint: { select: { id: true, name: true, state: true } },
          project: {
            select: { id: true, key: true, name: true, statuses: { orderBy: { position: "asc" } } },
          },
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
          labels: true,
          parent: {
            select: { id: true, key: true, title: true, type: true },
          },
          children: {
            include: {
              status: true,
              assignee: { select: { id: true, name: true, avatarUrl: true } },
            },
            orderBy: { position: "asc" },
          },
          comments: {
            include: {
              author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
            orderBy: { createdAt: "desc" },
          },
          watchers: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          activities: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 30,
          },
          _count: { select: { comments: true } },
        },
      });

      if (!fullIssue) {
        res.status(404).json({ message: "Issue not found" });
        return;
      }

      const isWatching = fullIssue.watchers?.some((w) => w.userId === userId) || false;
      const watcherCount = fullIssue.watchers?.length || 0;

      const updatedIssue = {
        ...fullIssue,
        isWatching,
        watcherCount,
      };

      // Notify on assignee changed
      if (body.assigneeId && body.assigneeId !== currentIssue.assigneeId && body.assigneeId !== userId) {
        await notifyUser({
          recipientId: body.assigneeId,
          actorId: userId,
          type: "ASSIGNED",
          title: "Ditugaskan ke Work Item",
          message: `menugaskan ${updatedIssue.key} '${updatedIssue.title}' kepada Anda`,
          issueKey: updatedIssue.key,
          projectId: updatedIssue.projectId,
        });
      }

      // Notify on status changed
      if (body.statusId && body.statusId !== currentIssue.statusId) {
        const recipients = new Set<string>();
        if (updatedIssue.assigneeId && updatedIssue.assigneeId !== userId) {
          recipients.add(updatedIssue.assigneeId);
        }
        if (updatedIssue.reporterId && updatedIssue.reporterId !== userId) {
          recipients.add(updatedIssue.reporterId);
        }
        const watchers = await prisma.issueWatcher.findMany({
          where: { issueId: updatedIssue.id },
          select: { userId: true },
        });
        for (const w of watchers) {
          if (w.userId !== userId) {
            recipients.add(w.userId);
          }
        }
        await Promise.all(
          Array.from(recipients).map((rId) =>
            notifyUser({
              recipientId: rId,
              actorId: userId,
              type: "STATUS_CHANGED",
              title: "Status Diperbarui",
              message: `memindahkan ${updatedIssue.key} ke ${updatedIssue.status.name}`,
              issueKey: updatedIssue.key,
              projectId: updatedIssue.projectId,
            })
          )
        );
      }

      res.json({ issue: updatedIssue });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/issues/:key/move - Move status & position (Kanban Drag & Drop)
router.patch(
  "/issues/:key/move",
  authenticateToken,
  requirePermission("issue:move"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const key = req.params.key.toUpperCase();
      const { statusId, position } = moveIssueSchema.parse(req.body);
      const userId = req.user!.id;

      const currentIssue = await prisma.issue.findUnique({
        where: { key },
        include: { status: true, sprint: true },
      });

      if (!currentIssue) {
        res.status(404).json({ message: "Issue not found" });
        return;
      }

      const statusChanged = currentIssue.statusId !== statusId;

      const updatedIssue = await prisma.$transaction(async (tx) => {
        const issue = await tx.issue.update({
          where: { id: currentIssue.id },
          data: {
            statusId,
            position,
          },
          include: {
            status: true,
            assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
            reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
            _count: { select: { comments: true } },
          },
        });

        if (statusChanged) {
          const targetStatus = await tx.status.findUnique({ where: { id: statusId } });
          await tx.activity.create({
            data: {
              action: "STATUS_CHANGED",
              field: "status",
              oldValue: currentIssue.status.name,
              newValue: targetStatus ? targetStatus.name : statusId,
              issueId: issue.id,
              userId,
            },
          });

          // Record STATUS_CHANGED reporting event if category changed while in active sprint
          if (targetStatus && targetStatus.category !== currentIssue.status.category) {
            if (currentIssue.sprintId && currentIssue.sprint?.state === "ACTIVE" && isEligibleForReporting(currentIssue.type)) {
              await recordIssueEvent(tx, {
                issueId: currentIssue.id,
                sprintId: currentIssue.sprintId,
                eventType: "STATUS_CHANGED",
                category: targetStatus.category,
                previousCategory: currentIssue.status.category,
              });
            }
          }
        }

        return issue;
      });

      if (statusChanged) {
        const recipients = new Set<string>();
        if (updatedIssue.assigneeId && updatedIssue.assigneeId !== userId) {
          recipients.add(updatedIssue.assigneeId);
        }
        if (updatedIssue.reporterId && updatedIssue.reporterId !== userId) {
          recipients.add(updatedIssue.reporterId);
        }
        const watchers = await prisma.issueWatcher.findMany({
          where: { issueId: updatedIssue.id },
          select: { userId: true },
        });
        for (const w of watchers) {
          if (w.userId !== userId) {
            recipients.add(w.userId);
          }
        }
        await Promise.all(
          Array.from(recipients).map((rId) =>
            notifyUser({
              recipientId: rId,
              actorId: userId,
              type: "STATUS_CHANGED",
              title: "Status Diperbarui",
              message: `memindahkan ${updatedIssue.key} ke ${updatedIssue.status.name}`,
              issueKey: updatedIssue.key,
              projectId: updatedIssue.projectId,
            })
          )
        );
      }

      res.json({ issue: updatedIssue });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/issues/:key
router.delete(
  "/issues/:key",
  authenticateToken,
  requirePermission("issue:delete:own"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const key = req.params.key.toUpperCase();

      const issue = await prisma.issue.findUnique({
        where: { key },
        select: { id: true },
      });

      if (!issue) {
        res.status(404).json({ message: "Issue not found" });
        return;
      }

      await prisma.issue.delete({
        where: { id: issue.id },
      });

      res.json({ message: "Issue deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/issues/:key/subtasks - Create a subtask under a parent issue
router.post(
  "/issues/:key/subtasks",
  authenticateToken,
  requirePermission("issue:create"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const parentKey = req.params.key.toUpperCase();
      const body = createSubtaskSchema.parse(req.body);
      const userId = req.user!.id;

      const parentIssue = await prisma.issue.findUnique({
        where: { key: parentKey },
        include: {
          project: {
            include: {
              statuses: { orderBy: { position: "asc" } },
            },
          },
        },
      });

      if (!parentIssue) {
        res.status(404).json({ message: "Parent work item tidak ditemukan" });
        return;
      }

      // Agile Guard: A subtask cannot have children (no nested subtasks)
      if (parentIssue.type === "SUBTASK") {
        res.status(400).json({
          message: "Subtask tidak dapat memiliki subtask (tidak boleh ada subtask bersarang)",
        });
        return;
      }

      const targetStatusId =
        body.statusId ||
        (parentIssue.project.statuses[0] ? parentIssue.project.statuses[0].id : parentIssue.statusId);

      const newSubtask = await prisma.$transaction(async (tx) => {
        const updatedProject = await tx.project.update({
          where: { id: parentIssue.projectId },
          data: { issueCounter: { increment: 1 } },
          select: { issueCounter: true },
        });

        const issueNumber = updatedProject.issueCounter;
        const subtaskKey = `${parentIssue.project.key}-${issueNumber}`;

        const highestCard = await tx.issue.findFirst({
          where: { projectId: parentIssue.projectId, statusId: targetStatusId },
          orderBy: { position: "desc" },
          select: { position: true },
        });

        const nextPosition = highestCard ? highestCard.position + 1000 : 1000;

        const subtask = await tx.issue.create({
          data: {
            key: subtaskKey,
            number: issueNumber,
            title: body.title.trim(),
            type: "SUBTASK",
            priority: body.priority,
            position: nextPosition,
            statusId: targetStatusId,
            projectId: parentIssue.projectId,
            assigneeId: body.assigneeId || null,
            reporterId: userId,
            parentId: parentIssue.id,
            sprintId: parentIssue.sprintId || null,
          },
          include: {
            status: true,
            assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
            reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
            parent: { select: { id: true, key: true, title: true, type: true } },
            labels: true,
          },
        });

        // Log activity on parent issue and subtask
        await tx.activity.create({
          data: {
            action: "CREATED",
            field: "subtask",
            newValue: `${subtaskKey}: ${subtask.title}`,
            issueId: parentIssue.id,
            userId,
          },
        });

        return subtask;
      });

      res.status(201).json({ subtask: newSubtask });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
