import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { generateToken } from "../src/lib/jwt.js";

describe("Notifications Integration Tests", () => {
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;
  let testProject: any;
  let testIssue: any;
  let todoStatus: any;
  let inProgressStatus: any;

  beforeAll(async () => {
    const runId = Math.floor(Math.random() * 899999 + 100000);
    const pKey = `N${runId.toString().slice(-3)}`;

    // 1. Create two test users
    userA = await prisma.user.create({
      data: {
        name: "User Alpha",
        email: `user_a_${runId}@test.local`,
        passwordHash: "hash123",
      },
    });

    userB = await prisma.user.create({
      data: {
        name: "User Beta",
        email: `user_b_${runId}@test.local`,
        passwordHash: "hash123",
      },
    });

    tokenA = generateToken(userA);
    tokenB = generateToken(userB);

    // 2. Create Project with both users as members
    testProject = await prisma.project.create({
      data: {
        name: `Notification Test Project ${runId}`,
        key: pKey,
        leadId: userA.id,
        issueCounter: 1,
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

    todoStatus = testProject.statuses.find((s: any) => s.category === "TO_DO");
    inProgressStatus = testProject.statuses.find((s: any) => s.category === "IN_PROGRESS");

    // 3. Create initial issue reported by userA, initially assigned to userA
    testIssue = await prisma.issue.create({
      data: {
        key: `${testProject.key}-1`,
        number: 1,
        title: "Test Notification Work Item",
        projectId: testProject.id,
        statusId: todoStatus.id,
        reporterId: userA.id,
        assigneeId: userA.id,
      },
    });
  });

  it("rejects unauthenticated requests to notifications endpoint with 401", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });

  it("does not create a notification for self-assigned actions", async () => {
    // User A creating an issue assigned to User A
    await request(app)
      .post(`/api/projects/${testProject.key}/issues`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        title: "Self assigned issue",
        assigneeId: userA.id,
      });

    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    // User A should have 0 notifications from self-assignment
    expect(res.body.notifications.length).toBe(0);
    expect(res.body.unreadCount).toBe(0);
  });

  it("creates an ASSIGNED notification for User B when User A assigns an issue to User B", async () => {
    const res = await request(app)
      .patch(`/api/issues/${testIssue.key}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        assigneeId: userB.id,
      });

    expect(res.status).toBe(200);

    // Check User B's notifications
    const notifRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(notifRes.status).toBe(200);
    expect(notifRes.body.unreadCount).toBeGreaterThanOrEqual(1);

    const assignedNotif = notifRes.body.notifications.find(
      (n: any) => n.type === "ASSIGNED" && n.issueKey === testIssue.key
    );
    expect(assignedNotif).toBeDefined();
    expect(assignedNotif.actorName).toBe("User Alpha");
    expect(assignedNotif.isRead).toBe(false);
  });

  it("creates a COMMENT notification for User B when User A comments on an assigned issue", async () => {
    const res = await request(app)
      .post(`/api/issues/${testIssue.key}/comments`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        body: "Tolong segera dicek ya PR nya",
      });

    expect(res.status).toBe(201);

    // Check User B's notifications
    const notifRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(notifRes.status).toBe(200);
    const commentNotif = notifRes.body.notifications.find(
      (n: any) => n.type === "COMMENT" && n.issueKey === testIssue.key
    );
    expect(commentNotif).toBeDefined();
    expect(commentNotif.message).toContain("Tolong segera dicek ya");
  });

  it("creates a STATUS_CHANGED notification when User A moves the issue", async () => {
    const res = await request(app)
      .patch(`/api/issues/${testIssue.key}/move`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        statusId: inProgressStatus.id,
        position: 1500,
      });

    expect(res.status).toBe(200);

    const notifRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(notifRes.status).toBe(200);
    const statusNotif = notifRes.body.notifications.find(
      (n: any) => n.type === "STATUS_CHANGED" && n.issueKey === testIssue.key
    );
    expect(statusNotif).toBeDefined();
    expect(statusNotif.message).toContain("In Progress");
  });

  it("allows marking a single notification as read", async () => {
    const listRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${tokenB}`);

    const targetNotif = listRes.body.notifications[0];
    expect(targetNotif).toBeDefined();

    const patchRes = await request(app)
      .patch(`/api/notifications/${targetNotif.id}/read`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.notification.isRead).toBe(true);
  });

  it("prevents IDOR: User A cannot mark User B's notification as read", async () => {
    const listRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${tokenB}`);

    const targetNotif = listRes.body.notifications[0];

    const patchRes = await request(app)
      .patch(`/api/notifications/${targetNotif.id}/read`)
      .set("Authorization", `Bearer ${tokenA}`); // User A trying to mark User B's notif

    expect(patchRes.status).toBe(404);
  });

  it("allows marking all notifications as read at once", async () => {
    const markAllRes = await request(app)
      .post("/api/notifications/mark-all-read")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(markAllRes.status).toBe(200);
    expect(markAllRes.body.success).toBe(true);

    const listRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(listRes.body.unreadCount).toBe(0);
    expect(listRes.body.notifications.every((n: any) => n.isRead === true)).toBe(true);
  });
});
