import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { generateToken } from "../src/lib/jwt.js";
import { DEMO_EMAIL } from "../src/lib/permissions.js";

// Suffix and IDs per execution to avoid collisions across runs
const runNum = Math.floor(Math.random() * 89999 + 10000);
const runSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
const RUN_ID = `${Date.now()}_${runNum}`;

// Primary test project (for demo operations and general restrictions)
const testProjectKey = `D${runSuffix}`.slice(0, 5);
const testProjectName = `Demo Restrictions Project ${RUN_ID}`;

// Dedicated project for regular sprint completion test (avoids active sprint collision)
const regSprintProjectKey = `S${runSuffix}`.slice(0, 5);
const regSprintProjectName = `Regular Sprint Project ${RUN_ID}`;

// Dedicated project for regular sprint patch close test (avoids active sprint collision)
const regCloseSprintProjectKey = `C${runSuffix}`.slice(0, 5);
const regCloseSprintProjectName = `Regular Close Sprint Project ${RUN_ID}`;

// Project keys for POST /api/projects tests
const blockedProjectKey = `B${runSuffix}`.slice(0, 5);
const blockedProjectName = `Demo Blocked Project ${RUN_ID}`;

const regularCreatedKey = `R${runSuffix}`.slice(0, 5);
const regularCreatedName = `Regular Created Project ${RUN_ID}`;

const regularUserEmail = `reg_${RUN_ID}@demo-test.local`;
const demoUserEmail = `demo_${RUN_ID}@demo-test.local`;

/**
 * Foreign-key safe cleanup of leftover test data ending with @demo-test.local
 * from previous interrupted or failed test runs.
 */
async function cleanLeftoverDemoTestData() {
  try {
    const leftoverUsers = await prisma.user.findMany({
      where: { email: { endsWith: "@demo-test.local" } },
      select: { id: true },
    });

    const leftoverUserIds = leftoverUsers.map((u) => u.id);

    const leftoverProjects = await prisma.project.findMany({
      where: {
        OR: [
          ...(leftoverUserIds.length > 0
            ? [
                { leadId: { in: leftoverUserIds } },
                { members: { some: { userId: { in: leftoverUserIds } } } },
              ]
            : []),
          {
            key: {
              in: [
                testProjectKey,
                blockedProjectKey,
                regularCreatedKey,
                regSprintProjectKey,
                regCloseSprintProjectKey,
                "DEMOR",
                "DBP",
                "REGP",
              ],
            },
          },
        ],
      },
      select: { id: true },
    });
    const leftoverProjectIds = leftoverProjects.map((p) => p.id);

    if (leftoverProjectIds.length === 0 && leftoverUserIds.length === 0) {
      return;
    }

    // 1. SprintIssueResult
    if (leftoverProjectIds.length > 0) {
      await prisma.sprintIssueResult.deleteMany({
        where: {
          OR: [
            { sprint: { projectId: { in: leftoverProjectIds } } },
            { issue: { projectId: { in: leftoverProjectIds } } },
          ],
        },
      });

      // 2. IssueEvent
      await prisma.issueEvent.deleteMany({
        where: {
          OR: [
            { issue: { projectId: { in: leftoverProjectIds } } },
            { sprint: { projectId: { in: leftoverProjectIds } } },
          ],
        },
      });

      // 3. Comment
      await prisma.comment.deleteMany({
        where: {
          OR: [
            { issue: { projectId: { in: leftoverProjectIds } } },
            ...(leftoverUserIds.length > 0 ? [{ authorId: { in: leftoverUserIds } }] : []),
          ],
        },
      });

      // 4. Activity
      await prisma.activity.deleteMany({
        where: {
          OR: [
            { issue: { projectId: { in: leftoverProjectIds } } },
            ...(leftoverUserIds.length > 0 ? [{ userId: { in: leftoverUserIds } }] : []),
          ],
        },
      });

      // 5. IssueWatcher
      await prisma.issueWatcher.deleteMany({
        where: {
          OR: [
            { issue: { projectId: { in: leftoverProjectIds } } },
            ...(leftoverUserIds.length > 0 ? [{ userId: { in: leftoverUserIds } }] : []),
          ],
        },
      });

      // 6. Notification
      await prisma.notification.deleteMany({
        where: {
          OR: [
            { projectId: { in: leftoverProjectIds } },
            ...(leftoverUserIds.length > 0
              ? [
                  { userId: { in: leftoverUserIds } },
                  { actorId: { in: leftoverUserIds } },
                ]
              : []),
          ],
        },
      });

      // 7. SavedView
      await prisma.savedView.deleteMany({
        where: {
          OR: [
            { projectId: { in: leftoverProjectIds } },
            ...(leftoverUserIds.length > 0 ? [{ userId: { in: leftoverUserIds } }] : []),
          ],
        },
      });

      // 8. Issue (break parentId hierarchy cycle first, then delete)
      await prisma.issue.updateMany({
        where: {
          OR: [
            { projectId: { in: leftoverProjectIds } },
            ...(leftoverUserIds.length > 0
              ? [
                  { reporterId: { in: leftoverUserIds } },
                  { assigneeId: { in: leftoverUserIds } },
                ]
              : []),
          ],
        },
        data: { parentId: null },
      });

      await prisma.issue.deleteMany({
        where: {
          OR: [
            { projectId: { in: leftoverProjectIds } },
            ...(leftoverUserIds.length > 0
              ? [
                  { reporterId: { in: leftoverUserIds } },
                  { assigneeId: { in: leftoverUserIds } },
                ]
              : []),
          ],
        },
      });

      // 9. Sprint
      await prisma.sprint.deleteMany({
        where: { projectId: { in: leftoverProjectIds } },
      });

      // 10. Label
      await prisma.label.deleteMany({
        where: { projectId: { in: leftoverProjectIds } },
      });

      // 11. Status
      await prisma.status.deleteMany({
        where: { projectId: { in: leftoverProjectIds } },
      });

      // 12. ProjectMember
      await prisma.projectMember.deleteMany({
        where: {
          OR: [
            { projectId: { in: leftoverProjectIds } },
            ...(leftoverUserIds.length > 0 ? [{ userId: { in: leftoverUserIds } }] : []),
          ],
        },
      });

      // 13. Project
      await prisma.project.deleteMany({
        where: { id: { in: leftoverProjectIds } },
      });
    }

    // 14. User
    if (leftoverUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: leftoverUserIds } },
      });
    }
  } catch {
    // Best-effort cleanup
  }
}

