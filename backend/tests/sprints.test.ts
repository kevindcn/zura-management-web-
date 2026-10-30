import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { generateToken } from "../src/lib/jwt.js";

describe("Sprint & Backlog Integration Tests", () => {
  let leadUser: any;
  let memberUser: any;
  let outsiderUser: any;

  let leadToken: string;
  let memberToken: string;
  let outsiderToken: string;

  let testProject: any;
  let sprint1: any;
  let sprint2: any;

  beforeAll(async () => {
    // 1. Create Users
    leadUser = await prisma.user.create({
      data: {
        name: "Sprint Lead",
        email: "sprintlead@test.local",
        passwordHash: "hash123",
      },
    });

    memberUser = await prisma.user.create({
      data: {
        name: "Sprint Member",
        email: "sprintmember@test.local",
        passwordHash: "hash123",
      },
    });

    outsiderUser = await prisma.user.create({
      data: {
        name: "Sprint Outsider",
        email: "sprintoutsider@test.local",
        passwordHash: "hash123",
      },
    });

    leadToken = generateToken(leadUser);
    memberToken = generateToken(memberUser);
    outsiderToken = generateToken(outsiderUser);

    // 2. Create Project
    testProject = await prisma.project.create({
      data: {
        name: "Sprint Test Project",
        key: "SPR",
        leadId: leadUser.id,
        statuses: {
          create: [
            { name: "To Do", category: "TO_DO", position: 1000 },
            { name: "Done", category: "DONE", position: 2000 },
          ],
        },
        members: {
          create: [
            { userId: leadUser.id, role: "ADMIN" },
            { userId: memberUser.id, role: "MEMBER" },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    if (testProject?.id) {
      await prisma.sprint.deleteMany({ where: { projectId: testProject.id } });
      await prisma.projectMember.deleteMany({ where: { projectId: testProject.id } });
      await prisma.status.deleteMany({ where: { projectId: testProject.id } });
      await prisma.project.delete({ where: { id: testProject.id } });
    }
    if (leadUser?.id) await prisma.user.delete({ where: { id: leadUser.id } });
    if (memberUser?.id) await prisma.user.delete({ where: { id: memberUser.id } });
    if (outsiderUser?.id) await prisma.user.delete({ where: { id: outsiderUser.id } });
    await prisma.$disconnect();
  });

  it("prevents outsider from viewing sprints (404)", async () => {
    const res = await request(app)
      .get(`/api/projects/${testProject.key}/sprints`)
      .set("Authorization", `Bearer ${outsiderToken}`);

    expect(res.status).toBe(404);
  });

  it("prevents member without sprint:manage from creating a sprint (403)", async () => {
    const res = await request(app)
      .post(`/api/projects/${testProject.key}/sprints`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ name: "Unauthorized Sprint" });

    expect(res.status).toBe(403);
  });

  it("allows admin to create a sprint with state FUTURE", async () => {
    const res = await request(app)
      .post(`/api/projects/${testProject.key}/sprints`)
      .set("Authorization", `Bearer ${leadToken}`)
      .send({
        name: "Sprint 1",
        goal: "Finish Core MVP",
        startDate: new Date().toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.sprint.name).toBe("Sprint 1");
    expect(res.body.sprint.state).toBe("FUTURE");
    sprint1 = res.body.sprint;
  });

  it("allows member to view sprints list", async () => {
    const res = await request(app)
      .get(`/api/projects/${testProject.key}/sprints`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    expect(res.body.sprints.length).toBeGreaterThanOrEqual(1);
    expect(res.body.sprints[0].name).toBe("Sprint 1");
  });

  it("allows admin to start a sprint (state -> ACTIVE)", async () => {
    const res = await request(app)
      .patch(`/api/projects/${testProject.key}/sprints/${sprint1.id}`)
      .set("Authorization", `Bearer ${leadToken}`)
      .send({ state: "ACTIVE" });

    expect(res.status).toBe(200);
    expect(res.body.sprint.state).toBe("ACTIVE");
  });

  it("prevents starting a second sprint while another sprint is ACTIVE (Agile Single Active Sprint Guard)", async () => {
    // Create Sprint 2
    const createRes = await request(app)
      .post(`/api/projects/${testProject.key}/sprints`)
      .set("Authorization", `Bearer ${leadToken}`)
      .send({ name: "Sprint 2" });

    expect(createRes.status).toBe(201);
    sprint2 = createRes.body.sprint;

    // Try starting Sprint 2 while Sprint 1 is ACTIVE
    const startRes = await request(app)
      .patch(`/api/projects/${testProject.key}/sprints/${sprint2.id}`)
      .set("Authorization", `Bearer ${leadToken}`)
      .send({ state: "ACTIVE" });

    expect(startRes.status).toBe(400);
    expect(startRes.body.message).toContain("sudah memiliki sprint aktif");
  });

  it("allows admin to complete a sprint (state -> CLOSED)", async () => {
    const res = await request(app)
      .patch(`/api/projects/${testProject.key}/sprints/${sprint1.id}`)
      .set("Authorization", `Bearer ${leadToken}`)
      .send({ state: "CLOSED" });

    expect(res.status).toBe(200);
    expect(res.body.sprint.state).toBe("CLOSED");
  });

  it("allows deleting a sprint and verifies removal", async () => {
    const res = await request(app)
      .delete(`/api/projects/${testProject.key}/sprints/${sprint2.id}`)
      .set("Authorization", `Bearer ${leadToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("berhasil dihapus");

    const check = await prisma.sprint.findUnique({ where: { id: sprint2.id } });
    expect(check).toBeNull();
  });
});
