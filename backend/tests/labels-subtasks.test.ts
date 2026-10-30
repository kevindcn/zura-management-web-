import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { generateToken } from "../src/lib/jwt.js";

describe("Labels and Subtasks Integration Tests", () => {
  let adminUser: any;
  let viewerUser: any;
  let adminToken: string;
  let viewerToken: string;
  let testProject: any;
  let parentIssue: any;

  beforeAll(async () => {
    const timestamp = Date.now();
    // 1. Create users
    adminUser = await prisma.user.create({
      data: {
        name: "Admin User",
        email: `admin_labels_${timestamp}@test.local`,
        passwordHash: "hash123",
      },
    });

    viewerUser = await prisma.user.create({
      data: {
        name: "Viewer User",
        email: `viewer_labels_${timestamp}@test.local`,
        passwordHash: "hash123",
      },
    });

    adminToken = generateToken(adminUser);
    viewerToken = generateToken(viewerUser);

    // 2. Create Project
    await prisma.project.deleteMany({ where: { key: "LBL" } });
    testProject = await prisma.project.create({
      data: {
        name: "Label Test Project",
        key: "LBL",
        leadId: adminUser.id,
        issueCounter: 1,
        statuses: {
          create: [
            { name: "To Do", category: "TO_DO", position: 1000 },
            { name: "Done", category: "DONE", position: 2000 },
          ],
        },
        members: {
          create: [
            { userId: adminUser.id, role: "ADMIN" },
            { userId: viewerUser.id, role: "VIEWER" },
          ],
        },
      },
      include: { statuses: true },
    });

    // 3. Create Parent Issue
    parentIssue = await prisma.issue.create({
      data: {
        key: "LBL-1",
        number: 1,
        title: "Parent Feature Task",
        type: "STORY",
        priority: "HIGH",
        position: 1000,
        statusId: testProject.statuses[0].id,
        projectId: testProject.id,
        reporterId: adminUser.id,
      },
    });
  });

  describe("Labels API", () => {
    it("should allow ADMIN to create a label in the project", async () => {
      const res = await request(app)
        .post(`/api/projects/${testProject.key}/labels`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Frontend",
          color: "#0C66E4",
        });

      expect(res.status).toBe(201);
      expect(res.body.label).toBeDefined();
      expect(res.body.label.name).toBe("Frontend");
      expect(res.body.label.color).toBe("#0C66E4");
    });

    it("should reject VIEWER from creating a label", async () => {
      const res = await request(app)
        .post(`/api/projects/${testProject.key}/labels`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({
          name: "HackerLabel",
        });

      expect(res.status).toBe(403);
    });

    it("should list all labels in the project", async () => {
      const res = await request(app)
        .get(`/api/projects/${testProject.key}/labels`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.labels)).toBe(true);
      expect(res.body.labels.some((l: any) => l.name === "Frontend")).toBe(true);
    });

    it("should associate labels to an issue via PATCH /api/issues/:key", async () => {
      const res = await request(app)
        .patch(`/api/issues/${parentIssue.key}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          labels: ["Frontend", "Design"],
        });

      expect(res.status).toBe(200);
      expect(res.body.issue.labels).toBeDefined();
      expect(res.body.issue.labels.length).toBe(2);
      expect(res.body.issue.labels.map((l: any) => l.name).sort()).toEqual(["Design", "Frontend"]);
    });
  });

  describe("Subtasks API", () => {
    let createdSubtaskKey: string;

    it("should allow creating a subtask under a parent issue", async () => {
      const res = await request(app)
        .post(`/api/issues/${parentIssue.key}/subtasks`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Subtask 1: Setup React Component",
          priority: "MEDIUM",
        });

      expect(res.status).toBe(201);
      expect(res.body.subtask).toBeDefined();
      expect(res.body.subtask.type).toBe("SUBTASK");
      expect(res.body.subtask.parentId).toBe(parentIssue.id);
      expect(res.body.subtask.parent.key).toBe(parentIssue.key);

      createdSubtaskKey = res.body.subtask.key;
    });

    it("should reject creating a subtask under an existing subtask (no nested subtasks)", async () => {
      const res = await request(app)
        .post(`/api/issues/${createdSubtaskKey}/subtasks`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Nested Subtask - Should Fail",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("tidak boleh ada subtask bersarang");
    });

    it("should fetch children subtasks when fetching parent issue details", async () => {
      const res = await request(app)
        .get(`/api/issues/${parentIssue.key}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.issue.children).toBeDefined();
      expect(res.body.issue.children.length).toBe(1);
      expect(res.body.issue.children[0].key).toBe(createdSubtaskKey);
      expect(res.body.issue.labels).toBeDefined();
      expect(res.body.issue.labels.length).toBe(2);
    });
  });

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { key: "LBL" } });
  });
});
