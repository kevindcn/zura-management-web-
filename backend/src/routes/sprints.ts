import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { notifyUser } from "../lib/notifications.js";
import { computeBurndown, classifySprintIssues, computeAgileSprintMetrics, BurndownResult } from "../lib/burndown.js";
import { isEligibleForReporting, recordIssueEvent } from "../lib/issueEvents.js";

const router = Router();

const createSprintSchema = z.object({
  name: z.string().min(1, "Nama sprint wajib diisi").max(100, "Nama sprint maksimal 100 karakter"),
  goal: z.string().max(1000, "Tujuan sprint maksimal 1.000 karakter").optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
}).strict();

const updateSprintSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  goal: z.string().max(1000).nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  state: z.enum(["FUTURE", "ACTIVE", "CLOSED"]).optional(),
  targetSprintId: z.string().nullable().optional(), // For rollover when completing sprint
}).strict();

const moveIssuesSchema = z.object({
  issueIds: z.array(z.string()).min(1, "Minimal 1 work item"),
  targetSprintId: z.string().nullable(),
}).strict();

const completeSprintSchema = z.object({
  targetSprintId: z.string().nullable().optional(),
}).strict();

const retroNotesSchema = z.object({
  good: z.string().optional().default(""),
  toImprove: z.string().optional().default(""),
  actionItems: z.string().optional().default(""),
}).strict();

// Helper to find project by key or id
async function findProject(identifier: string) {
  return prisma.project.findFirst({
    where: {
      OR: [{ key: identifier.toUpperCase() }, { id: identifier }],
    },
    select: { id: true, key: true, name: true },
  });
}

