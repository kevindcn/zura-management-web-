import { describe, it, expect } from "vitest";
import { computeBurndown, classifySprintIssues, BurndownIssueEvent, BurndownSprintInput } from "../src/lib/burndown.js";

describe("Burndown Calculator (computeBurndown Unit Tests)", () => {
  const baseSprint: BurndownSprintInput = {
    id: "sprint-1",
    name: "Sprint 1",
    state: "ACTIVE",
    startDate: "2026-11-01T00:00:00Z",
    endDate: "2026-11-05T00:00:00Z", // 5 days: 2026-11-01 to 2026-11-05
    committedPoints: 20,
    committedIssues: 4,
  };

  it("handles a normal sprint where tickets are completed progressively", () => {
    // Initial 4 tickets of 5 points each = 20 points
    const events: BurndownIssueEvent[] = [
      { issueId: "iss-1", eventType: "ADDED_TO_SPRINT", points: 5, category: "TO_DO", createdAt: "2026-11-01T02:00:00Z" },
      { issueId: "iss-2", eventType: "ADDED_TO_SPRINT", points: 5, category: "TO_DO", createdAt: "2026-11-01T02:00:00Z" },
      { issueId: "iss-3", eventType: "ADDED_TO_SPRINT", points: 5, category: "TO_DO", createdAt: "2026-11-01T02:00:00Z" },
      { issueId: "iss-4", eventType: "ADDED_TO_SPRINT", points: 5, category: "TO_DO", createdAt: "2026-11-01T02:00:00Z" },
      // Day 2 (Nov 2): iss-1 completed
      { issueId: "iss-1", eventType: "STATUS_CHANGED", category: "DONE", previousCategory: "TO_DO", createdAt: "2026-11-02T05:00:00Z" },
      // Day 3 (Nov 3): iss-2 completed
      { issueId: "iss-2", eventType: "STATUS_CHANGED", category: "DONE", previousCategory: "TO_DO", createdAt: "2026-11-03T05:00:00Z" },
    ];

    const result = computeBurndown(events, baseSprint, "points", "2026-11-03");

    expect(result.summary.committed).toBe(20);
    expect(result.summary.completed).toBe(10);
    expect(result.summary.remaining).toBe(10);
    expect(result.summary.scopeAdded).toBe(0);

    // Day 1 (Nov 1): Scope 20, Done 0, Remaining 20, Ideal 20
    expect(result.days[0].remaining).toBe(20);
    expect(result.days[0].done).toBe(0);
    expect(result.days[0].ideal).toBe(20);

    // Day 2 (Nov 2): Scope 20, Done 5, Remaining 15
    expect(result.days[1].remaining).toBe(15);
    expect(result.days[1].done).toBe(5);

    // Day 3 (Nov 3 - Today): Scope 20, Done 10, Remaining 10
    expect(result.days[2].remaining).toBe(10);
    expect(result.days[2].done).toBe(10);

    // Day 4 & 5 (Future days): remaining is null
    expect(result.days[3].remaining).toBeNull();
    expect(result.days[4].remaining).toBeNull();
  });

  it("handles scope creep correctly when a new ticket is added mid-sprint", () => {
    const events: BurndownIssueEvent[] = [
      { issueId: "iss-1", eventType: "ADDED_TO_SPRINT", points: 10, category: "TO_DO", createdAt: "2026-11-01T02:00:00Z" },
      // Mid-sprint on Nov 2: New ticket with 5 points added
      { issueId: "iss-2", eventType: "ADDED_TO_SPRINT", points: 5, category: "TO_DO", createdAt: "2026-11-02T06:00:00Z" },
    ];

    const sprint = { ...baseSprint, committedPoints: 10 };
    const result = computeBurndown(events, sprint, "points", "2026-11-03");

    // Scope increased to 15, so scopeAdded is 5
    expect(result.summary.scopeAdded).toBe(5);
    expect(result.days[0].scope).toBe(10);
    expect(result.days[1].scope).toBe(15);
    expect(result.days[1].remaining).toBe(15);
  });

  it("correctly handles reopened tickets (remaining increases back)", () => {
    const events: BurndownIssueEvent[] = [
      { issueId: "iss-1", eventType: "ADDED_TO_SPRINT", points: 5, category: "TO_DO", createdAt: "2026-11-01T02:00:00Z" },
      // Nov 2: Completed
      { issueId: "iss-1", eventType: "STATUS_CHANGED", category: "DONE", previousCategory: "TO_DO", createdAt: "2026-11-02T04:00:00Z" },
      // Nov 3: Reopened to IN_PROGRESS
      { issueId: "iss-1", eventType: "STATUS_CHANGED", category: "IN_PROGRESS", previousCategory: "DONE", createdAt: "2026-11-03T04:00:00Z" },
    ];

    const sprint = { ...baseSprint, committedPoints: 5 };
    const result = computeBurndown(events, sprint, "points", "2026-11-03");

    // On Nov 2: Done 5, Remaining 0
    expect(result.days[1].done).toBe(5);
    expect(result.days[1].remaining).toBe(0);

    // On Nov 3 (reopened): Done 0, Remaining 5
    expect(result.days[2].done).toBe(0);
    expect(result.days[2].remaining).toBe(5);
    expect(result.summary.remaining).toBe(5);
  });

  it("correctly recalculates when story points change mid-sprint", () => {
    const events: BurndownIssueEvent[] = [
      { issueId: "iss-1", eventType: "ADDED_TO_SPRINT", points: 3, category: "TO_DO", createdAt: "2026-11-01T02:00:00Z" },
      // Nov 2: Point re-estimated from 3 to 8
      { issueId: "iss-1", eventType: "POINTS_CHANGED", points: 8, previousPoints: 3, createdAt: "2026-11-02T03:00:00Z" },
    ];

    const sprint = { ...baseSprint, committedPoints: 3 };
    const result = computeBurndown(events, sprint, "points", "2026-11-02");

    expect(result.days[0].scope).toBe(3);
    expect(result.days[1].scope).toBe(8);
    expect(result.days[1].remaining).toBe(8);
    expect(result.summary.scopeAdded).toBe(5);
  });

  it("correctly decreases scope when a ticket is removed from sprint", () => {
    const events: BurndownIssueEvent[] = [
      { issueId: "iss-1", eventType: "ADDED_TO_SPRINT", points: 5, category: "TO_DO", createdAt: "2026-11-01T02:00:00Z" },
      { issueId: "iss-2", eventType: "ADDED_TO_SPRINT", points: 5, category: "TO_DO", createdAt: "2026-11-01T02:00:00Z" },
      // Nov 2: iss-2 removed to backlog
      { issueId: "iss-2", eventType: "REMOVED_FROM_SPRINT", createdAt: "2026-11-02T03:00:00Z" },
    ];

    const sprint = { ...baseSprint, committedPoints: 10 };
    const result = computeBurndown(events, sprint, "points", "2026-11-02");

    expect(result.days[0].scope).toBe(10);
    expect(result.days[1].scope).toBe(5);
    expect(result.days[1].remaining).toBe(5);
  });

  it("supports issues metric (issue count mode)", () => {
    const events: BurndownIssueEvent[] = [
      { issueId: "iss-1", eventType: "ADDED_TO_SPRINT", points: 8, category: "TO_DO", createdAt: "2026-11-01T02:00:00Z" },
      { issueId: "iss-2", eventType: "ADDED_TO_SPRINT", points: 1, category: "TO_DO", createdAt: "2026-11-01T02:00:00Z" },
      { issueId: "iss-3", eventType: "ADDED_TO_SPRINT", points: 2, category: "TO_DO", createdAt: "2026-11-01T02:00:00Z" },
      { issueId: "iss-4", eventType: "ADDED_TO_SPRINT", points: 3, category: "TO_DO", createdAt: "2026-11-01T02:00:00Z" },
      // Nov 2: iss-1 marked DONE
      { issueId: "iss-1", eventType: "STATUS_CHANGED", category: "DONE", previousCategory: "TO_DO", createdAt: "2026-11-02T04:00:00Z" },
    ];

    const result = computeBurndown(events, baseSprint, "issues", "2026-11-02");

    expect(result.summary.committed).toBe(4);
    // On Nov 2: 1 issue done, 3 remaining (out of 4 in sprint)
    expect(result.days[1].done).toBe(1);
    expect(result.days[1].remaining).toBe(3);
  });

  it("handles sprint with zero events gracefully without crashing", () => {
    const emptySprint: BurndownSprintInput = {
      id: "empty-sprint",
      name: "Empty Sprint",
      state: "ACTIVE",
      startDate: "2026-11-01T00:00:00Z",
      endDate: "2026-11-05T00:00:00Z",
      committedPoints: 0,
      committedIssues: 0,
    };

    const result = computeBurndown([], emptySprint, "points", "2026-11-01");

    expect(result.summary.committed).toBe(0);
    expect(result.summary.completed).toBe(0);
    expect(result.summary.remaining).toBe(0);
    expect(result.summary.scopeAdded).toBe(0);
    expect(result.days.length).toBe(5);
  });
});

