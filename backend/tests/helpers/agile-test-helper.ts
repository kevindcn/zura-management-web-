import { expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { generateToken } from "../../src/lib/jwt.js";

export interface ExpectedMetrics {
  committed: number;
  scopeAdded: number;
  removed: number;
  completed: number;
  remaining: number;
}

export interface Discrepancy {
  endpoint: string;
  field: string;
  expected: any;
  actual: any;
  category: "[FIELD_MISSING]" | "[VALUE_MISMATCH]";
}

export class MetricDiscrepancyCollector {
  private discrepancies: Discrepancy[] = [];

  check(
    endpoint: string,
    actualContainer: any,
    actualField: string,
    expectedVal: any
  ) {
    if (
      actualContainer === undefined ||
      actualContainer === null ||
      actualContainer[actualField] === undefined
    ) {
      this.discrepancies.push({
        endpoint,
        field: actualField,
        expected: expectedVal,
        actual: undefined,
        category: "[FIELD_MISSING]",
      });
      return;
    }

    const actualVal = actualContainer[actualField];
    if (actualVal !== expectedVal) {
      this.discrepancies.push({
        endpoint,
        field: actualField,
        expected: expectedVal,
        actual: actualVal,
        category: "[VALUE_MISMATCH]",
      });
    }
  }

  assertNoDiscrepancies(scenarioName: string) {
    if (this.discrepancies.length > 0) {
      const messages = this.discrepancies.map(
        (d) =>
          `${d.category} [${d.endpoint}][${d.field}] expected ${d.expected}, actual ${d.actual}`
      );
      throw new Error(
        `\n[SCENARIO FAILURE: ${scenarioName}]\n` + messages.join("\n")
      );
    }
  }
}

export function assertResponseOk(
  res: request.Response,
  expectedStatus: number,
  actionName: string
) {
  if (res.status !== expectedStatus) {
    const errorBody =
      typeof res.body === "object" ? JSON.stringify(res.body) : res.text;
    throw new Error(
      `[TEST_INFRA] ${actionName} failed with HTTP ${res.status} (expected ${expectedStatus}): ${errorBody}`
    );
  }
}

export function assertLocalBalance(expected: ExpectedMetrics) {
  const left = expected.committed + expected.scopeAdded - expected.removed;
  const right = expected.completed + expected.remaining;
  expect(
    left,
    `Local sanity check failed: committed(${expected.committed}) + scopeAdded(${expected.scopeAdded}) - removed(${expected.removed}) !== completed(${expected.completed}) + remaining(${expected.remaining})`
  ).toBe(right);
}

export interface AgileTestContext {
  leadUser: any;
  leadToken: string;
  project: any;
  todoStatus: any;
  inProgressStatus: any;
  doneStatus: any;
}

export async function createAgileTestContext(
  prefix: string
): Promise<AgileTestContext> {
  const runId = Math.floor(Math.random() * 899999 + 100000);
  try {
    const user = await prisma.user.create({
      data: {
        name: `Lead ${prefix}`,
        email: `${prefix.toLowerCase()}_${runId}@test.local`,
        passwordHash: "hash123",
      },
    });

    const token = generateToken(user);

    const project = await prisma.project.create({
      data: {
        name: `Project ${prefix}`,
        key: `${prefix.slice(0, 4).toUpperCase()}${runId.toString().slice(-2)}`,
        leadId: user.id,
        statuses: {
          create: [
            { name: "To Do", category: "TO_DO", position: 1000 },
            { name: "In Progress", category: "IN_PROGRESS", position: 2000 },
            { name: "Done", category: "DONE", position: 3000 },
          ],
        },
        members: {
          create: [{ userId: user.id, role: "ADMIN" }],
        },
      },
      include: {
        statuses: true,
      },
    });

    const todoStatus = project.statuses.find((s) => s.category === "TO_DO")!;
    const inProgressStatus = project.statuses.find(
      (s) => s.category === "IN_PROGRESS"
    )!;
    const doneStatus = project.statuses.find((s) => s.category === "DONE")!;

    return {
      leadUser: user,
      leadToken: token,
      project,
      todoStatus,
      inProgressStatus,
      doneStatus,
    };
  } catch (err: any) {
    throw new Error(
      `[TEST_INFRA] Failed to initialize test context for ${prefix}: ${err.message}`
    );
  }
}

export async function cleanupAgileTestContext(projectId: string) {
  try {
    await prisma.sprintIssueResult.deleteMany({
      where: { sprint: { projectId } },
    });
    await prisma.issueEvent.deleteMany({
      where: { issue: { projectId } },
    });
    await prisma.activity.deleteMany({
      where: { issue: { projectId } },
    });
    await prisma.comment.deleteMany({
      where: { issue: { projectId } },
    });
    await prisma.issueWatcher.deleteMany({
      where: { issue: { projectId } },
    });
    await prisma.issue.deleteMany({
      where: { projectId },
    });
    await prisma.sprint.deleteMany({
      where: { projectId },
    });
    await prisma.status.deleteMany({
      where: { projectId },
    });
    await prisma.projectMember.deleteMany({
      where: { projectId },
    });
    const proj = await prisma.project.delete({
      where: { id: projectId },
    });
    if (proj?.leadId) {
      await prisma.user.delete({ where: { id: proj.leadId } }).catch(() => {});
    }
  } catch (err) {
    // Best-effort cleanup
  }
}
