import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

const createIssueSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["EPIC", "STORY", "TASK", "BUG", "SUBTASK"]).default("TASK"),
  priority: z.enum(["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST"]).default("MEDIUM"),
  storyPoints: z.number().int().nonnegative().optional().nullable(),
  statusId: z.string().optional(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

const updateIssueSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z.enum(["EPIC", "STORY", "TASK", "BUG", "SUBTASK"]).optional(),
  priority: z.enum(["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST"]).optional(),
  storyPoints: z.number().int().nonnegative().nullable().optional(),
  statusId: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
});

const moveIssueSchema = z.object({
  statusId: z.string().min(1),
  position: z.number(),
});

// GET /api/projects/:key/issues - List issues for a project
router.get("/projects/:key/issues", authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const projectKey = req.params.key.toUpperCase();
    const { q, type, assigneeId, statusId } = req.query;

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

    if (assigneeId && typeof assigneeId === "string") {
      whereClause.assigneeId = assigneeId === "unassigned" ? null : assigneeId;
    }

    if (statusId && typeof statusId === "string") {
      whereClause.statusId = statusId;
    }

    const issues = await prisma.issue.findMany({
      where: whereClause,
      include: {
        status: true,
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        reporter: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        _count: {
          select: { comments: true },
        },
      },
      orderBy: { position: "asc" },
    });

    res.json({ issues });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:key/issues - Create a new issue
router.post("/projects/:key/issues", authenticateToken, async (req: AuthRequest, res: Response, next) => {
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
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          position: nextPosition,
          statusId: targetStatusId,
          projectId: project.id,
          assigneeId: body.assigneeId || null,
          reporterId: userId,
          parentId: body.parentId || null,
        },
        include: {
          status: true,
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { comments: true } },
        },
      });

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

    res.status(201).json({ issue: newIssue });
  } catch (err) {
    next(err);
  }
});

// GET /api/issues/:key - Detail issue by key (e.g. ABC-1)
router.get("/issues/:key", authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const key = req.params.key.toUpperCase();

    const issue = await prisma.issue.findUnique({
      where: { key },
      include: {
        status: true,
        project: {
          select: { id: true, key: true, name: true, statuses: { orderBy: { position: "asc" } } },
        },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
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

    res.json({ issue });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/issues/:key - Update issue details
router.patch("/issues/:key", authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const body = updateIssueSchema.parse(req.body);
    const userId = req.user!.id;

    const currentIssue = await prisma.issue.findUnique({
      where: { key },
      include: { status: true },
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

    if (body.dueDate !== undefined) {
      updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }

    if (body.statusId !== undefined && body.statusId !== currentIssue.statusId) {
      updateData.statusId = body.statusId;
      activitiesToCreate.push({
        action: "STATUS_CHANGED",
        field: "status",
        oldValue: currentIssue.status.name,
        newValue: body.statusId,
      });
    }

    const updatedIssue = await prisma.$transaction(async (tx) => {
      const issue = await tx.issue.update({
        where: { id: currentIssue.id },
        data: updateData,
        include: {
          status: true,
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { comments: true } },
        },
      });

      for (const act of activitiesToCreate) {
        await tx.activity.create({
          data: {
            ...act,
            issueId: issue.id,
            userId,
          },
        });
      }

      return issue;
    });

    res.json({ issue: updatedIssue });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/issues/:key/move - Move status & position (Kanban Drag & Drop)
router.patch("/issues/:key/move", authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const { statusId, position } = moveIssueSchema.parse(req.body);
    const userId = req.user!.id;

    const currentIssue = await prisma.issue.findUnique({
      where: { key },
      include: { status: true },
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
      }

      return issue;
    });

    res.json({ issue: updatedIssue });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/issues/:key
router.delete("/issues/:key", authenticateToken, async (req: AuthRequest, res: Response, next) => {
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
});

export default router;