describe("classifySprintIssues Unit Tests", () => {
  it("strictly enforces Asia/Jakarta midnight boundary: 16:59:59Z is committed, 17:00:00Z is scope added", () => {
    // Sprint starts on 2026-11-01 (Asia/Jakarta UTC+7)
    // 2026-11-01 23:59:59.999 WIB is 2026-11-01T16:59:59.999Z
    // 2026-11-02 00:00:00.000 WIB is 2026-11-01T17:00:00.000Z
    const sprint = {
      startDate: "2026-11-01T00:00:00.000Z",
      startedAt: null,
      committedPoints: 0,
      committedIssues: 0,
    };

    const eligibleIssues = [
      { id: "iss-boundary-committed", storyPoints: 3, status: { category: "TO_DO" } },
      { id: "iss-boundary-scoped", storyPoints: 5, status: { category: "TO_DO" } },
    ];

    const events = [
      {
        issueId: "iss-boundary-committed",
        eventType: "ADDED_TO_SPRINT",
        points: 3,
        createdAt: "2026-11-01T16:59:59.000Z", // 23:59:59 WIB -> COMMITTED
      },
      {
        issueId: "iss-boundary-scoped",
        eventType: "ADDED_TO_SPRINT",
        points: 5,
        createdAt: "2026-11-01T17:00:00.000Z", // 00:00:00 WIB (Next day) -> SCOPE ADDED
      },
    ];

    const res = classifySprintIssues({ sprint, events, eligibleIssues });

    expect(res.isIssueAddedMidSprint("iss-boundary-committed")).toBe(false);
    expect(res.isIssueAddedMidSprint("iss-boundary-scoped")).toBe(true);

    expect(res.committedPoints).toBe(3);
    expect(res.committedIssuesCount).toBe(1);
    expect(res.scopeAddedPoints).toBe(5);
    expect(res.scopeAddedIssuesCount).toBe(1);
    expect(res.carriedOverPoints).toBe(8);
  });
});

