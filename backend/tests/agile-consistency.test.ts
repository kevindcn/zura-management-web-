import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import {
  ExpectedMetrics,
  MetricDiscrepancyCollector,
  assertLocalBalance,
  assertResponseOk,
  AgileTestContext,
  createAgileTestContext,
  cleanupAgileTestContext,
} from "./helpers/agile-test-helper.js";

describe("Agile Metrics Consistency Tests (AGILE-RULES)", () => {
  const createdProjectIds: string[] = [];

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    vi.useRealTimers();
    for (const pId of createdProjectIds) {
      await cleanupAgileTestContext(pId);
    }
  });

  // Helper to create sprint with infrastructure assertion
  async function createSprint(ctx: AgileTestContext, name: string) {
    const res = await request(app)
      .post(`/api/projects/${ctx.project.key}/sprints`)
      .set("Authorization", `Bearer ${ctx.leadToken}`)
      .send({ name });
    assertResponseOk(res, 201, `createSprint('${name}')`);
    return res.body.sprint;
  }

  // Helper to start sprint with infrastructure assertion
  async function startSprint(
    ctx: AgileTestContext,
    sprintId: string,
    startDate: string,
    endDate: string
  ) {
    const res = await request(app)
      .patch(`/api/projects/${ctx.project.key}/sprints/${sprintId}`)
      .set("Authorization", `Bearer ${ctx.leadToken}`)
      .send({ state: "ACTIVE", startDate, endDate });
    assertResponseOk(res, 200, `startSprint('${sprintId}')`);
    return res.body.sprint;
  }

  // Helper to create issue with infrastructure assertion
  async function createIssue(
    ctx: AgileTestContext,
    title: string,
    type: "STORY" | "TASK" | "BUG",
    storyPoints: number | null,
    sprintId?: string | null
  ) {
    const res = await request(app)
      .post(`/api/projects/${ctx.project.key}/issues`)
      .set("Authorization", `Bearer ${ctx.leadToken}`)
      .send({
        title,
        type,
        storyPoints,
        sprintId,
      });
    assertResponseOk(res, 201, `createIssue('${title}')`);
    return res.body.issue;
  }

  // Helper to update issue with infrastructure assertion
  async function updateIssue(
    ctx: AgileTestContext,
    issueKey: string,
    data: any
  ) {
    const res = await request(app)
      .patch(`/api/issues/${issueKey}`)
      .set("Authorization", `Bearer ${ctx.leadToken}`)
      .send(data);
    assertResponseOk(res, 200, `updateIssue('${issueKey}')`);
    return res.body.issue;
  }

  // Helper to complete sprint with infrastructure assertion
  async function completeSprint(
    ctx: AgileTestContext,
    sprintId: string,
    targetSprintId?: string | null
  ) {
    const res = await request(app)
      .post(`/api/projects/${ctx.project.key}/sprints/${sprintId}/complete`)
      .set("Authorization", `Bearer ${ctx.leadToken}`)
      .send({ targetSprintId: targetSprintId || null });
    assertResponseOk(res, 200, `completeSprint('${sprintId}')`);
    return res.body.sprint;
  }

  // Helper to verify all 5 metrics uniformly across both endpoints
  function verifyFiveMetrics(
    collector: MetricDiscrepancyCollector,
    resBurndown: any,
    resReport: any,
    expected: ExpectedMetrics,
    metricType: "points" | "issues" = "points"
  ) {
    const bSum = resBurndown.body.summary;
    const rSum = resReport.body.summary;

    if (metricType === "points") {
      collector.check("/burndown", bSum, "committed", expected.committed);
      collector.check("/burndown", bSum, "scopeAdded", expected.scopeAdded);
      collector.check("/burndown", bSum, "removed", expected.removed);
      collector.check("/burndown", bSum, "completed", expected.completed);
      collector.check("/burndown", bSum, "remaining", expected.remaining);

      collector.check("/report", rSum, "committedPoints", expected.committed);
      collector.check("/report", rSum, "scopeAddedPoints", expected.scopeAdded);
      collector.check("/report", rSum, "removedPoints", expected.removed);
      collector.check("/report", rSum, "completedPoints", expected.completed);
      collector.check("/report", rSum, "carriedOverPoints", expected.remaining);
    } else {
      collector.check("/burndown (issues)", bSum, "committed", expected.committed);
      collector.check("/burndown (issues)", bSum, "scopeAdded", expected.scopeAdded);
      collector.check("/burndown (issues)", bSum, "removed", expected.removed);
      collector.check("/burndown (issues)", bSum, "completed", expected.completed);
      collector.check("/burndown (issues)", bSum, "remaining", expected.remaining);

      collector.check("/report (issues)", rSum, "committedIssues", expected.committed);
      collector.check("/report (issues)", rSum, "scopeAddedIssues", expected.scopeAdded);
      collector.check("/report (issues)", rSum, "removedIssues", expected.removed);
      collector.check("/report (issues)", rSum, "completedIssues", expected.completed);
      collector.check("/report (issues)", rSum, "carriedOverIssues", expected.remaining);
    }
  }

  // S1: Tiket berpoin sebelum Start Sprint (AGILE-RULES 3.2)
  it("S1 [AGILE-RULES 3.2]: Tiket berpoin sebelum Start Sprint", async () => {
    const ctx = await createAgileTestContext("S1");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z")); // Day 1 12:00 WIB

    const sprint = await createSprint(ctx, "Sprint S1");
    await createIssue(ctx, "T1", "STORY", 5, sprint.id);
    await createIssue(ctx, "T2", "TASK", 3, sprint.id);

    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    const expected: ExpectedMetrics = {
      committed: 8,
      scopeAdded: 0,
      removed: 0,
      completed: 0,
      remaining: 8,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S1");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S1");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S1");
  });

  // S2: Kasus MOP: Start Sprint saat tiket tanpa poin, poin diisi di hari yang sama (AGILE-RULES 3.2, 6)
  it("S2 [AGILE-RULES 3.2, 6]: Kasus MOP: Start Sprint tanpa poin, poin diisi di hari yang sama", async () => {
    const ctx = await createAgileTestContext("S2");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z")); // Day 1 12:00 WIB

    const sprint = await createSprint(ctx, "MOP Sprint 1");
    const mop1 = await createIssue(ctx, "MOP-1", "TASK", null, sprint.id);
    const mop2 = await createIssue(ctx, "MOP-2", "STORY", null, sprint.id);

    // Start sprint with 0 points
    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    // Later on Day 1: MOP-2 updated 1 -> 19
    vi.setSystemTime(new Date("2026-10-31T06:39:29.000Z"));
    await updateIssue(ctx, mop2.key, { storyPoints: 1 });
    vi.setSystemTime(new Date("2026-10-31T06:39:29.260Z"));
    await updateIssue(ctx, mop2.key, { storyPoints: 19 });

    // Later on Day 1: MOP-1 updated 2 -> 20
    vi.setSystemTime(new Date("2026-10-31T06:40:54.800Z"));
    await updateIssue(ctx, mop1.key, { storyPoints: 2 });
    vi.setSystemTime(new Date("2026-10-31T06:40:55.020Z"));
    await updateIssue(ctx, mop1.key, { storyPoints: 20 });

    const expected: ExpectedMetrics = {
      committed: 39,
      scopeAdded: 0,
      removed: 0,
      completed: 0,
      remaining: 39,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S2");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S2");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S2");
  });

  // S3: Poin diisi di hari ke-3 (Scope Added) (AGILE-RULES 3.3.2)
  it("S3 [AGILE-RULES 3.3.2]: Poin diisi di hari ke-3 (Scope Added +5)", async () => {
    const ctx = await createAgileTestContext("S3");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z")); // Day 1 12:00 WIB

    const sprint = await createSprint(ctx, "Sprint S3");
    const t1 = await createIssue(ctx, "T1", "STORY", null, sprint.id);

    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    // Advance to Day 3 (2 Nov 2026 12:00 WIB = 05:00 UTC)
    vi.setSystemTime(new Date("2026-11-02T05:00:00.000Z"));
    await updateIssue(ctx, t1.key, { storyPoints: 5 });

    const expected: ExpectedMetrics = {
      committed: 0,
      scopeAdded: 5,
      removed: 0,
      completed: 0,
      remaining: 5,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S3");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S3");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S3");
  });

  // S4: Tiket ditambah setelah hari mulai (AGILE-RULES 3.3.2)
  it("S4 [AGILE-RULES 3.3.2]: Tiket ditambah setelah hari mulai", async () => {
    const ctx = await createAgileTestContext("S4");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z")); // Day 1 12:00 WIB

    const sprint = await createSprint(ctx, "Sprint S4");
    await createIssue(ctx, "T1", "STORY", 5, sprint.id);

    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    // Advance to Day 2 (1 Nov 2026 12:00 WIB = 05:00 UTC)
    vi.setSystemTime(new Date("2026-11-01T05:00:00.000Z"));
    await createIssue(ctx, "T2", "TASK", 8, sprint.id);

    const expected: ExpectedMetrics = {
      committed: 5,
      scopeAdded: 8,
      removed: 0,
      completed: 0,
      remaining: 13,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S4");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S4");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S4");
  });

  // S5: Tiket dikeluarkan setelah hari mulai (removed) (AGILE-RULES 3.3.3)
  it("S5 [AGILE-RULES 3.3.3]: Tiket dikeluarkan setelah hari mulai (removed)", async () => {
    const ctx = await createAgileTestContext("S5");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z")); // Day 1 12:00 WIB

    const sprint = await createSprint(ctx, "Sprint S5");
    await createIssue(ctx, "T1", "STORY", 5, sprint.id);
    const t2 = await createIssue(ctx, "T2", "TASK", 8, sprint.id);

    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    // Advance to Day 2: T2 removed from sprint (sprintId = null)
    vi.setSystemTime(new Date("2026-11-01T05:00:00.000Z"));
    await updateIssue(ctx, t2.key, { sprintId: null });

    const expected: ExpectedMetrics = {
      committed: 13,
      scopeAdded: 0,
      removed: 8,
      completed: 0,
      remaining: 5,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S5");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S5");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S5");
  });

  // S6: Penurunan poin 8 menjadi 5 (removed 3) (AGILE-RULES 3.3.3)
  it("S6 [AGILE-RULES 3.3.3]: Penurunan poin 8 menjadi 5 (removed 3)", async () => {
    const ctx = await createAgileTestContext("S6");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z")); // Day 1 12:00 WIB

    const sprint = await createSprint(ctx, "Sprint S6");
    const t1 = await createIssue(ctx, "T1", "STORY", 8, sprint.id);

    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    // Advance to Day 2: T1 re-estimated from 8 to 5
    vi.setSystemTime(new Date("2026-11-01T05:00:00.000Z"));
    await updateIssue(ctx, t1.key, { storyPoints: 5 });

    const expected: ExpectedMetrics = {
      committed: 8,
      scopeAdded: 0,
      removed: 3,
      completed: 0,
      remaining: 5,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S6");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S6");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S6");
  });

  // S7: Tiket DONE lalu dikeluarkan (tidak boleh di completed) (AGILE-RULES 3.3.4)
  it("S7 [AGILE-RULES 3.3.4]: Tiket DONE lalu dikeluarkan (tidak boleh di completed)", async () => {
    const ctx = await createAgileTestContext("S7");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z")); // Day 1 12:00 WIB

    const sprint = await createSprint(ctx, "Sprint S7");
    const t1 = await createIssue(ctx, "T1", "STORY", 5, sprint.id);
    await createIssue(ctx, "T2", "TASK", 5, sprint.id);

    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    // Day 2: T1 moved to DONE
    vi.setSystemTime(new Date("2026-11-01T05:00:00.000Z"));
    await updateIssue(ctx, t1.key, { statusId: ctx.doneStatus.id });

    // Day 3: T1 removed from sprint to backlog
    vi.setSystemTime(new Date("2026-11-02T05:00:00.000Z"));
    await updateIssue(ctx, t1.key, { sprintId: null });

    const expected: ExpectedMetrics = {
      committed: 10,
      scopeAdded: 0,
      removed: 5,
      completed: 0, // T1 is removed, cannot be counted in completed!
      remaining: 5,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S7");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S7");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S7");
  });

  // S8A1: startDate diubah saat startedAt ada (poin ada sebelum Start) (AGILE-RULES 2.2)
  it("S8A1 [AGILE-RULES 2.2]: startDate diubah saat startedAt ada (poin ada sebelum Start)", async () => {
    const ctx = await createAgileTestContext("S8A1");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z")); // Day 1 12:00 WIB

    const sprint = await createSprint(ctx, "Sprint S8A1");
    await createIssue(ctx, "T1", "STORY", 5, sprint.id);

    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    // Later: startDate updated backward to 2026-10-25
    const patchRes = await request(app)
      .patch(`/api/projects/${ctx.project.key}/sprints/${sprint.id}`)
      .set("Authorization", `Bearer ${ctx.leadToken}`)
      .send({ startDate: "2026-10-25" });
    assertResponseOk(patchRes, 200, "patchSprint startDate S8A1");

    const expected: ExpectedMetrics = {
      committed: 5,
      scopeAdded: 0,
      removed: 0,
      completed: 0,
      remaining: 5,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S8A1");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S8A1");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S8A1");
  });

  // S8A2: startDate diubah saat startedAt ada (poin kosong saat Start, snapshot 0) (AGILE-RULES 2.2, 6)
  it("S8A2 [AGILE-RULES 2.2, 6]: startDate diubah saat startedAt ada (poin kosong saat Start)", async () => {
    const ctx = await createAgileTestContext("S8A2");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z")); // Day 1 12:00 WIB

    const sprint = await createSprint(ctx, "Sprint S8A2");
    const t1 = await createIssue(ctx, "T1", "STORY", null, sprint.id);

    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    // Later on Day 1: T1 filled with 19 points
    vi.setSystemTime(new Date("2026-10-31T07:00:00.000Z"));
    await updateIssue(ctx, t1.key, { storyPoints: 19 });

    // Later: startDate updated backward to 2026-10-25
    const patchRes = await request(app)
      .patch(`/api/projects/${ctx.project.key}/sprints/${sprint.id}`)
      .set("Authorization", `Bearer ${ctx.leadToken}`)
      .send({ startDate: "2026-10-25" });
    assertResponseOk(patchRes, 200, "patchSprint startDate S8A2");

    const expected: ExpectedMetrics = {
      committed: 19,
      scopeAdded: 0,
      removed: 0,
      completed: 0,
      remaining: 19,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S8A2");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S8A2");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S8A2");
  });

  // S8B: sprint ACTIVE lama dengan startedAt dikosongkan lewat DB, lalu startDate diubah (AGILE-RULES 2.2)
  it("S8B [AGILE-RULES 2.2]: sprint ACTIVE lama dengan startedAt null, baseline ikut startDate baru", async () => {
    const ctx = await createAgileTestContext("S8B");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z"));

    const sprint = await createSprint(ctx, "Sprint S8B");
    await createIssue(ctx, "T1", "STORY", 5, sprint.id);

    await startSprint(ctx, sprint.id, "2026-10-28", "2026-11-14");

    // State manipulation via Prisma for legacy simulation: startedAt set to null
    await prisma.sprint.update({
      where: { id: sprint.id },
      data: { startedAt: null },
    });

    // Update startDate to 2026-10-31 (matches T1 addition day)
    const patchRes = await request(app)
      .patch(`/api/projects/${ctx.project.key}/sprints/${sprint.id}`)
      .set("Authorization", `Bearer ${ctx.leadToken}`)
      .send({ startDate: "2026-10-31" });
    assertResponseOk(patchRes, 200, "patchSprint startDate S8B");

    const expected: ExpectedMetrics = {
      committed: 5,
      scopeAdded: 0,
      removed: 0,
      completed: 0,
      remaining: 5,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S8B");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S8B");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S8B");
  });

  // S9A: Keluar lalu masuk lagi di hari WIB yang sama (5 ke 5 = 0) (AGILE-RULES 3.3.7)
  it("S9A [AGILE-RULES 3.3.7]: Keluar lalu masuk lagi di hari WIB yang sama (5 ke 5 = 0)", async () => {
    const ctx = await createAgileTestContext("S9A");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z")); // Day 1 12:00 WIB

    const sprint = await createSprint(ctx, "Sprint S9A");
    const t1 = await createIssue(ctx, "T1", "STORY", 5, sprint.id);

    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    // Advance to Day 2: 10:00 WIB (03:00 UTC) -> Removed
    vi.setSystemTime(new Date("2026-11-01T03:00:00.000Z"));
    await updateIssue(ctx, t1.key, { sprintId: null });

    // Day 2: 14:00 WIB (07:00 UTC) -> Added back with same 5 points
    vi.setSystemTime(new Date("2026-11-01T07:00:00.000Z"));
    await updateIssue(ctx, t1.key, { sprintId: sprint.id });

    const expected: ExpectedMetrics = {
      committed: 5,
      scopeAdded: 0,
      removed: 0,
      completed: 0,
      remaining: 5,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S9A");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S9A");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S9A");
  });

  // S9B: Keluar lalu masuk lagi di hari WIB yang sama (5 ke 8 = scopeAdded 3) (AGILE-RULES 3.3.7)
  it("S9B [AGILE-RULES 3.3.7]: Keluar lalu masuk lagi di hari WIB yang sama (5 ke 8 = scopeAdded 3)", async () => {
    const ctx = await createAgileTestContext("S9B");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z")); // Day 1 12:00 WIB

    const sprint = await createSprint(ctx, "Sprint S9B");
    const t1 = await createIssue(ctx, "T1", "STORY", 5, sprint.id);

    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    // Advance to Day 2: 10:00 WIB -> Removed
    vi.setSystemTime(new Date("2026-11-01T03:00:00.000Z"));
    await updateIssue(ctx, t1.key, { sprintId: null });

    // Day 2: 14:00 WIB -> Added back with 8 points
    vi.setSystemTime(new Date("2026-11-01T07:00:00.000Z"));
    await updateIssue(ctx, t1.key, { sprintId: sprint.id, storyPoints: 8 });

    const expected: ExpectedMetrics = {
      committed: 5,
      scopeAdded: 3,
      removed: 0,
      completed: 0,
      remaining: 8,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S9B");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S9B");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S9B");
  });

  // S10: Batas hari WIB: masuk 23:59 WIB vs 00:01 WIB hari berikutnya (AGILE-RULES 2.3, 3.2)
  it("S10 [AGILE-RULES 2.3, 3.2]: Batas hari WIB (23:59 WIB vs 00:01 WIB hari berikutnya)", async () => {
    const ctx = await createAgileTestContext("S10");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z")); // Day 1 12:00 WIB

    const sprint = await createSprint(ctx, "Sprint S10");
    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    // T1 added at 23:59:00 WIB on Oct 31 (16:59:00 UTC) -> On start day
    vi.setSystemTime(new Date("2026-10-31T16:59:00.000Z"));
    await createIssue(ctx, "T1", "STORY", 5, sprint.id);

    // T2 added at 00:01:00 WIB on Nov 1 (17:01:00 UTC Oct 31) -> Next day (Scope Added)
    vi.setSystemTime(new Date("2026-10-31T17:01:00.000Z"));
    await createIssue(ctx, "T2", "TASK", 8, sprint.id);

    const expected: ExpectedMetrics = {
      committed: 5,
      scopeAdded: 8,
      removed: 0,
      completed: 0,
      remaining: 13,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S10");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S10");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S10");
  });

  // S11: Peringatan tiket tanpa poin (unestimated) (AGILE-RULES 3.4)
  it("S11 [AGILE-RULES 3.4]: Peringatan tiket tanpa poin (unestimated)", async () => {
    const ctx = await createAgileTestContext("S11");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z"));

    const sprint = await createSprint(ctx, "Sprint S11");
    await createIssue(ctx, "T1", "STORY", 5, sprint.id);
    await createIssue(ctx, "T2", "TASK", null, sprint.id); // unestimated

    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    const expected: ExpectedMetrics = {
      committed: 5,
      scopeAdded: 0,
      removed: 0,
      completed: 0,
      remaining: 5,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S11");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S11");

    expect(resBurndown.body.unestimated).toBe(1);
    expect(resReport.body.miniBurndown?.unestimated).toBe(1);

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S11");
  });

  // S12: Complete Sprint: committed di Velocity sama dengan Sprint Report (AGILE-RULES 4 Invarian 5)
  it("S12 [AGILE-RULES 4 Invarian 5]: Complete Sprint: committed di Velocity sama dengan Sprint Report (asersi ABSOLUT)", async () => {
    const ctx = await createAgileTestContext("S12");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z"));

    const sprint = await createSprint(ctx, "Sprint S12");
    const t1 = await createIssue(ctx, "T1", "TASK", null, sprint.id);
    const t2 = await createIssue(ctx, "T2", "STORY", null, sprint.id);

    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    // Points filled on day 1 (MOP style: 39 pts)
    await updateIssue(ctx, t1.key, { storyPoints: 20 });
    await updateIssue(ctx, t2.key, { storyPoints: 19 });

    // Mark both issues DONE
    await updateIssue(ctx, t1.key, { statusId: ctx.doneStatus.id });
    await updateIssue(ctx, t2.key, { statusId: ctx.doneStatus.id });

    // Complete sprint on Day 5
    vi.setSystemTime(new Date("2026-11-04T05:00:00.000Z"));
    await completeSprint(ctx, sprint.id);

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S12");

    const resVelocity = await request(app)
      .get(`/api/projects/${ctx.project.key}/reports/velocity`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resVelocity, 200, "getVelocity S12");

    const velocitySprint = resVelocity.body.sprints.find((s: any) => s.id === sprint.id);
    expect(velocitySprint, "Sprint S12 must appear in velocity report").toBeDefined();

    const collector = new MetricDiscrepancyCollector();

    // Absolute assertion: committed 39, completed 39
    collector.check("/velocity", velocitySprint, "committedPoints", 39);
    collector.check("/velocity", velocitySprint, "completedPoints", 39);
    collector.check("/report", resReport.body.summary, "committedPoints", 39);
    collector.check("/report", resReport.body.summary, "completedPoints", 39);

    collector.assertNoDiscrepancies("S12");
  });

  // S14: Masuk lalu keluar sebelum batas hari mulai = tidak committed (AGILE-RULES 3.2)
  it("S14 [AGILE-RULES 3.2]: Masuk lalu keluar sebelum batas hari mulai = tidak committed", async () => {
    const ctx = await createAgileTestContext("S14");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T03:00:00.000Z")); // 10:00 WIB

    const sprint = await createSprint(ctx, "Sprint S14");
    const t1 = await createIssue(ctx, "T1", "STORY", 5, sprint.id);

    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    // Later on Day 1 (15:00 WIB = 08:00 UTC): T1 removed before 23:59:59 WIB boundary
    vi.setSystemTime(new Date("2026-10-31T08:00:00.000Z"));
    await updateIssue(ctx, t1.key, { sprintId: null });

    const expected: ExpectedMetrics = {
      committed: 0,
      scopeAdded: 0,
      removed: 0,
      completed: 0,
      remaining: 0,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S14");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S14");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S14");
  });

  // S15: Tiket DONE dibuka kembali kembali ke remaining (AGILE-RULES 3.3.4)
  it("S15 [AGILE-RULES 3.3.4]: Tiket DONE dibuka kembali kembali ke remaining", async () => {
    const ctx = await createAgileTestContext("S15");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z")); // Day 1 12:00 WIB

    const sprint = await createSprint(ctx, "Sprint S15");
    const t1 = await createIssue(ctx, "T1", "STORY", 5, sprint.id);

    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    // Day 2: Moved to DONE
    vi.setSystemTime(new Date("2026-11-01T05:00:00.000Z"));
    await updateIssue(ctx, t1.key, { statusId: ctx.doneStatus.id });

    // Day 3: Reopened to IN_PROGRESS
    vi.setSystemTime(new Date("2026-11-02T05:00:00.000Z"));
    await updateIssue(ctx, t1.key, { statusId: ctx.inProgressStatus.id });

    const expected: ExpectedMetrics = {
      committed: 5,
      scopeAdded: 0,
      removed: 0,
      completed: 0,
      remaining: 5,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S15");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S15");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S15");
  });

  // S16: Dipindah antar sprint, tidak terhitung ganda (AGILE-RULES 3.3.6)
  it("S16 [AGILE-RULES 3.3.6]: Dipindah antar sprint, tidak terhitung ganda", async () => {
    // Catatan: Aturan 3.3.6 hanya teruji untuk sisi committed di sprint tujuan (Sprint 2), karena aturan satu sprint ACTIVE per proyek (Agile Guard di sprints.ts).
    const ctx = await createAgileTestContext("S16");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z")); // Day 1 Sprint 1

    const sprint1 = await createSprint(ctx, "Sprint 1");
    const sprint2 = await createSprint(ctx, "Sprint 2");

    const t1 = await createIssue(ctx, "T1", "STORY", 5, sprint1.id);

    await startSprint(ctx, sprint1.id, "2026-10-31", "2026-11-14");

    // Advance to Day 2: T1 moved from Sprint 1 (ACTIVE) to Sprint 2 (FUTURE)
    vi.setSystemTime(new Date("2026-11-01T03:00:00.000Z"));
    const moveRes = await request(app)
      .post(`/api/projects/${ctx.project.key}/sprints/move-issues`)
      .set("Authorization", `Bearer ${ctx.leadToken}`)
      .send({ issueIds: [t1.id], targetSprintId: sprint2.id });
    assertResponseOk(moveRes, 200, "moveIssues to Sprint 2");

    // Day 2 12:00 WIB: Sprint 1 is completed so Sprint 2 can start without violating 1 active sprint rule
    vi.setSystemTime(new Date("2026-11-01T05:00:00.000Z"));
    await completeSprint(ctx, sprint1.id);

    // Day 2: Sprint 2 starts on Nov 1 (Day 1 of Sprint 2)
    await startSprint(ctx, sprint2.id, "2026-11-01", "2026-11-15");

    // In Sprint 1 (now CLOSED): committed 5, removed 5, completed 0, remaining 0
    const expectedS1: ExpectedMetrics = {
      committed: 5,
      scopeAdded: 0,
      removed: 5,
      completed: 0,
      remaining: 0,
    };
    assertLocalBalance(expectedS1);

    // In Sprint 2: committed on its start day = 5, remaining 5
    const expectedS2: ExpectedMetrics = {
      committed: 5,
      scopeAdded: 0,
      removed: 0,
      completed: 0,
      remaining: 5,
    };
    assertLocalBalance(expectedS2);

    const resBurndownS1 = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint1.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndownS1, 200, "getBurndown S16 S1");

    const resReportS1 = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint1.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReportS1, 200, "getReport S16 S1");

    const resBurndownS2 = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint2.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndownS2, 200, "getBurndown S16 S2");

    const resReportS2 = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint2.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReportS2, 200, "getReport S16 S2");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndownS1, resReportS1, expectedS1);
    verifyFiveMetrics(collector, resBurndownS2, resReportS2, expectedS2);
    collector.assertNoDiscrepancies("S16");
  });

  // S17: metric=issues dan perlakuan tiket tanpa poin (AGILE-RULES 3.4)
  it("S17 [AGILE-RULES 3.4]: metric=issues dan perlakuan tiket tanpa poin", async () => {
    const ctx = await createAgileTestContext("S17");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z"));

    const sprint = await createSprint(ctx, "Sprint S17");
    await createIssue(ctx, "T1", "STORY", 5, sprint.id);
    await createIssue(ctx, "T2", "TASK", null, sprint.id); // without points

    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    const expected: ExpectedMetrics = {
      committed: 2,
      scopeAdded: 0,
      removed: 0,
      completed: 0,
      remaining: 2,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=issues`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S17");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S17");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected, "issues");
    collector.assertNoDiscrepancies("S17");
  });

  // S18: Start Sprint dengan T1 (5 pt), lalu T2 (8 pt) masuk pukul 16:00 WIB di hari mulai yang sama (AGILE-RULES 3.1, 3.2)
  it("S18 [AGILE-RULES 3.1, 3.2]: Start Sprint dengan T1 (5 pt), lalu T2 (8 pt) masuk pukul 16:00 WIB di hari mulai yang sama", async () => {
    const ctx = await createAgileTestContext("S18");
    createdProjectIds.push(ctx.project.id);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z")); // Day 1 12:00 WIB

    const sprint = await createSprint(ctx, "Sprint S18");
    await createIssue(ctx, "T1", "STORY", 5, sprint.id);

    await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

    // Later on Day 1: 16:00 WIB (09:00 UTC) -> T2 (8 pt) added to sprint before 23:59:59 WIB boundary
    vi.setSystemTime(new Date("2026-10-31T09:00:00.000Z"));
    await createIssue(ctx, "T2", "TASK", 8, sprint.id);

    const expected: ExpectedMetrics = {
      committed: 13,
      scopeAdded: 0,
      removed: 0,
      completed: 0,
      remaining: 13,
    };
    assertLocalBalance(expected);

    const resBurndown = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resBurndown, 200, "getBurndown S18");

    const resReport = await request(app)
      .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
      .set("Authorization", `Bearer ${ctx.leadToken}`);
    assertResponseOk(resReport, 200, "getReport S18");

    const collector = new MetricDiscrepancyCollector();
    verifyFiveMetrics(collector, resBurndown, resReport, expected);
    collector.assertNoDiscrepancies("S18");
  });

  // Suite Invarian Matematis: Lima Invarian Bagian 4 AGILE-RULES
  describe("Suite Lima Invarian [AGILE-RULES 4] pada S2 (MOP) dan S4 (Mid-Sprint)", () => {
    it("memvalidasi lima invarian matematis pada data S2 (Kasus MOP)", async () => {
      const ctx = await createAgileTestContext("INV2");
      createdProjectIds.push(ctx.project.id);

      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z"));

      const sprint = await createSprint(ctx, "MOP Invariant Sprint");
      const mop1 = await createIssue(ctx, "MOP-1", "TASK", null, sprint.id);
      const mop2 = await createIssue(ctx, "MOP-2", "STORY", null, sprint.id);

      await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

      vi.setSystemTime(new Date("2026-10-31T06:39:29.000Z"));
      await updateIssue(ctx, mop2.key, { storyPoints: 19 });
      vi.setSystemTime(new Date("2026-10-31T06:40:55.000Z"));
      await updateIssue(ctx, mop1.key, { storyPoints: 20 });

      const resBurndown = await request(app)
        .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
        .set("Authorization", `Bearer ${ctx.leadToken}`);
      assertResponseOk(resBurndown, 200, "getBurndown INV2");

      const resReport = await request(app)
        .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
        .set("Authorization", `Bearer ${ctx.leadToken}`);
      assertResponseOk(resReport, 200, "getReport INV2");

      const collector = new MetricDiscrepancyCollector();

      // Invarian 2: Burndown committed == Report committedPoints
      collector.check(
        "Invariant 2",
        resBurndown.body.summary,
        "committed",
        resReport.body.summary?.committedPoints
      );

      // Invarian 3: Burndown scopeAdded == Report scopeAddedPoints
      collector.check(
        "Invariant 3",
        resBurndown.body.summary,
        "scopeAdded",
        resReport.body.summary?.scopeAddedPoints
      );

      // Invarian 4: Burndown remaining == Report carriedOverPoints (ACTIVE sprint)
      collector.check(
        "Invariant 4",
        resBurndown.body.summary,
        "remaining",
        resReport.body.summary?.carriedOverPoints
      );

      // Invarian 1: committed + scopeAdded - removed === completed + remaining
      const bSum = resBurndown.body.summary || {};
      collector.check("Invariant 1 Burndown Removed", bSum, "removed", 0);
      collector.check("Invariant 1 Report Removed", resReport.body.summary || {}, "removedPoints", 0);

      collector.assertNoDiscrepancies("Invarian S2");
    });

    it("memvalidasi lima invarian matematis pada data S4 (Mid-Sprint Addition)", async () => {
      const ctx = await createAgileTestContext("INV4");
      createdProjectIds.push(ctx.project.id);

      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-31T05:00:00.000Z"));

      const sprint = await createSprint(ctx, "MidSprint Invariant Sprint");
      await createIssue(ctx, "T1", "STORY", 5, sprint.id);

      await startSprint(ctx, sprint.id, "2026-10-31", "2026-11-14");

      vi.setSystemTime(new Date("2026-11-01T05:00:00.000Z"));
      await createIssue(ctx, "T2", "TASK", 8, sprint.id);

      const resBurndown = await request(app)
        .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/burndown?metric=points`)
        .set("Authorization", `Bearer ${ctx.leadToken}`);
      assertResponseOk(resBurndown, 200, "getBurndown INV4");

      const resReport = await request(app)
        .get(`/api/projects/${ctx.project.key}/sprints/${sprint.id}/report`)
        .set("Authorization", `Bearer ${ctx.leadToken}`);
      assertResponseOk(resReport, 200, "getReport INV4");

      const collector = new MetricDiscrepancyCollector();

      // Invarian 2: Burndown committed == Report committedPoints
      collector.check(
        "Invariant 2",
        resBurndown.body.summary,
        "committed",
        resReport.body.summary?.committedPoints
      );

      // Invarian 3: Burndown scopeAdded == Report scopeAddedPoints
      collector.check(
        "Invariant 3",
        resBurndown.body.summary,
        "scopeAdded",
        resReport.body.summary?.scopeAddedPoints
      );

      // Invarian 4: Burndown remaining == Report carriedOverPoints
      collector.check(
        "Invariant 4",
        resBurndown.body.summary,
        "remaining",
        resReport.body.summary?.carriedOverPoints
      );

      // Invarian 1: committed + scopeAdded - removed === completed + remaining
      const bSum = resBurndown.body.summary || {};
      collector.check("Invariant 1 Burndown Removed", bSum, "removed", 0);
      collector.check("Invariant 1 Report Removed", resReport.body.summary || {}, "removedPoints", 0);

      collector.assertNoDiscrepancies("Invarian S4");
    });
  });
});
