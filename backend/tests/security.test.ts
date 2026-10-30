import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { generateToken } from "../src/lib/jwt.js";

describe("Backend Security and Permissions Integration Tests", () => {
  let leadUser: any;
  let adminUser: any;
  let memberUser1: any;
  let memberUser2: any;
  let viewerUser: any;
  let outsiderUser: any;

  let leadToken: string;
  let adminToken: string;
  let member1Token: string;
  let member2Token: string;
  let viewerToken: string;
  let outsiderToken: string;

  let testProject: any;
  let testStatus: any;
  let member1Issue: any;
  let member1Comment: any;

  beforeAll(async () => {
    // Clean up test data if any from previous run
    await prisma.activity.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.issue.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.status.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({});

    // 1. Create Test Users
    leadUser = await prisma.user.create({
      data: {
        name: "Test Lead",
        email: "lead@test.local",
        passwordHash: "hash123",
      },
    });

    adminUser = await prisma.user.create({
      data: {
        name: "Test Admin",
        email: "admin@test.local",
        passwordHash: "hash123",
      },
    });

    memberUser1 = await prisma.user.create({
      data: {
        name: "Member One",
        email: "member1@test.local",
        passwordHash: "hash123",
      },
    });

    memberUser2 = await prisma.user.create({
      data: {
        name: "Member Two",
        email: "member2@test.local",
        passwordHash: "hash123",
      },
    });

    viewerUser = await prisma.user.create({
      data: {
        name: "Test Viewer",
        email: "viewer@test.local",
        passwordHash: "hash123",
      },
    });

    outsiderUser = await prisma.user.create({
      data: {
        name: "Test Outsider",
        email: "outsider@test.local",
        passwordHash: "hash123",
      },
    });

    // Generate tokens
    leadToken = generateToken({ id: leadUser.id, email: leadUser.email, name: leadUser.name });
    adminToken = generateToken({ id: adminUser.id, email: adminUser.email, name: adminUser.name });
    member1Token = generateToken({ id: memberUser1.id, email: memberUser1.email, name: memberUser1.name });
    member2Token = generateToken({ id: memberUser2.id, email: memberUser2.email, name: memberUser2.name });
    viewerToken = generateToken({ id: viewerUser.id, email: viewerUser.email, name: viewerUser.name });
    outsiderToken = generateToken({ id: outsiderUser.id, email: outsiderUser.email, name: outsiderUser.name });

    // 2. Create Project with Lead and Members
    testProject = await prisma.project.create({
      data: {
        name: "Security Test Project",
        key: "SEC",
        leadId: leadUser.id,
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
            { userId: leadUser.id, role: "ADMIN" },
            { userId: adminUser.id, role: "ADMIN" },
            { userId: memberUser1.id, role: "MEMBER" },
            { userId: memberUser2.id, role: "MEMBER" },
            { userId: viewerUser.id, role: "VIEWER" },
            // Note: outsiderUser is intentionally NOT added!
          ],
        },
      },
      include: {
        statuses: true,
      },
    });

    testStatus = testProject.statuses[0];

    // 3. Create an Issue reported by memberUser1
    member1Issue = await prisma.issue.create({
      data: {
        key: "SEC-1",
        number: 1,
        title: "Initial Test Work Item",
        projectId: testProject.id,
        statusId: testStatus.id,
        reporterId: memberUser1.id,
        position: 1000,
      },
    });

    // 4. Create a Comment authored by memberUser1
    member1Comment = await prisma.comment.create({
      data: {
        body: "Initial comment by Member 1",
        issueId: member1Issue.id,
        authorId: memberUser1.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("1. Non-Member Isolation (404 and No Auto-Join)", () => {
    it("returns 404 when non-member requests GET /api/projects/:key", async () => {
      const res = await request(app)
        .get(`/api/projects/${testProject.key}`)
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("tidak ditemukan");
    });

    it("does NOT auto-join non-member to project upon GET request", async () => {
      const membership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: testProject.id,
            userId: outsiderUser.id,
          },
        },
      });

      expect(membership).toBeNull();
    });

    it("returns 404 when non-member requests issues list GET /api/projects/:key/issues", async () => {
      const res = await request(app)
        .get(`/api/projects/${testProject.key}/issues`)
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 404 when non-member requests issue detail GET /api/issues/:key", async () => {
      const res = await request(app)
        .get(`/api/issues/${member1Issue.key}`)
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 404 when non-member tries to post comment POST /api/issues/:key/comments", async () => {
      const res = await request(app)
        .post(`/api/issues/${member1Issue.key}/comments`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .send({ body: "Malicious outsider comment" });

      expect(res.status).toBe(404);
    });

    it("returns 404 when non-member tries to delete comment DELETE /api/comments/:id", async () => {
      const res = await request(app)
        .delete(`/api/comments/${member1Comment.id}`)
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("2. Viewer Restrictions (Read Only)", () => {
    it("allows Viewer to read project and issue details", async () => {
      const projRes = await request(app)
        .get(`/api/projects/${testProject.key}`)
        .set("Authorization", `Bearer ${viewerToken}`);
      expect(projRes.status).toBe(200);

      const issueRes = await request(app)
        .get(`/api/issues/${member1Issue.key}`)
        .set("Authorization", `Bearer ${viewerToken}`);
      expect(issueRes.status).toBe(200);
    });

    it("rejects Viewer from updating issue PATCH /api/issues/:key with 403", async () => {
      const res = await request(app)
        .patch(`/api/issues/${member1Issue.key}`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ title: "Viewer trying to edit" });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("VIEWER");
    });

    it("rejects Viewer from moving issue status PATCH /api/issues/:key/move with 403", async () => {
      const res = await request(app)
        .patch(`/api/issues/${member1Issue.key}/move`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ statusId: testProject.statuses[1].id, position: 2000 });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("VIEWER");
    });

    it("rejects Viewer from deleting issue DELETE /api/issues/:key with 403", async () => {
      const res = await request(app)
        .delete(`/api/issues/${member1Issue.key}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });

    it("rejects Viewer from posting comment POST /api/issues/:key/comments with 403", async () => {
      const res = await request(app)
        .post(`/api/issues/${member1Issue.key}/comments`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ body: "Viewer comment attempt" });

      expect(res.status).toBe(403);
    });
  });

  describe("3. Member Ownership Enforcement", () => {
    it("rejects Member 2 from deleting Member 1's work item with 403", async () => {
      const res = await request(app)
        .delete(`/api/issues/${member1Issue.key}`)
        .set("Authorization", `Bearer ${member2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("hanya memiliki izin untuk menghapus work item yang Anda buat sendiri");
    });

    it("rejects Member 2 from deleting Member 1's comment with 403", async () => {
      const res = await request(app)
        .delete(`/api/comments/${member1Comment.id}`)
        .set("Authorization", `Bearer ${member2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("hanya memiliki izin untuk menghapus komentar milik Anda sendiri");
    });

    it("allows Admin to delete any member's comment", async () => {
      const res = await request(app)
        .delete(`/api/comments/${member1Comment.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("successfully");
    });

    it("allows Member 1 to delete their own work item", async () => {
      // First create a new issue for Member 1 to delete
      const createdRes = await request(app)
        .post(`/api/projects/${testProject.key}/issues`)
        .set("Authorization", `Bearer ${member1Token}`)
        .send({ title: "Issue to be deleted by owner" });

      expect(createdRes.status).toBe(201);
      const newKey = createdRes.body.issue.key;

      const deleteRes = await request(app)
        .delete(`/api/issues/${newKey}`)
        .set("Authorization", `Bearer ${member1Token}`);

      expect(deleteRes.status).toBe(200);
    });
  });

  describe("4. Admin and Lead Membership Locks", () => {
    it("prevents removing the project lead", async () => {
      const res = await request(app)
        .delete(`/api/projects/${testProject.key}/members/${leadUser.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("lead");
    });

    it("prevents demoting the project lead", async () => {
      const res = await request(app)
        .patch(`/api/projects/${testProject.key}/members/${leadUser.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "MEMBER" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("ADMIN");
    });

    it("allows removing an admin when another admin remains", async () => {
      // Both leadUser and adminUser are currently ADMIN
      const res = await request(app)
        .delete(`/api/projects/${testProject.key}/members/${adminUser.id}`)
        .set("Authorization", `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
    });

    it("prevents removing the last remaining Admin", async () => {
      // Now only leadUser is ADMIN. Removing leadUser should fail.
      const res = await request(app)
        .delete(`/api/projects/${testProject.key}/members/${leadUser.id}`)
        .set("Authorization", `Bearer ${leadToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe("5. Zod Length Limits Validation", () => {
    it("rejects issue title longer than 255 characters", async () => {
      const longTitle = "A".repeat(256);
      const res = await request(app)
        .post(`/api/projects/${testProject.key}/issues`)
        .set("Authorization", `Bearer ${member1Token}`)
        .send({ title: longTitle });

      expect(res.status).toBe(400);
    });

    it("rejects comment body longer than 5000 characters", async () => {
      const longBody = "C".repeat(5001);
      const res = await request(app)
        .post(`/api/issues/${member1Issue.key}/comments`)
        .set("Authorization", `Bearer ${member1Token}`)
        .send({ body: longBody });

      expect(res.status).toBe(400);
    });
  });

  describe("6. Demo Login Security", () => {
    it("returns 404 when demo-login is disabled or in production", async () => {
      const prevEnv = process.env.DEMO_MODE;
      process.env.DEMO_MODE = "false";

      const res = await request(app).post("/api/auth/demo-login");
      expect(res.status).toBe(404);

      process.env.DEMO_MODE = prevEnv;
    });
  });

  describe("7. Project Deletion Lead-Only Enforcement (Temuan 7 Roadmap 06)", () => {
    it("rejects Member from deleting project DELETE /api/projects/:key with 403", async () => {
      const res = await request(app)
        .delete(`/api/projects/${testProject.key}`)
        .set("Authorization", `Bearer ${member1Token}`);

      expect(res.status).toBe(403);
    });

    it("rejects non-lead Admin from deleting project DELETE /api/projects/:key with 403", async () => {
      // Re-add adminUser as ADMIN to test non-lead admin deletion attempt
      await prisma.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId: testProject.id,
            userId: adminUser.id,
          },
        },
        create: {
          projectId: testProject.id,
          userId: adminUser.id,
          role: "ADMIN",
        },
        update: {
          role: "ADMIN",
        },
      });

      const res = await request(app)
        .delete(`/api/projects/${testProject.key}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Hanya pemilik project (lead)");
    });

    it("allows Project Lead to successfully delete the project", async () => {
      // Create a dedicated project to delete so other tests are not affected
      const toDeleteProject = await prisma.project.create({
        data: {
          name: "Project To Delete",
          key: "DELPRJ",
          leadId: leadUser.id,
          members: {
            create: [
              { userId: leadUser.id, role: "ADMIN" },
              { userId: adminUser.id, role: "ADMIN" },
            ],
          },
        },
      });

      const res = await request(app)
        .delete(`/api/projects/${toDeleteProject.key}`)
        .set("Authorization", `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("berhasil dihapus");

      const check = await prisma.project.findUnique({
        where: { key: toDeleteProject.key },
      });
      expect(check).toBeNull();
    });
  });
});