describe("Demo Account Restrictions & Security Integration Tests", () => {
  let regularUser: any;
  let demoUser: any;

  let regularToken: string;
  let demoToken: string;

  let testProject: any;
  let regSprintProject: any;
  let regCloseSprintProject: any;
  let createdProjectId: string | undefined;

  let statusToDo: any;
  let statusInProgress: any;
  let statusDone: any;
  let statusExtra: any;

  let testIssueForDemoDelete: any;
  let testIssueForDemoPoints: any;
  let testIssueForDemoStatus: any;
  let testIssueForRegularDelete: any;
  let testIssueForRegularComment: any;

  let testCommentForDemo: any;
  let testCommentForRegular: any;

  let testLabelForDemo: any;
  let testLabelForRegular: any;

  let sprintForDemo: any;
  let sprintForDemoStart: any;
  let sprintForRegularDelete: any;
  let sprintForRegularComplete: any;
  let sprintForRegularPatchClose: any;

  const uploadedFilesToCleanup: string[] = [];

  beforeAll(async () => {
    // 0. Clean up any leftover data from prior failed runs
    await cleanLeftoverDemoTestData();

    // 1. Create Users with unique emails
    regularUser = await prisma.user.create({
      data: {
        name: `Regular Admin ${runSuffix}`,
        email: regularUserEmail,
        passwordHash: "hash123",
      },
    });

    demoUser = await prisma.user.create({
      data: {
        name: `Demo User ${runSuffix}`,
        email: demoUserEmail,
        passwordHash: "hash123",
      },
    });

    regularToken = generateToken({
      id: regularUser.id,
      email: regularUser.email,
      name: regularUser.name,
    });

    demoToken = generateToken({
      id: demoUser.id,
      email: demoUser.email,
      name: demoUser.name,
      isDemo: true,
    });

    // 2. Create Primary Project (issueCounter set to 10 to ensure headroom for API issue creation)
    testProject = await prisma.project.create({
      data: {
        name: testProjectName,
        key: testProjectKey,
        leadId: regularUser.id,
        issueCounter: 10,
        statuses: {
          create: [
            { name: "To Do", category: "TO_DO", position: 1000 },
            { name: "In Progress", category: "IN_PROGRESS", position: 2000 },
            { name: "Done", category: "DONE", position: 3000 },
            { name: "Extra Column", category: "TO_DO", position: 4000 },
          ],
        },
        members: {
          create: [
            { userId: regularUser.id, role: "ADMIN" },
            { userId: demoUser.id, role: "ADMIN" },
          ],
        },
      },
      include: {
        statuses: true,
      },
    });

    statusToDo = testProject.statuses.find((s: any) => s.name === "To Do");
    statusInProgress = testProject.statuses.find((s: any) => s.name === "In Progress");
    statusDone = testProject.statuses.find((s: any) => s.name === "Done");
    statusExtra = testProject.statuses.find((s: any) => s.name === "Extra Column");

    // 3. Create Dedicated Projects for Regular Sprint Complete & Close tests
    regSprintProject = await prisma.project.create({
      data: {
        name: regSprintProjectName,
        key: regSprintProjectKey,
        leadId: regularUser.id,
        issueCounter: 0,
        statuses: {
          create: [
            { name: "To Do", category: "TO_DO", position: 1000 },
            { name: "Done", category: "DONE", position: 2000 },
          ],
        },
        members: {
          create: [{ userId: regularUser.id, role: "ADMIN" }],
        },
      },
    });

    regCloseSprintProject = await prisma.project.create({
      data: {
        name: regCloseSprintProjectName,
        key: regCloseSprintProjectKey,
        leadId: regularUser.id,
        issueCounter: 0,
        statuses: {
          create: [
            { name: "To Do", category: "TO_DO", position: 1000 },
            { name: "Done", category: "DONE", position: 2000 },
          ],
        },
        members: {
          create: [{ userId: regularUser.id, role: "ADMIN" }],
        },
      },
    });

    // 4. Create distinct test issues in testProject (keys 1-5, below project issueCounter 10)
    testIssueForDemoDelete = await prisma.issue.create({
      data: {
        key: `${testProjectKey}-1`,
        number: 1,
        title: "Issue to test demo delete",
        projectId: testProject.id,
        statusId: statusToDo.id,
        reporterId: demoUser.id,
        storyPoints: 3,
      },
    });

    testIssueForDemoPoints = await prisma.issue.create({
      data: {
        key: `${testProjectKey}-2`,
        number: 2,
        title: "Issue to test demo points update",
        projectId: testProject.id,
        statusId: statusToDo.id,
        reporterId: demoUser.id,
        storyPoints: 2,
      },
    });

    testIssueForDemoStatus = await prisma.issue.create({
      data: {
        key: `${testProjectKey}-3`,
        number: 3,
        title: "Issue to test demo status move",
        projectId: testProject.id,
        statusId: statusToDo.id,
        reporterId: demoUser.id,
        storyPoints: 3,
      },
    });

    testIssueForRegularDelete = await prisma.issue.create({
      data: {
        key: `${testProjectKey}-4`,
        number: 4,
        title: "Issue to test regular delete",
        projectId: testProject.id,
        statusId: statusToDo.id,
        reporterId: regularUser.id,
        storyPoints: 5,
      },
    });

    testIssueForRegularComment = await prisma.issue.create({
      data: {
        key: `${testProjectKey}-5`,
        number: 5,
        title: "Issue to host regular comment test",
        projectId: testProject.id,
        statusId: statusToDo.id,
        reporterId: regularUser.id,
        storyPoints: 1,
      },
    });

    // 5. Create test comments on separate issues to avoid cascade deletion side-effects
    testCommentForDemo = await prisma.comment.create({
      data: {
        body: "Comment for demo delete test",
        issueId: testIssueForDemoDelete.id,
        authorId: demoUser.id,
      },
    });

    testCommentForRegular = await prisma.comment.create({
      data: {
        body: "Comment for regular delete test",
        issueId: testIssueForRegularComment.id,
        authorId: regularUser.id,
      },
    });

    // 6. Create test labels
    testLabelForDemo = await prisma.label.create({
      data: {
        name: `demo-label-${runSuffix}`,
        color: "#0C66E4",
        projectId: testProject.id,
      },
    });

    testLabelForRegular = await prisma.label.create({
      data: {
        name: `regular-label-${runSuffix}`,
        color: "#1F845A",
        projectId: testProject.id,
      },
    });

    // 7. Create test sprints
    // In testProject: all sprints start as FUTURE so there are NO active sprints in testProject initially
    sprintForDemo = await prisma.sprint.create({
      data: {
        name: `Sprint Demo Target ${runSuffix}`,
        projectId: testProject.id,
        state: "FUTURE",
      },
    });

    sprintForDemoStart = await prisma.sprint.create({
      data: {
        name: `Sprint Demo Start Target ${runSuffix}`,
        projectId: testProject.id,
        state: "FUTURE",
      },
    });

    sprintForRegularDelete = await prisma.sprint.create({
      data: {
        name: `Sprint Regular Delete Target ${runSuffix}`,
        projectId: testProject.id,
        state: "FUTURE",
      },
    });

    // In dedicated projects: 1 active sprint each, exactly matching Agile rules
    sprintForRegularComplete = await prisma.sprint.create({
      data: {
        name: `Sprint Regular Complete Target ${runSuffix}`,
        projectId: regSprintProject.id,
        state: "ACTIVE",
        startDate: new Date(),
      },
    });

    sprintForRegularPatchClose = await prisma.sprint.create({
      data: {
        name: `Sprint Regular Patch Close Target ${runSuffix}`,
        projectId: regCloseSprintProject.id,
        state: "ACTIVE",
        startDate: new Date(),
      },
    });
  });

  afterAll(async () => {
    // 1. Clean up uploaded test files
    for (const filePath of uploadedFilesToCleanup) {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore cleanup errors
        }
      }
    }

    // 2. Clean up DB entities belonging strictly to this test run
    try {
      const targetProjectIds: string[] = [
        testProject?.id,
        regSprintProject?.id,
        regCloseSprintProject?.id,
        createdProjectId,
      ].filter((id): id is string => typeof id === "string" && id.length > 0);

      const targetUserIds: string[] = [regularUser?.id, demoUser?.id].filter(
        (id): id is string => typeof id === "string" && id.length > 0
      );

      if (targetProjectIds.length > 0) {
        await prisma.sprintIssueResult.deleteMany({
          where: {
            OR: [
              { sprint: { projectId: { in: targetProjectIds } } },
              { issue: { projectId: { in: targetProjectIds } } },
            ],
          },
        });
        await prisma.issueEvent.deleteMany({
          where: {
            OR: [
              { issue: { projectId: { in: targetProjectIds } } },
              { sprint: { projectId: { in: targetProjectIds } } },
            ],
          },
        });
        await prisma.comment.deleteMany({
          where: { issue: { projectId: { in: targetProjectIds } } },
        });
        await prisma.activity.deleteMany({
          where: { issue: { projectId: { in: targetProjectIds } } },
        });
        await prisma.issueWatcher.deleteMany({
          where: { issue: { projectId: { in: targetProjectIds } } },
        });
        await prisma.notification.deleteMany({
          where: { projectId: { in: targetProjectIds } },
        });
        await prisma.savedView.deleteMany({
          where: { projectId: { in: targetProjectIds } },
        });

        await prisma.issue.updateMany({
          where: { projectId: { in: targetProjectIds } },
          data: { parentId: null },
        });
        await prisma.issue.deleteMany({
          where: { projectId: { in: targetProjectIds } },
        });
        await prisma.sprint.deleteMany({
          where: { projectId: { in: targetProjectIds } },
        });
        await prisma.label.deleteMany({
          where: { projectId: { in: targetProjectIds } },
        });
        await prisma.status.deleteMany({
          where: { projectId: { in: targetProjectIds } },
        });
        await prisma.projectMember.deleteMany({
          where: { projectId: { in: targetProjectIds } },
        });
        await prisma.project.deleteMany({
          where: { id: { in: targetProjectIds } },
        });
      }

      if (targetUserIds.length > 0) {
        await prisma.comment.deleteMany({
          where: { authorId: { in: targetUserIds } },
        });
        await prisma.activity.deleteMany({
          where: { userId: { in: targetUserIds } },
        });
        await prisma.issueWatcher.deleteMany({
          where: { userId: { in: targetUserIds } },
        });
        await prisma.notification.deleteMany({
          where: {
            OR: [
              { userId: { in: targetUserIds } },
              { actorId: { in: targetUserIds } },
            ],
          },
        });
        await prisma.savedView.deleteMany({
          where: { userId: { in: targetUserIds } },
        });
        await prisma.projectMember.deleteMany({
          where: { userId: { in: targetUserIds } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: targetUserIds } },
        });
      }
    } catch {
      // Best-effort cleanup so afterAll never throws or masks test failures
    }
  });

  describe("1. Login Backdoor Hardening", () => {
    it("returns 401 with generic credential error when attempting regular login with DEMO_EMAIL", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: DEMO_EMAIL,
          password: "any-password-attempt",
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid email or password");
    });

    it("issues a token containing isDemo: true via POST /api/auth/demo-login", async () => {
      process.env.ENABLE_DEMO_LOGIN = "true";
      const res = await request(app).post("/api/auth/demo-login");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body.user.email).toBe(DEMO_EMAIL);

      const decoded = jwt.decode(res.body.token) as any;
      expect(decoded.isDemo).toBe(true);
    });
  });

  describe("2. Demo Token Restrictions (403 on Restricted Routes)", () => {
    it("blocks POST /api/projects with 403 for demo token", async () => {
      const res = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${demoToken}`)
        .send({ name: blockedProjectName, key: blockedProjectKey });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Fitur ini dinonaktifkan di akun demo.");
    });

    it("blocks PATCH /api/projects/:key with 403 for demo token", async () => {
      const res = await request(app)
        .patch(`/api/projects/${testProject.key}`)
        .set("Authorization", `Bearer ${demoToken}`)
        .send({ name: "Renamed by Demo" });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Fitur ini dinonaktifkan di akun demo.");
    });

    it("blocks DELETE /api/projects/:key/statuses/:statusId with 403 for demo token", async () => {
      const res = await request(app)
        .delete(`/api/projects/${testProject.key}/statuses/${statusExtra.id}`)
        .set("Authorization", `Bearer ${demoToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Fitur ini dinonaktifkan di akun demo.");
    });

    it("blocks DELETE /api/issues/:key with 403 for demo token", async () => {
      const res = await request(app)
        .delete(`/api/issues/${testIssueForDemoDelete.key}`)
        .set("Authorization", `Bearer ${demoToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Fitur ini dinonaktifkan di akun demo.");
    });

    it("blocks DELETE /api/comments/:id with 403 for demo token", async () => {
      const res = await request(app)
        .delete(`/api/comments/${testCommentForDemo.id}`)
        .set("Authorization", `Bearer ${demoToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Fitur ini dinonaktifkan di akun demo.");
    });

    it("blocks DELETE /api/projects/:key/labels/:id with 403 for demo token", async () => {
      const res = await request(app)
        .delete(`/api/projects/${testProject.key}/labels/${testLabelForDemo.id}`)
        .set("Authorization", `Bearer ${demoToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Fitur ini dinonaktifkan di akun demo.");
    });

    it("blocks DELETE /api/projects/:key/sprints/:id with 403 for demo token", async () => {
      const res = await request(app)
        .delete(`/api/projects/${testProject.key}/sprints/${sprintForDemo.id}`)
        .set("Authorization", `Bearer ${demoToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Fitur ini dinonaktifkan di akun demo.");
    });

    it("blocks POST /api/projects/:key/sprints/:id/complete with 403 for demo token", async () => {
      const res = await request(app)
        .post(`/api/projects/${testProject.key}/sprints/${sprintForDemo.id}/complete`)
        .set("Authorization", `Bearer ${demoToken}`)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Fitur ini dinonaktifkan di akun demo.");
    });

    it("blocks PATCH /api/projects/:key/sprints/:id with state: 'CLOSED' with 403 for demo token", async () => {
      const res = await request(app)
        .patch(`/api/projects/${testProject.key}/sprints/${sprintForDemo.id}`)
        .set("Authorization", `Bearer ${demoToken}`)
        .send({ state: "CLOSED" });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Fitur ini dinonaktifkan di akun demo.");
    });

    it("blocks POST /api/upload with 403 for demo token", async () => {
      const res = await request(app)
        .post("/api/upload")
        .set("Authorization", `Bearer ${demoToken}`)
        .attach("file", Buffer.from("blocked demo upload"), "sample.png");

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Fitur ini dinonaktifkan di akun demo.");
    });
  });

  describe("3. Demo Token Allowed Operations (200 / 201)", () => {
    it("allows creating an issue via POST /api/projects/:key/issues for demo token", async () => {
      const res = await request(app)
        .post(`/api/projects/${testProject.key}/issues`)
        .set("Authorization", `Bearer ${demoToken}`)
        .send({
          title: "Demo Created Issue",
          type: "TASK",
          priority: "MEDIUM",
          storyPoints: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.issue).toHaveProperty("key");
      expect(res.body.issue.title).toBe("Demo Created Issue");
    });

    it("allows updating story points via PATCH /api/issues/:key for demo token", async () => {
      const res = await request(app)
        .patch(`/api/issues/${testIssueForDemoPoints.key}`)
        .set("Authorization", `Bearer ${demoToken}`)
        .send({ storyPoints: 8 });

      expect(res.status).toBe(200);
      expect(res.body.issue.storyPoints).toBe(8);
    });

    it("allows moving issue status via PATCH /api/issues/:key for demo token", async () => {
      const res = await request(app)
        .patch(`/api/issues/${testIssueForDemoStatus.key}`)
        .set("Authorization", `Bearer ${demoToken}`)
        .send({ statusId: statusInProgress.id });

      expect(res.status).toBe(200);
      expect(res.body.issue.statusId).toBe(statusInProgress.id);
    });

    it("allows starting a sprint via PATCH /api/projects/:key/sprints/:id (state: 'ACTIVE') for demo token", async () => {
      const res = await request(app)
        .patch(`/api/projects/${testProject.key}/sprints/${sprintForDemoStart.id}`)
        .set("Authorization", `Bearer ${demoToken}`)
        .send({ state: "ACTIVE" });

      expect(res.status).toBe(200);
      expect(res.body.sprint.state).toBe("ACTIVE");
    });

    it("allows updating sprint metadata (name/goal) via PATCH for demo token", async () => {
      const res = await request(app)
        .patch(`/api/projects/${testProject.key}/sprints/${sprintForDemoStart.id}`)
        .set("Authorization", `Bearer ${demoToken}`)
        .send({ name: "Updated Sprint Name By Demo" });

      expect(res.status).toBe(200);
      expect(res.body.sprint.name).toBe("Updated Sprint Name By Demo");
    });
  });

  describe("4. Regular Token Success (200 / 201 on all restricted routes)", () => {
    it("allows POST /api/projects for regular token", async () => {
      const res = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${regularToken}`)
        .send({ name: regularCreatedName, key: regularCreatedKey });

      expect(res.status).toBe(201);
      expect(res.body.project).toHaveProperty("key", regularCreatedKey);
      if (res.body.project?.id) {
        createdProjectId = res.body.project.id;
      }
    });

    it("allows PATCH /api/projects/:key for regular token", async () => {
      const res = await request(app)
        .patch(`/api/projects/${testProject.key}`)
        .set("Authorization", `Bearer ${regularToken}`)
        .send({ name: "Updated Project By Regular" });

      expect(res.status).toBe(200);
      expect(res.body.project.name).toBe("Updated Project By Regular");
    });

    it("allows DELETE /api/projects/:key/statuses/:statusId for regular token", async () => {
      const res = await request(app)
        .delete(`/api/projects/${testProject.key}/statuses/${statusExtra.id}`)
        .set("Authorization", `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("berhasil dihapus");
    });

    it("allows DELETE /api/comments/:id for regular token", async () => {
      const res = await request(app)
        .delete(`/api/comments/${testCommentForRegular.id}`)
        .set("Authorization", `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Comment deleted successfully");
    });

    it("allows DELETE /api/issues/:key for regular token", async () => {
      const res = await request(app)
        .delete(`/api/issues/${testIssueForRegularDelete.key}`)
        .set("Authorization", `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Issue deleted successfully");
    });

    it("allows DELETE /api/projects/:key/labels/:id for regular token", async () => {
      const res = await request(app)
        .delete(`/api/projects/${testProject.key}/labels/${testLabelForRegular.id}`)
        .set("Authorization", `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Label berhasil dihapus");
    });

    it("allows DELETE /api/projects/:key/sprints/:id for regular token", async () => {
      const res = await request(app)
        .delete(`/api/projects/${testProject.key}/sprints/${sprintForRegularDelete.id}`)
        .set("Authorization", `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("berhasil dihapus");
    });

    it("allows POST /api/projects/:key/sprints/:id/complete for regular token", async () => {
      const res = await request(app)
        .post(`/api/projects/${regSprintProject.key}/sprints/${sprintForRegularComplete.id}/complete`)
        .set("Authorization", `Bearer ${regularToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.sprint.state).toBe("CLOSED");
    });

    it("allows PATCH /api/projects/:key/sprints/:id with state: 'CLOSED' for regular token", async () => {
      const res = await request(app)
        .patch(`/api/projects/${regCloseSprintProject.key}/sprints/${sprintForRegularPatchClose.id}`)
        .set("Authorization", `Bearer ${regularToken}`)
        .send({ state: "CLOSED" });

      expect(res.status).toBe(200);
      expect(res.body.sprint.state).toBe("CLOSED");
    });

    it("allows POST /api/upload for regular token", async () => {
      const res = await request(app)
        .post("/api/upload")
        .set("Authorization", `Bearer ${regularToken}`)
        .attach("file", Buffer.from("regular test content"), "regular-test.txt");

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("url");
      expect(res.body).toHaveProperty("storedName");

      if (res.body.storedName) {
        const filePath = path.resolve(process.cwd(), "uploads", res.body.storedName);
        uploadedFilesToCleanup.push(filePath);
      }
    });
  });

  describe("5. File Upload Whitelist & Security", () => {
    it("rejects .html file upload with 400 for regular user", async () => {
      const res = await request(app)
        .post("/api/upload")
        .set("Authorization", `Bearer ${regularToken}`)
        .attach("file", Buffer.from("<h1>malicious</h1>"), "exploit.html");

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/tidak diizinkan|tidak valid/i);
    });

    it("rejects .svg file upload with 400 for regular user", async () => {
      const res = await request(app)
        .post("/api/upload")
        .set("Authorization", `Bearer ${regularToken}`)
        .attach("file", Buffer.from("<svg onload='alert(1)'></svg>"), "image.svg");

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/tidak diizinkan|tidak valid/i);
    });

    it("accepts .png file upload with 201 for regular user", async () => {
      const res = await request(app)
        .post("/api/upload")
        .set("Authorization", `Bearer ${regularToken}`)
        .attach("file", Buffer.from("png-binary-content"), "valid.png");

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("url");
      expect(res.body).toHaveProperty("storedName");

      if (res.body.storedName) {
        const filePath = path.resolve(process.cwd(), "uploads", res.body.storedName);
        uploadedFilesToCleanup.push(filePath);
      }
    });

    it("serves static non-image uploads with Content-Disposition: attachment and nosniff", async () => {
      const uploadsDir = path.resolve(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const testFileName = `test-static-doc-${Date.now()}.txt`;
      const testFilePath = path.join(uploadsDir, testFileName);
      fs.writeFileSync(testFilePath, "plain document content");
      uploadedFilesToCleanup.push(testFilePath);

      const getRes = await request(app).get(`/uploads/${testFileName}`);
      expect(getRes.status).toBe(200);
      expect(getRes.headers["x-content-type-options"]).toBe("nosniff");
      expect(getRes.headers["content-disposition"]).toContain("attachment");
    });
  });
});