// Atomic Complete Sprint Logic (Frozen Snapshot + Rollover + SprintIssueResult)
async function executeCompleteSprint(
  projectId: string,
  sprintId: string,
  targetSprintId?: string | null
) {
  return prisma.$transaction(async (tx) => {
    const sprint = await tx.sprint.findFirst({
      where: { id: sprintId, projectId },
      include: {
        issues: {
          include: {
            status: true,
            assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!sprint) {
      throw new Error("Sprint tidak ditemukan pada project ini");
    }

    if (sprint.state === "CLOSED") {
      return sprint;
    }

    // Validate target sprint if provided
    let verifiedTargetSprint: any = null;
    if (targetSprintId) {
      verifiedTargetSprint = await tx.sprint.findFirst({
        where: { id: targetSprintId, projectId },
      });
      if (!verifiedTargetSprint) {
        throw new Error("Sprint tujuan rollover tidak ditemukan pada project ini");
      }
    }

    // Filter eligible issues (STORY, TASK, BUG)
    const allIssues = sprint.issues;
    const eligibleIssues = allIssues.filter((i) => isEligibleForReporting(i.type));

    const completedEligible = eligibleIssues.filter((i) => i.status.category === "DONE");
    const incompleteEligible = eligibleIssues.filter((i) => i.status.category !== "DONE");

    const completedPoints = completedEligible.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
    const completedIssuesCount = completedEligible.length;

    const sprintStartTime = sprint.startedAt ? new Date(sprint.startedAt).getTime() : new Date(sprint.createdAt).getTime();

    // Query earliest ADDED_TO_SPRINT timestamp per issue from event stream
    const sprintEvents = await tx.issueEvent.findMany({
      where: { sprintId: sprint.id, eventType: "ADDED_TO_SPRINT" },
      select: { issueId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const earliestAddedMap = new Map<string, number>();
    for (const e of sprintEvents) {
      const t = new Date(e.createdAt).getTime();
      if (!earliestAddedMap.has(e.issueId) || t < earliestAddedMap.get(e.issueId)!) {
        earliestAddedMap.set(e.issueId, t);
      }
    }

    // 1. Write frozen SprintIssueResult for ALL issues in sprint
    for (const issue of allIssues) {
      const isDone = issue.status.category === "DONE";
      const addedTs = earliestAddedMap.get(issue.id);
      const addedMidSprint = addedTs
        ? addedTs > sprintStartTime + 60000
        : new Date(issue.createdAt).getTime() > sprintStartTime + 60000;

      let outcome = "COMPLETED";
      if (!isDone) {
        outcome = targetSprintId ? "CARRIED_OVER" : "RETURNED_TO_BACKLOG";
      }

      await tx.sprintIssueResult.upsert({
        where: {
          sprintId_issueId: {
            sprintId: sprint.id,
            issueId: issue.id,
          },
        },
        create: {
          sprintId: sprint.id,
          issueId: issue.id,
          pointsAtClose: issue.storyPoints || 0,
          outcome,
          targetSprintId: isDone ? null : (targetSprintId || null),
          addedMidSprint,
        },
        update: {
          pointsAtClose: issue.storyPoints || 0,
          outcome,
          targetSprintId: isDone ? null : (targetSprintId || null),
          addedMidSprint,
        },
      });
    }

    // 2. Rollover incomplete issues
    const incompleteAll = allIssues.filter((i) => i.status.category !== "DONE");
    if (incompleteAll.length > 0) {
      const incompleteIds = incompleteAll.map((i) => i.id);

      await tx.issue.updateMany({
        where: { id: { in: incompleteIds } },
        data: { sprintId: targetSprintId || null },
      });

      // Record IssueEvents for reporting replay
      for (const inc of incompleteAll) {
        if (isEligibleForReporting(inc.type)) {
          await recordIssueEvent(tx, {
            issueId: inc.id,
            sprintId: sprint.id,
            eventType: "REMOVED_FROM_SPRINT",
          });

          if (targetSprintId && verifiedTargetSprint?.state === "ACTIVE") {
            await recordIssueEvent(tx, {
              issueId: inc.id,
              sprintId: targetSprintId,
              eventType: "ADDED_TO_SPRINT",
              points: inc.storyPoints,
              category: inc.status.category,
            });
          }
        }
      }
    }

    // 3. Mark sprint as CLOSED with frozen metrics
    const closedSprint = await tx.sprint.update({
      where: { id: sprint.id },
      data: {
        state: "CLOSED",
        closedAt: new Date(),
        completedPoints,
        completedIssues: completedIssuesCount,
      },
      include: {
        _count: { select: { issues: true } },
        issues: {
          include: {
            status: true,
            assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
      },
    });

    return closedSprint;
  });
}

// GET /api/projects/:key/sprints - List all sprints for a project
router.get(
  "/projects/:key/sprints",
  authenticateToken,
  requirePermission("sprint:view"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const project = await findProject(req.params.key);

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      const sprints = await prisma.sprint.findMany({
        where: { projectId: project.id },
        include: {
          _count: {
            select: { issues: true },
          },
          issues: {
            include: {
              status: true,
              assignee: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ sprints });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/projects/:key/sprints - Create a new sprint (FUTURE by default)
router.post(
  "/projects/:key/sprints",
  authenticateToken,
  requirePermission("sprint:manage"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const project = await findProject(req.params.key);
      const body = createSprintSchema.parse(req.body);

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      const sprint = await prisma.sprint.create({
        data: {
          name: body.name,
          goal: body.goal || null,
          startDate: body.startDate ? new Date(body.startDate) : null,
          endDate: body.endDate ? new Date(body.endDate) : null,
          state: "FUTURE",
          projectId: project.id,
        },
        include: {
          _count: { select: { issues: true } },
          issues: true,
        },
      });

      res.status(201).json({ sprint });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/projects/:key/sprints/:id/complete - Dedicated atomic sprint completion
router.post(
  "/projects/:key/sprints/:id/complete",
  authenticateToken,
  requirePermission("sprint:manage"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const project = await findProject(req.params.key);
      const sprintId = req.params.id;
      const { targetSprintId } = completeSprintSchema.parse(req.body);

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      const closedSprint = await executeCompleteSprint(project.id, sprintId, targetSprintId);
      res.json({
        message: `Sprint '${closedSprint.name}' berhasil diselesaikan`,
        sprint: closedSprint,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/projects/:key/sprints/:id - Update or Start/Complete a sprint
router.patch(
  "/projects/:key/sprints/:id",
  authenticateToken,
  requirePermission("sprint:manage"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const project = await findProject(req.params.key);
      const sprintId = req.params.id;
      const body = updateSprintSchema.parse(req.body);

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      const existingSprint = await prisma.sprint.findFirst({
        where: { id: sprintId, projectId: project.id },
      });

      if (!existingSprint) {
        res.status(404).json({ message: "Sprint tidak ditemukan pada project ini" });
        return;
      }

      // If completing sprint via PATCH state="CLOSED", use atomic complete logic
      if (body.state === "CLOSED" && existingSprint.state !== "CLOSED") {
        const closedSprint = await executeCompleteSprint(project.id, sprintId, body.targetSprintId);
        res.json({ sprint: closedSprint });
        return;
      }

      // Agile Guard: Only 1 active sprint allowed per project at a time
      if (body.state === "ACTIVE" && existingSprint.state !== "ACTIVE") {
        const activeSprint = await prisma.sprint.findFirst({
          where: {
            projectId: project.id,
            state: "ACTIVE",
            id: { not: sprintId },
          },
        });

        if (activeSprint) {
          res.status(400).json({
            message: `Project ini sudah memiliki sprint aktif ('${activeSprint.name}'). Selesaikan sprint aktif terlebih dahulu.`,
          });
          return;
        }
      }

      const updateData: any = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.goal !== undefined) updateData.goal = body.goal;
      if (body.startDate !== undefined) {
        updateData.startDate = body.startDate ? new Date(body.startDate) : null;
      }
      if (body.endDate !== undefined) {
        updateData.endDate = body.endDate ? new Date(body.endDate) : null;
      }
      if (body.state !== undefined) updateData.state = body.state;

      // Starting sprint: snapshot committedPoints & committedIssues, record initial ADDED_TO_SPRINT events
      if (body.state === "ACTIVE" && existingSprint.state !== "ACTIVE") {
        const eligibleIssues = await prisma.issue.findMany({
          where: {
            sprintId,
            projectId: project.id,
            type: { in: ["STORY", "TASK", "BUG"] },
          },
          include: { status: true },
        });

        const committedPoints = eligibleIssues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
        const committedIssues = eligibleIssues.length;
        const startedAt = new Date();

        updateData.startedAt = startedAt;
        updateData.committedPoints = committedPoints;
        updateData.committedIssues = committedIssues;

        // Record initial ADDED_TO_SPRINT events in batch
        for (const iss of eligibleIssues) {
          await recordIssueEvent(prisma, {
            issueId: iss.id,
            sprintId,
            eventType: "ADDED_TO_SPRINT",
            points: iss.storyPoints,
            category: iss.status.category,
            createdAt: startedAt,
          });
        }
      }

      const updatedSprint = await prisma.sprint.update({
        where: { id: sprintId },
        data: updateData,
        include: {
          _count: { select: { issues: true } },
          issues: {
            include: {
              status: true,
              assignee: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
        },
      });

      // If sprint transitioned to ACTIVE, notify project members
      if (body.state === "ACTIVE" && existingSprint.state !== "ACTIVE") {
        const members = await prisma.projectMember.findMany({
          where: { projectId: project.id, userId: { not: req.user!.id } },
          select: { userId: true },
        });

        await Promise.all(
          members.map((m) =>
            notifyUser({
              recipientId: m.userId,
              actorId: req.user!.id,
              type: "SPRINT",
              title: "Sprint Dimulai",
              message: `memulai sprint '${updatedSprint.name}' pada ${project.key}`,
              projectId: project.id,
            })
          )
        );
      }

      res.json({ sprint: updatedSprint });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/projects/:key/sprints/:id - Delete a sprint
router.delete(
  "/projects/:key/sprints/:id",
  authenticateToken,
  requirePermission("sprint:manage"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const project = await findProject(req.params.key);
      const sprintId = req.params.id;

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      const sprint = await prisma.sprint.findFirst({
        where: { id: sprintId, projectId: project.id },
      });

      if (!sprint) {
        res.status(404).json({ message: "Sprint tidak ditemukan" });
        return;
      }

      await prisma.sprint.delete({
        where: { id: sprintId },
      });

      res.json({ message: "Sprint berhasil dihapus dan item dikembalikan ke backlog" });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/projects/:key/sprints/move-issues & /api/projects/:key/sprints/:id/move-issues
router.post(
  ["/projects/:key/sprints/move-issues", "/projects/:key/sprints/:id/move-issues"],
  authenticateToken,
  requirePermission("issue:edit"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const project = await findProject(req.params.key);
      const { issueIds, targetSprintId } = moveIssuesSchema.parse(req.body);

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      let targetSprint: any = null;
      if (targetSprintId) {
        targetSprint = await prisma.sprint.findFirst({
          where: { id: targetSprintId, projectId: project.id },
        });
        if (!targetSprint) {
          res.status(404).json({ message: "Sprint tujuan tidak ditemukan pada project ini" });
          return;
        }
      }

      // Fetch issues before updating to record events
      const existingIssues = await prisma.issue.findMany({
        where: { id: { in: issueIds }, projectId: project.id },
        include: { status: true, sprint: true },
      });

      // Update issues to target sprint or backlog
      const result = await prisma.issue.updateMany({
        where: {
          id: { in: issueIds },
          projectId: project.id,
        },
        data: {
          sprintId: targetSprintId,
        },
      });

      // Record IssueEvents for active sprints
      for (const issue of existingIssues) {
        if (isEligibleForReporting(issue.type)) {
          // If moved out of an active sprint
          if (issue.sprintId && issue.sprint?.state === "ACTIVE" && issue.sprintId !== targetSprintId) {
            await recordIssueEvent(prisma, {
              issueId: issue.id,
              sprintId: issue.sprintId,
              eventType: "REMOVED_FROM_SPRINT",
            });
          }
          // If moved into an active sprint
          if (targetSprintId && targetSprint?.state === "ACTIVE" && issue.sprintId !== targetSprintId) {
            await recordIssueEvent(prisma, {
              issueId: issue.id,
              sprintId: targetSprintId,
              eventType: "ADDED_TO_SPRINT",
              points: issue.storyPoints,
              category: issue.status.category,
            });
          }
        }
      }

      res.json({
        message: `${result.count} work item berhasil dipindahkan`,
        count: result.count,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// REPORTING ENDPOINTS (BURNDOWN, VELOCITY, SPRINT REPORT)
// ==========================================

// GET /api/projects/:key/sprints/:id/burndown?metric=points|issues
router.get(
  "/projects/:key/sprints/:id/burndown",
  authenticateToken,
  requirePermission("sprint:view"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const project = await findProject(req.params.key);
      const sprintId = req.params.id;
      const metric = req.query.metric === "issues" ? "issues" : "points";

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      const sprint = await prisma.sprint.findFirst({
        where: { id: sprintId, projectId: project.id },
        include: {
          issues: {
            where: { type: { in: ["STORY", "TASK", "BUG"] } },
            include: { status: true },
          },
        },
      });

      if (!sprint) {
        res.status(404).json({ message: "Sprint tidak ditemukan pada project ini" });
        return;
      }

      // Fetch all recorded issue events for this sprint
      let events = await prisma.issueEvent.findMany({
        where: { sprintId: sprint.id },
        orderBy: { createdAt: "asc" },
      });

      // Auto-backfill active sprint events if none exist (seamless live support)
      if (events.length === 0 && sprint.issues.length > 0) {
        const startedTime = sprint.startedAt || sprint.createdAt;
        for (const iss of sprint.issues) {
          await recordIssueEvent(prisma, {
            issueId: iss.id,
            sprintId: sprint.id,
            eventType: "ADDED_TO_SPRINT",
            points: iss.storyPoints,
            category: iss.status.category,
            createdAt: startedTime,
          });
        }
        events = await prisma.issueEvent.findMany({
          where: { sprintId: sprint.id },
          orderBy: { createdAt: "asc" },
        });
      }

      const burndown = computeAgileSprintMetrics({
        sprint,
        events,
        metric,
        eligibleIssues: sprint.issues,
      });
      res.json({
        sprint: burndown.sprint,
        metric: burndown.metric,
        unestimated: burndown.unestimated,
        summary: {
          committed: burndown.summary.committed,
          completed: burndown.summary.completed,
          remaining: burndown.summary.remaining,
          scopeAdded: burndown.summary.scopeAdded,
          removed: burndown.summary.removed,
        },
        days: burndown.days,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/projects/:key/reports/velocity?sprints=6
router.get(
  "/projects/:key/reports/velocity",
  authenticateToken,
  requirePermission("sprint:view"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const project = await findProject(req.params.key);
      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      const requestedCount = parseInt(req.query.sprints as string, 10) || 6;
      const sprintsLimit = Math.min(12, Math.max(1, requestedCount));

      // Query only CLOSED sprints for this project
      const closedSprints = await prisma.sprint.findMany({
        where: { projectId: project.id, state: "CLOSED" },
        orderBy: { closedAt: "asc" },
        take: sprintsLimit,
      });

      if (closedSprints.length === 0) {
        res.json({
          sprints: [],
          averageVelocity: 0,
          recommendedCapacity: null,
          insufficientData: true,
          emptyMessage: "Belum ada sprint yang selesai. Velocity muncul setelah sprint pertama ditutup.",
        });
        return;
      }

      const sprintData = closedSprints.map((s) => {
        const committed = s.committedPoints ?? 0;
        const completed = s.completedPoints ?? 0;
        const completionRate = committed > 0 ? Math.round((completed / committed) * 100) : null;
        return {
          id: s.id,
          name: s.name,
          closedAt: s.closedAt,
          startDate: s.startDate,
          endDate: s.endDate,
          committedPoints: committed,
          completedPoints: completed,
          completionRate,
        };
      });

      const totalCompleted = sprintData.reduce((sum, s) => sum + s.completedPoints, 0);
      const averageVelocity = Math.round(totalCompleted / sprintData.length);

      // Capacity recommendation: average of last 3 closed sprints
      let recommendedCapacity: number | null = null;
      let insufficientData = false;
      let recommendationMessage: string | null = null;

      if (sprintData.length >= 3) {
        const last3 = sprintData.slice(-3);
        const last3Completed = last3.reduce((sum, s) => sum + s.completedPoints, 0);
        recommendedCapacity = Math.round(last3Completed / 3);
      } else {
        insufficientData = true;
        recommendationMessage = "Data belum cukup untuk rekomendasi kapasitas.";
      }

      res.json({
        sprints: sprintData,
        averageVelocity,
        recommendedCapacity,
        insufficientData,
        recommendationMessage,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/projects/:key/sprints/:id/report - Detailed official sprint report
router.get(
  "/projects/:key/sprints/:id/report",
  authenticateToken,
  requirePermission("sprint:view"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const project = await findProject(req.params.key);
      const sprintId = req.params.id;

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      const sprint = await prisma.sprint.findFirst({
        where: { id: sprintId, projectId: project.id },
        include: {
          issueResults: {
            include: {
              issue: {
                include: {
                  status: true,
                  assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
                },
              },
              targetSprint: { select: { id: true, name: true } },
            },
          },
          issues: {
            include: {
              status: true,
              assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
        },
      });

      if (!sprint) {
        res.status(404).json({ message: "Sprint tidak ditemukan pada project ini" });
        return;
      }

      // Fetch issue events for reporting & burndown
      const events = await prisma.issueEvent.findMany({
        where: { sprintId: sprint.id },
        orderBy: { createdAt: "asc" },
      });

      // If sprint is CLOSED: read from frozen SprintIssueResult
      if (sprint.state === "CLOSED" && sprint.issueResults.length > 0) {
        const miniBurndown = computeBurndown(events, sprint, "points");
        const completedList = sprint.issueResults
          .filter((r) => r.outcome === "COMPLETED")
          .map((r) => ({
            id: r.issue.id,
            key: r.issue.key,
            title: r.issue.title,
            type: r.issue.type,
            priority: r.issue.priority,
            storyPoints: r.pointsAtClose,
            status: r.issue.status,
            assignee: r.issue.assignee,
            addedMidSprint: r.addedMidSprint,
          }));

        const notCompletedList = sprint.issueResults
          .filter((r) => r.outcome !== "COMPLETED")
          .map((r) => ({
            id: r.issue.id,
            key: r.issue.key,
            title: r.issue.title,
            type: r.issue.type,
            priority: r.issue.priority,
            storyPoints: r.pointsAtClose,
            status: r.issue.status,
            assignee: r.issue.assignee,
            outcome: r.outcome,
            targetDestination: r.targetSprint ? r.targetSprint.name : "Backlog",
            addedMidSprint: r.addedMidSprint,
          }));

        const addedMidSprintList = sprint.issueResults
          .filter((r) => r.addedMidSprint)
          .map((r) => ({
            id: r.issue.id,
            key: r.issue.key,
            title: r.issue.title,
            type: r.issue.type,
            priority: r.issue.priority,
            storyPoints: r.pointsAtClose,
            status: r.issue.status,
            assignee: r.issue.assignee,
            outcome: r.outcome,
          }));

        const committedPoints = sprint.committedPoints ?? 0;
        const completedPoints = sprint.completedPoints ?? 0;
        const completionRate = committedPoints > 0 ? Math.round((completedPoints / committedPoints) * 100) : null;
        const carriedOverPoints = notCompletedList.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
        const scopeAddedPoints = addedMidSprintList.reduce((sum, i) => sum + (i.storyPoints || 0), 0);

        res.json({
          sprint: {
            id: sprint.id,
            name: sprint.name,
            goal: sprint.goal,
            state: sprint.state,
            startDate: sprint.startDate,
            endDate: sprint.endDate,
            startedAt: sprint.startedAt,
            closedAt: sprint.closedAt,
            retroNotes: sprint.retroNotes,
          },
          summary: {
            committedPoints,
            committedIssues: sprint.committedIssues ?? 0,
            completedPoints,
            completedIssues: sprint.completedIssues ?? 0,
            completionRate,
            scopeAddedPoints,
            scopeAddedIssues: addedMidSprintList.length,
            carriedOverPoints,
            carriedOverIssues: notCompletedList.length,
          },
          completedIssues: completedList,
          notCompletedIssues: notCompletedList,
          addedMidSprintIssues: addedMidSprintList,
          miniBurndown,
          isPreview: false,
        });
        return;
      }

      // Live Preview for ACTIVE or FUTURE sprint
      const eligibleIssues = sprint.issues.filter((i) => isEligibleForReporting(i.type));

      const metrics = computeAgileSprintMetrics({
        sprint,
        events,
        eligibleIssues,
        metric: "points",
      });

      const {
        summary,
        completedIssuesList: completed,
        notCompletedIssuesList: notCompleted,
        addedMidSprintIssuesList: addedMidSprint,
        removedFromSprintIssuesList,
        isIssueAddedMidSprint,
      } = metrics;

      // Query metadata for removed issues if any
      const removedIssueIds = removedFromSprintIssuesList.map((r) => r.issueId);
      const removedIssuesDb = removedIssueIds.length > 0
        ? await prisma.issue.findMany({
            where: { id: { in: removedIssueIds } },
            include: {
              status: true,
              assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          })
        : [];
      const removedIssuesDbMap = new Map(removedIssuesDb.map((i) => [i.id, i]));

      const removedFromSprintIssues = removedFromSprintIssuesList.map((r) => {
        const dbIssue = removedIssuesDbMap.get(r.issueId);
        return {
          id: r.issueId,
          key: dbIssue?.key ?? "",
          title: dbIssue?.title ?? "",
          type: dbIssue?.type ?? "STORY",
          priority: dbIssue?.priority ?? "MEDIUM",
          storyPoints: r.storyPoints,
          status: dbIssue?.status ?? null,
          assignee: dbIssue?.assignee ?? null,
        };
      });

      const miniBurndown: BurndownResult = {
        sprint: {
          id: sprint.id,
          name: sprint.name,
          state: sprint.state,
        },
        metric: "points",
        unestimated: metrics.unestimated,
        summary: {
          committed: summary.committed,
          completed: summary.completed,
          remaining: summary.remaining,
          scopeAdded: summary.scopeAdded,
          removed: summary.removed,
        },
        days: metrics.days,
      };

      res.json({
        sprint: {
          id: sprint.id,
          name: sprint.name,
          goal: sprint.goal,
          state: sprint.state,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          startedAt: sprint.startedAt,
          closedAt: sprint.closedAt,
          retroNotes: sprint.retroNotes,
        },
        summary: {
          committedPoints: summary.committedPoints,
          committedIssues: summary.committedIssues,
          completedPoints: summary.completedPoints,
          completedIssues: summary.completedIssues,
          completionRate: summary.completionRate,
          scopeAddedPoints: summary.scopeAddedPoints,
          scopeAddedIssues: summary.scopeAddedIssues,
          removedPoints: summary.removedPoints,
          removedIssues: summary.removedIssues,
          carriedOverPoints: summary.carriedOverPoints,
          carriedOverIssues: summary.carriedOverIssues,
        },
        completedIssues: completed.map((i) => ({
          id: i.id,
          key: i.key,
          title: i.title,
          type: i.type,
          priority: i.priority,
          storyPoints: i.storyPoints,
          status: i.status,
          assignee: i.assignee,
          addedMidSprint: isIssueAddedMidSprint(i.id),
        })),
        notCompletedIssues: notCompleted.map((i) => ({
          id: i.id,
          key: i.key,
          title: i.title,
          type: i.type,
          priority: i.priority,
          storyPoints: i.storyPoints,
          status: i.status,
          assignee: i.assignee,
          outcome: "IN_PROGRESS",
          targetDestination: "TBD on Close",
          addedMidSprint: isIssueAddedMidSprint(i.id),
        })),
        addedMidSprintIssues: addedMidSprint.map((i) => ({
          id: i.id,
          key: i.key,
          title: i.title,
          type: i.type,
          priority: i.priority,
          storyPoints: i.storyPoints,
          status: i.status,
          assignee: i.assignee,
          outcome: i.status.category === "DONE" ? "COMPLETED" : "IN_PROGRESS",
        })),
        removedFromSprintIssues,
        miniBurndown,
        isPreview: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/projects/:key/sprints/:id/retro - Save retrospective notes
router.patch(
  "/projects/:key/sprints/:id/retro",
  authenticateToken,
  requirePermission("issue:edit"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const project = await findProject(req.params.key);
      const sprintId = req.params.id;
      const body = retroNotesSchema.parse(req.body);

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      const sprint = await prisma.sprint.findFirst({
        where: { id: sprintId, projectId: project.id },
      });

      if (!sprint) {
        res.status(404).json({ message: "Sprint tidak ditemukan pada project ini" });
        return;
      }

      const updatedSprint = await prisma.sprint.update({
        where: { id: sprintId },
        data: {
          retroNotes: {
            good: body.good,
            toImprove: body.toImprove,
            actionItems: body.actionItems,
            updatedAt: new Date().toISOString(),
            updatedBy: req.user!.name,
          },
        },
      });

      res.json({
        message: "Catatan retrospektif berhasil disimpan",
        retroNotes: updatedSprint.retroNotes,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
