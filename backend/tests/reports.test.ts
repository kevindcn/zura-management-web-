import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { generateToken } from "../src/lib/jwt.js";

describe("Reports API Integration Tests (Burndown, Velocity, Sprint Report)", () => {
  let leadUser: any;
  let memberUser: any;
  let viewerUser: any;

  let leadToken: string;
  let memberToken: string;
  let viewerToken: string;

  let project: any;
  let todoStatus: any;
  let inProgressStatus: any;
  let doneStatus: any;

  let activeSprint: any;
  let closedSprint1: any;
  let closedSprint2: any;
  let closedSprint3: any;

  beforeAll(async () => {
    // 1. Create Users
    leadUser = await prisma.user.create({
      data: {
        name: "Report Lead",
        email: "reportlead@test.local",
        passwordHash: "hash123",
      },
    });

    memberUser = await prisma.user.create({
      data: {
        name: "Report Member",
        email: "reportmember@test.local",
        passwordHash: "hash123",
      },
    });

    viewerUser = await prisma.user.create({
      data: {
        name: "Report Viewer",
        email: "reportviewer@test.local",
        passwordHash: "hash123",
      },
    });

    leadToken = generateToken(leadUser);
    memberToken = generateToken(memberUser);
    viewerToken = generateToken(viewerUser);

    // 2. Create Project
    project = await prisma.project.create({
      data: {
        name: "Reporting Project",
        key: "REP",
        leadId: leadUser.id,
        statuses: {
          create: [
            { name: "To Do", category: "TO_DO", position: 1000 },
            { name: "In Progress", category: "IN_PROGRESS", position: 2000 },
            { name: "Done", category: "DONE", position: 3000 },
          ],
        },
        members: {
          create: [
            { userId: memberUser.id, role: "MEMBER" },
            { userId: viewerUser.id, role: "VIEWER" },
          ],
        },
      },
      include: { statuses: true },
    });

    todoStatus = project.statuses.find((s: any) => s.category === "TO_DO");
    inProgressStatus = project.statuses.find((s: any) => s.category === "IN_PROGRESS");
    doneStatus = project.statuses.find((s: any) => s.category === "DONE");

    // 3. Create 3 Closed Sprints for Velocity Testing
    closedSprint1 = await prisma.sprint.create({
      data: {
        name: "Sprint 1",
        state: "CLOSED",
        projectId: project.id,
        startDate: new Date("2026-10-01"),
        endDate: new Date("2026-10-14"),
        startedAt: new Date("2026-10-01"),
        closedAt: new Date("2026-10-14"),
        committedPoints: 20,
        committedIssues: 4,
        completedPoints: 18,
        completedIssues: 3,
      },
    });

    closedSprint2 = await prisma.sprint.create({
      data: {
        name: "Sprint 2",
        state: "CLOSED",
        projectId: project.id,
        startDate: new Date("2026-10-15"),
        endDate: new Date("2026-10-28"),
        startedAt: new Date("2026-10-15"),
        closedAt: new Date("2026-10-28"),
        committedPoints: 22,
        committedIssues: 5,
        completedPoints: 20,
        completedIssues: 4,
      },
    });

    closedSprint3 = await prisma.sprint.create({
      data: {
        name: "Sprint 3",
        state: "CLOSED",
        projectId: project.id,
        startDate: new Date("2026-10-29"),
        endDate: new Date("2026-11-11"),
        startedAt: new Date("2026-10-29"),
        closedAt: new Date("2026-11-11"),
        committedPoints: 25,
        committedIssues: 6,
        completedPoints: 22,
        completedIssues: 5,
      },
    });

    // 4. Create an Active Sprint with Issues
    activeSprint = await prisma.sprint.create({
      data: {
        name: "Sprint 4 (Active)",
        state: "ACTIVE",
        projectId: project.id,
        startDate: new Date("2026-11-12"),
        endDate: new Date("2026-11-25"),
        startedAt: new Date("2026-11-12"),
        committedPoints: 15,
        committedIssues: 3,
      },
    });

    // Create 3 issues in active sprint: 1 done (5 pts), 1 in progress (5 pts), 1 todo without points
    const issue1 = await prisma.issue.create({
      data: {
        key: "REP-1",
        number: 1,
        title: "Done Issue",
        type: "STORY",
        storyPoints: 5,
        statusId: doneStatus.id,
        projectId: project.id,
        reporterId: leadUser.id,
        sprintId: activeSprint.id,
      },
    });

    const issue2 = await prisma.issue.create({
      data: {
        key: "REP-2",
        number: 2,
        title: "In Progress Issue",
        type: "TASK",
        storyPoints: 5,
        statusId: inProgressStatus.id,
        projectId: project.id,
        reporterId: leadUser.id,
        sprintId: activeSprint.id,
      },
    });

    const issue3 = await prisma.issue.create({
      data: {
        key: "REP-3",
        number: 3,
        title: "Unestimated Issue",
        type: "BUG",
        storyPoints: null,
        statusId: todoStatus.id,
        projectId: project.id,
        reporterId: leadUser.id,
        sprintId: activeSprint.id,
      },
    });

    // Record initial events
    await prisma.issueEvent.createMany({
      data: [
        {
          issueId: issue1.id,
          sprintId: activeSprint.id,
          eventType: "ADDED_TO_SPRINT",
          points: 5,
          category: "TO_DO",
          createdAt: new Date("2026-11-12T08:00:00Z"),
        },
        {
          issueId: issue1.id,
          sprintId: activeSprint.id,
          eventType: "STATUS_CHANGED",
          category: "DONE",
          previousCategory: "TO_DO",
          createdAt: new Date("2026-11-13T10:00:00Z"),
        },
        {
          issueId: issue2.id,
          sprintId: activeSprint.id,
          eventType: "ADDED_TO_SPRINT",
          points: 5,
          category: "TO_DO",
          createdAt: new Date("2026-11-12T08:00:00Z"),
        },
        {
          issueId: issue3.id,
          sprintId: activeSprint.id,
          eventType: "ADDED_TO_SPRINT",
          points: null,
          category: "TO_DO",
          createdAt: new Date("2026-11-12T08:00:00Z"),
        },
      ],
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (project) {
      await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
    }
    await prisma.user.deleteMany({
      where: { id: { in: [leadUser?.id, memberUser?.id, viewerUser?.id].filter(Boolean) } },
    }).catch(() => {});
  });

  describe("Velocity Endpoint", () => {
    it("returns closed sprints, average velocity, and recommended capacity", async () => {
      const res = await request(app)
        .get(`/api/projects/${project.key}/reports/velocity?sprints=6`)
        .set("Authorization", `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.sprints.length).toBe(3);
      // Completed: 18, 20, 22 -> Avg = 20
      expect(res.body.averageVelocity).toBe(20);
      expect(res.body.recommendedCapacity).toBe(20);
      expect(res.body.insufficientData).toBe(false);
    });

    it("allows VIEWER role to access velocity report", async () => {
      const res = await request(app)
        .get(`/api/projects/${project.key}/reports/velocity`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.sprints.length).toBe(3);
    });
  });

  describe("Burndown Endpoint", () => {
    it("returns daily metrics, summary, and unestimated count", async () => {
      const res = await request(app)
        .get(`/api/projects/${project.key}/sprints/${activeSprint.id}/burndown?metric=points`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.sprint.id).toBe(activeSprint.id);
      expect(res.body.metric).toBe("points");
      expect(res.body.unestimated).toBe(1); // REP-3 has null points
      expect(res.body.days).toBeDefined();
      expect(res.body.days.length).toBeGreaterThan(0);
      expect(res.body.summary).toBeDefined();
    });

    it("supports metric=issues query parameter", async () => {
      const res = await request(app)
        .get(`/api/projects/${project.key}/sprints/${activeSprint.id}/burndown?metric=issues`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.metric).toBe("issues");
    });
  });

  describe("Sprint Report Endpoint & Complete Sprint", () => {
    it("returns live preview report for active sprint", async () => {
      const res = await request(app)
        .get(`/api/projects/${project.key}/sprints/${activeSprint.id}/report`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isPreview).toBe(true);
      expect(res.body.completedIssues.length).toBe(1);
      expect(res.body.notCompletedIssues.length).toBe(2);
      expect(res.body.miniBurndown).toBeDefined();
    });

    it("allows admin to complete sprint with atomic rollover to backlog", async () => {
      const res = await request(app)
        .post(`/api/projects/${project.key}/sprints/${activeSprint.id}/complete`)
        .set("Authorization", `Bearer ${leadToken}`)
        .send({ targetSprintId: null }); // rollover to backlog

      expect(res.status).toBe(200);
      expect(res.body.sprint.state).toBe("CLOSED");
      expect(res.body.sprint.completedPoints).toBe(5);
      expect(res.body.sprint.completedIssues).toBe(1);

      // Verify incomplete issues were moved to backlog (sprintId is null)
      const incompleteIssue = await prisma.issue.findUnique({ where: { key: "REP-2" } });
      expect(incompleteIssue?.sprintId).toBeNull();

      // Verify SprintIssueResults were recorded
      const results = await prisma.sprintIssueResult.findMany({ where: { sprintId: activeSprint.id } });
      expect(results.length).toBe(3);

      const doneResult = results.find((r) => r.issueId === incompleteIssue?.id);
      expect(doneResult?.outcome).toBe("RETURNED_TO_BACKLOG");
    });

    it("returns frozen historical report after sprint is CLOSED", async () => {
      const res = await request(app)
        .get(`/api/projects/${project.key}/sprints/${activeSprint.id}/report`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isPreview).toBe(false);
      expect(res.body.summary.completedPoints).toBe(5);
      expect(res.body.summary.completedIssues).toBe(1);
      expect(res.body.completedIssues.length).toBe(1);
      expect(res.body.notCompletedIssues.length).toBe(2);
    });
  });

  describe("Retrospective Notes", () => {
    it("allows member and admin to save retro notes", async () => {
      const res = await request(app)
        .patch(`/api/projects/${project.key}/sprints/${activeSprint.id}/retro`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          good: "Good teamwork on backend APIs",
          toImprove: "Need better point estimation",
          actionItems: "Hold estimation session before sprint start",
        });

      expect(res.status).toBe(200);
      expect(res.body.retroNotes.good).toBe("Good teamwork on backend APIs");
      expect(res.body.retroNotes.actionItems).toBe("Hold estimation session before sprint start");
    });

    it("forbids VIEWER from editing retro notes (403)", async () => {
      const res = await request(app)
        .patch(`/api/projects/${project.key}/sprints/${activeSprint.id}/retro`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ good: "Viewer trying to edit" });

      expect(res.status).toBe(403);
    });
  });

  describe("Reporting Single Source of Truth & Boundary Tests", () => {
    it("ensures Asia/Jakarta midnight boundary is identical across /burndown and /report: 16:59:59Z is committed, 17:00:00Z is scope added", async () => {
      // Sprint started 2 days ago (2026-10-29 in WIB) so burndown evaluates days up to today
      const boundarySprint = await prisma.sprint.create({
        data: {
          name: "Boundary Sprint",
          state: "ACTIVE",
          projectId: project.id,
          startDate: new Date("2026-10-29T00:00:00Z"),
          endDate: new Date("2026-11-12T23:59:59Z"),
          startedAt: null,
          committedPoints: 0,
          committedIssues: 0,
        },
      });

      const bIssue1 = await prisma.issue.create({
        data: {
          key: "REP-B1",
          number: 101,
          title: "Committed at 23:59:59 WIB",
          type: "STORY",
          storyPoints: 3,
          statusId: todoStatus.id,
          reporterId: leadUser.id,
          projectId: project.id,
          sprintId: boundarySprint.id,
        },
      });

      const bIssue2 = await prisma.issue.create({
        data: {
          key: "REP-B2",
          number: 102,
          title: "Scope added at 00:00:00 WIB",
          type: "TASK",
          storyPoints: 5,
          statusId: todoStatus.id,
          reporterId: leadUser.id,
          projectId: project.id,
          sprintId: boundarySprint.id,
        },
      });

      // 16:59:59Z is 23:59:59 WIB (Day 1 in Asia/Jakarta)
      await prisma.issueEvent.create({
        data: {
          issueId: bIssue1.id,
          sprintId: boundarySprint.id,
          eventType: "ADDED_TO_SPRINT",
          points: 3,
          category: "TO_DO",
          createdAt: new Date("2026-10-29T16:59:59.000Z"),
        },
      });

      // 17:00:00Z is 00:00:00 WIB next day (Day 2 in Asia/Jakarta)
      await prisma.issueEvent.create({
        data: {
          issueId: bIssue2.id,
          sprintId: boundarySprint.id,
          eventType: "ADDED_TO_SPRINT",
          points: 5,
          category: "TO_DO",
          createdAt: new Date("2026-10-29T17:00:00.000Z"),
        },
      });

      // Query both endpoints
      const burndownRes = await request(app)
        .get(`/api/projects/${project.key}/sprints/${boundarySprint.id}/burndown?metric=points`)
        .set("Authorization", `Bearer ${memberToken}`);

      const reportRes = await request(app)
        .get(`/api/projects/${project.key}/sprints/${boundarySprint.id}/report`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(burndownRes.status).toBe(200);
      expect(reportRes.status).toBe(200);

      // Both must agree 100%: 3 committed, 5 scope added, 8 remaining
      expect(burndownRes.body.summary.committed).toBe(3);
      expect(reportRes.body.summary.committedPoints).toBe(3);
      expect(reportRes.body.summary.committedIssues).toBe(1);

      expect(burndownRes.body.summary.scopeAdded).toBe(5);
      expect(reportRes.body.summary.scopeAddedPoints).toBe(5);
      expect(reportRes.body.summary.scopeAddedIssues).toBe(1);

      expect(burndownRes.body.summary.remaining).toBe(8);
      expect(reportRes.body.summary.carriedOverPoints).toBe(8);
      expect(reportRes.body.summary.carriedOverIssues).toBe(2);
    });

    it("ensures active sprint with snapshot committedPoints > 0 matches across both endpoints", async () => {
      // Sprint started 2 days ago (2026-10-29 in WIB) with 10 committed points
      const snapSprint = await prisma.sprint.create({
        data: {
          name: "Snapshot Sprint",
          state: "ACTIVE",
          projectId: project.id,
          startDate: new Date("2026-10-29T00:00:00Z"),
          endDate: new Date("2026-11-12T23:59:59Z"),
          startedAt: new Date("2026-10-29T08:00:00Z"),
          committedPoints: 10,
          committedIssues: 2,
        },
      });

      const sIssue1 = await prisma.issue.create({
        data: {
          key: "REP-S1",
          number: 201,
          title: "Initial issue 1",
          type: "STORY",
          storyPoints: 5,
          statusId: doneStatus.id,
          reporterId: leadUser.id,
          projectId: project.id,
          sprintId: snapSprint.id,
        },
      });

      const sIssue2 = await prisma.issue.create({
        data: {
          key: "REP-S2",
          number: 202,
          title: "Initial issue 2",
          type: "STORY",
          storyPoints: 5,
          statusId: todoStatus.id,
          reporterId: leadUser.id,
          projectId: project.id,
          sprintId: snapSprint.id,
        },
      });

      // Events on day 1 (Oct 29) and day 2 (Oct 30)
      await prisma.issueEvent.createMany({
        data: [
          {
            issueId: sIssue1.id,
            sprintId: snapSprint.id,
            eventType: "ADDED_TO_SPRINT",
            points: 5,
            category: "TO_DO",
            createdAt: new Date("2026-10-29T08:00:00Z"),
          },
          {
            issueId: sIssue2.id,
            sprintId: snapSprint.id,
            eventType: "ADDED_TO_SPRINT",
            points: 5,
            category: "TO_DO",
            createdAt: new Date("2026-10-29T08:00:00Z"),
          },
          {
            issueId: sIssue1.id,
            sprintId: snapSprint.id,
            eventType: "STATUS_CHANGED",
            category: "DONE",
            previousCategory: "TO_DO",
            createdAt: new Date("2026-10-30T08:00:00Z"),
          },
        ],
      });

      const burndownRes = await request(app)
        .get(`/api/projects/${project.key}/sprints/${snapSprint.id}/burndown?metric=points`)
        .set("Authorization", `Bearer ${memberToken}`);

      const reportRes = await request(app)
        .get(`/api/projects/${project.key}/sprints/${snapSprint.id}/report`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(burndownRes.body.summary.committed).toBe(10);
      expect(reportRes.body.summary.committedPoints).toBe(10);
      expect(burndownRes.body.summary.completed).toBe(5);
      expect(reportRes.body.summary.completedPoints).toBe(5);
      expect(burndownRes.body.summary.remaining).toBe(5);
      expect(reportRes.body.summary.carriedOverPoints).toBe(5);
      expect(burndownRes.body.summary.scopeAdded).toBe(0);
      expect(reportRes.body.summary.scopeAddedPoints).toBe(0);
    });

    it("verifies CLOSED sprint immutability: late events after close do not alter report snapshot", async () => {
      // activeSprint was completed in previous test: has frozen SprintIssueResults
      const reportBefore = await request(app)
        .get(`/api/projects/${project.key}/sprints/${activeSprint.id}/report`)
        .set("Authorization", `Bearer ${viewerToken}`);

      // angka tiruan lama (sebelumnya 15, nilai riil tiket adalah 10)
      expect(reportBefore.body.summary.committedPoints).toBe(10);
      expect(reportBefore.body.summary.completedPoints).toBe(5);
      const originalScopeAdded = reportBefore.body.summary.scopeAddedPoints;

      // Inject a rogue event dated after sprint closed
      const rogueIssue = await prisma.issue.create({
        data: {
          key: "REP-ROGUE",
          number: 999,
          title: "Rogue late issue",
          type: "STORY",
          storyPoints: 13,
          statusId: todoStatus.id,
          reporterId: leadUser.id,
          projectId: project.id,
        },
      });

      await prisma.issueEvent.create({
        data: {
          issueId: rogueIssue.id,
          sprintId: activeSprint.id,
          eventType: "ADDED_TO_SPRINT",
          points: 13,
          category: "TO_DO",
          createdAt: new Date("2026-12-01T12:00:00Z"), // well after closedAt
        },
      });

      // Verify report remains strictly immutable: committed, completed, and scopeAdded are unchanged
      const reportAfter = await request(app)
        .get(`/api/projects/${project.key}/sprints/${activeSprint.id}/report`)
        .set("Authorization", `Bearer ${viewerToken}`);

      // angka tiruan lama (sebelumnya 15, nilai riil tiket adalah 10)
      expect(reportAfter.body.summary.committedPoints).toBe(10);
      expect(reportAfter.body.summary.completedPoints).toBe(5);
      expect(reportAfter.body.summary.scopeAddedPoints).toBe(originalScopeAdded);
    });

    it("documents auto-backfill behavior when startDate is earlier than createdAt", async () => {
      // Sprint created at 2026-10-25 with backdated startDate at 2026-10-20 (startedAt null)
      const backdatedSprint = await prisma.sprint.create({
        data: {
          name: "Backdated Sprint",
          state: "ACTIVE",
          projectId: project.id,
          startDate: new Date("2026-10-20T00:00:00Z"),
          endDate: new Date("2026-11-03T00:00:00Z"),
          startedAt: null,
          createdAt: new Date("2026-10-25T10:00:00Z"),
          committedPoints: 0,
          committedIssues: 0,
        },
      });

      await prisma.issue.create({
        data: {
          key: "REP-BACKDATED",
          number: 301,
          title: "Backfilled issue",
          type: "TASK",
          storyPoints: 4,
          statusId: todoStatus.id,
          reporterId: leadUser.id,
          projectId: project.id,
          sprintId: backdatedSprint.id,
        },
      });

      // Trigger auto-backfill via /burndown
      await request(app)
        .get(`/api/projects/${project.key}/sprints/${backdatedSprint.id}/burndown`)
        .set("Authorization", `Bearer ${memberToken}`);

      // The backfilled event got createdAt = sprint.createdAt (2026-10-25).
      // Since 2026-10-25 > 2026-10-20 23:59:59.999 WIB, it is treated as scope added
      const reportRes = await request(app)
        .get(`/api/projects/${project.key}/sprints/${backdatedSprint.id}/report`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(reportRes.body.summary.scopeAddedPoints).toBe(4);
      expect(reportRes.body.summary.committedPoints).toBe(0);
    });
  });
});
