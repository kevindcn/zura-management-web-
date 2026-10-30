import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { generateToken } from "../src/lib/jwt.js";

describe("P1 Features: Saved Views, Watchers, and Pagination", () => {
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;
  let testProject: any;
  let todoStatus: any;
  let inProgressStatus: any;
  let issue1: any;
  let issue2: any;
  let issue3: any;

  beforeAll(async () => {
    const runId = Math.floor(Math.random() * 899999 + 100000);
    const pKey = `P${runId.toString().slice(-3)}`;

    userA = await prisma.user.create({
      data: {
        name: "Alice Lead",
        email: `alice_${runId}@test.local`,
        passwordHash: "hash123",
      },
    });

    userB = await prisma.user.create({
      data: {
        name: "Bob Dev",
        email: `bob_${runId}@test.local`,
        passwordHash: "hash123",
      },
    });

    tokenA = generateToken(userA);
    tokenB = generateToken(userB);

    testProject = await prisma.project.create({
      data: {
        name: `P1 Test Project ${runId}`,
        key: pKey,
        leadId: userA.id,
        issueCounter: 3,
        statuses: {
          create: [
            { name: "To Do", category: "TO_DO", position: 1000 },
            { name: "In Progress", category: "IN_PROGRESS", position: 2000 },
            { name: "Done", category: "DONE", position: 3000 },
          ],
        },
        members: {
          create: [
            { userId: userA.id, role: "ADMIN" },
            { userId: userB.id, role: "MEMBER" },
          ],
        },
      },
      include: { statuses: true },
    });

    todoStatus = testProject.statuses.find((s: any) => s.name === "To Do");
    inProgressStatus = testProject.statuses.find((s: any) => s.name === "In Progress");

    // Create 3 test issues
    issue1 = await prisma.issue.create({
      data: {
        key: `${pKey}-1`,
        number: 1,
        title: "Database schema migration issue",
        type: "BUG",
        priority: "HIGH",
        statusId: todoStatus.id,
        projectId: testProject.id,
        reporterId: userA.id,
        assigneeId: userB.id,
        position: 1000,
      },
    });

    issue2 = await prisma.issue.create({
      data: {
        key: `${pKey}-2`,
        number: 2,
        title: "Frontend list view redesign",
        type: "STORY",
        priority: "MEDIUM",
        statusId: inProgressStatus.id,
        projectId: testProject.id,
        reporterId: userB.id,
        assigneeId: userA.id,
        position: 2000,
      },
    });

    issue3 = await prisma.issue.create({
      data: {
        key: `${pKey}-3`,
        number: 3,
        title: "API rate limiting configuration",
        type: "TASK",
        priority: "LOWEST",
        statusId: todoStatus.id,
        projectId: testProject.id,
        reporterId: userA.id,
        position: 3000,
      },
    });
  });

  describe("1. Saved Views (Favorite Filters)", () => {
    let savedViewId: string;

    it("creates a saved view for user A", async () => {
      const res = await request(app)
        .post(`/api/projects/${testProject.key}/saved-views`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          name: "Bug Penting Milik Saya",
          type: "BUG",
          priority: "HIGH",
          isShared: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.savedView).toBeDefined();
      expect(res.body.savedView.name).toBe("Bug Penting Milik Saya");
      expect(res.body.savedView.type).toBe("BUG");
      expect(res.body.savedView.userId).toBe(userA.id);
      savedViewId = res.body.savedView.id;
    });

    it("lists saved views for user A", async () => {
      const res = await request(app)
        .get(`/api/projects/${testProject.key}/saved-views`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.savedViews)).toBe(true);
      const found = res.body.savedViews.find((sv: any) => sv.id === savedViewId);
      expect(found).toBeDefined();
    });

    it("does not leak private saved views to user B", async () => {
      const res = await request(app)
        .get(`/api/projects/${testProject.key}/saved-views`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      const found = res.body.savedViews.find((sv: any) => sv.id === savedViewId);
      expect(found).toBeUndefined();
    });

    it("creates and shares a saved view with project", async () => {
      const res = await request(app)
        .post(`/api/projects/${testProject.key}/saved-views`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          name: "Sprint Shared Filter",
          type: "ALL",
          isShared: true,
        });

      expect(res.status).toBe(201);
      const sharedId = res.body.savedView.id;

      // User B can see shared view
      const resB = await request(app)
        .get(`/api/projects/${testProject.key}/saved-views`)
        .set("Authorization", `Bearer ${tokenB}`);

      const found = resB.body.savedViews.find((sv: any) => sv.id === sharedId);
      expect(found).toBeDefined();
      expect(found.isShared).toBe(true);
    });

    it("allows owner to delete their saved view", async () => {
      const res = await request(app)
        .delete(`/api/saved-views/${savedViewId}`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);

      // Verify deletion
      const checkRes = await request(app)
        .get(`/api/projects/${testProject.key}/saved-views`)
        .set("Authorization", `Bearer ${tokenA}`);
      const found = checkRes.body.savedViews.find((sv: any) => sv.id === savedViewId);
      expect(found).toBeUndefined();
    });
  });

  describe("2. Watcher / Follower", () => {
    it("toggles watching on an issue", async () => {
      // User B follows issue 1
      const res1 = await request(app)
        .post(`/api/issues/${issue1.key}/watch`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res1.status).toBe(200);
      expect(res1.body.isWatching).toBe(true);
      expect(res1.body.watcherCount).toBe(1);

      // Verify in issue detail
      const detailRes = await request(app)
        .get(`/api/issues/${issue1.key}`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.issue.isWatching).toBe(true);
      expect(detailRes.body.issue.watcherCount).toBe(1);

      // List watchers endpoint
      const watchersRes = await request(app)
        .get(`/api/issues/${issue1.key}/watchers`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(watchersRes.status).toBe(200);
      expect(watchersRes.body.watcherCount).toBe(1);
      expect(watchersRes.body.watchers[0].id).toBe(userB.id);
    });

    it("notifies watchers when someone comments on the issue", async () => {
      // User A (not watcher, author) posts a comment on issue 1
      const commentRes = await request(app)
        .post(`/api/issues/${issue1.key}/comments`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ body: "Checking on database migration status." });

      expect(commentRes.status).toBe(201);

      // Check User B's notifications (User B is watcher & assignee)
      const notifRes = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${tokenB}`);

      expect(notifRes.status).toBe(200);
      const foundNotif = notifRes.body.notifications.find(
        (n: any) => n.issueKey === issue1.key && n.type === "COMMENT"
      );
      expect(foundNotif).toBeDefined();
    });

    it("toggles unwatch when called again", async () => {
      const res = await request(app)
        .post(`/api/issues/${issue1.key}/watch`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.isWatching).toBe(false);
      expect(res.body.watcherCount).toBe(0);
    });
  });

  describe("3. Pagination (Memuat Bertahap)", () => {
    it("returns paginated issues with metadata when limit is specified", async () => {
      const res = await request(app)
        .get(`/api/projects/${testProject.key}/issues?page=1&limit=2`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.totalPages).toBe(2);
      expect(res.body.pagination.hasMore).toBe(true);
    });

    it("fetches the second page of issues", async () => {
      const res = await request(app)
        .get(`/api/projects/${testProject.key}/issues?page=2&limit=2`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(1);
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.hasMore).toBe(false);
    });

    it("returns all issues when pagination parameters are not specified (backward compatibility)", async () => {
      const res = await request(app)
        .get(`/api/projects/${testProject.key}/issues`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(3);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.hasMore).toBe(false);
    });
  });
});
