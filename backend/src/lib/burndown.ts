export interface BurndownIssueEvent {
  id?: string;
  issueId: string;
  sprintId?: string | null;
  eventType: string; // ADDED_TO_SPRINT, REMOVED_FROM_SPRINT, POINTS_CHANGED, STATUS_CHANGED
  points?: number | null;
  previousPoints?: number | null;
  category?: string | null; // TO_DO, IN_PROGRESS, DONE
  previousCategory?: string | null;
  createdAt: Date | string;
}

export interface AgileSprintInput {
  id?: string;
  name?: string;
  state: string; // ACTIVE, CLOSED, FUTURE
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  startedAt?: Date | string | null;
  closedAt?: Date | string | null;
  createdAt?: Date | string | null;
  committedPoints?: number | null;
  committedIssues?: number | null;
  completedPoints?: number | null;
  completedIssues?: number | null;
}

export type BurndownSprintInput = AgileSprintInput & {
  id: string;
  name: string;
};

export interface BurndownDayResult {
  date: string; // YYYY-MM-DD
  dayIndex: number;
  ideal: number;
  scope: number;
  done: number | null;
  remaining: number | null;
  isToday: boolean;
  isFuture: boolean;
}

export interface BurndownResult {
  sprint: {
    id: string;
    name: string;
    state: string;
  };
  metric: "points" | "issues";
  unestimated: number;
  summary: {
    committed: number;
    completed: number;
    remaining: number;
    scopeAdded: number;
    removed: number;
  };
  days: BurndownDayResult[];
}

export interface AgileMetricsSummary {
  committed: number;
  scopeAdded: number;
  removed: number;
  completed: number;
  remaining: number;

  committedPoints: number;
  committedIssues: number;
  completedPoints: number;
  completedIssues: number;
  scopeAddedPoints: number;
  scopeAddedIssues: number;
  removedPoints: number;
  removedIssues: number;
  carriedOverPoints: number;
  carriedOverIssues: number;
  completionRate: number | null;
}

export interface AgileMetricsInput<T = any> {
  sprint: AgileSprintInput;
  events: BurndownIssueEvent[];
  eligibleIssues?: T[];
  metric?: "points" | "issues";
  referenceTodayJakarta?: string;
}

export interface AgileSprintMetricsResult<T = any> {
  sprint: {
    id: string;
    name: string;
    state: string;
  };
  metric: "points" | "issues";
  unestimated: number;
  summary: AgileMetricsSummary;
  days: BurndownDayResult[];
  committedIssuesList: T[];
  addedMidSprintIssuesList: T[];
  completedIssuesList: T[];
  notCompletedIssuesList: T[];
  removedFromSprintIssuesList: Array<{ issueId: string; storyPoints: number }>;
  isIssueAddedMidSprint: (issueId: string) => boolean;
}

/**
 * Returns date formatted as YYYY-MM-DD in Asia/Jakarta timezone (UTC+7)
 */
export function getJakartaDateString(date: Date | string | number): string {
  const d = typeof date === "object" ? date : new Date(date);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Convert a YYYY-MM-DD string in Asia/Jakarta to the end of that day timestamp (23:59:59.999 UTC+7)
 */
export function getJakartaEndOfDayTimestamp(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  // 23:59:59.999 in UTC+7 is 16:59:59.999 UTC
  return Date.UTC(year, month - 1, day, 16, 59, 59, 999);
}

/**
 * Generates an inclusive range of YYYY-MM-DD strings
 */
export function generateDateRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const [sY, sM, sD] = startStr.split("-").map(Number);
  const [eY, eM, eD] = endStr.split("-").map(Number);

  let current = new Date(Date.UTC(sY, sM - 1, sD));
  const end = new Date(Date.UTC(eY, eM - 1, eD));

  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, "0");
    const d = String(current.getUTCDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates.length > 0 ? dates : [startStr];
}

/**
 * Single source of truth calculation engine for Agile Sprint Metrics.
 * Adheres to docs/AGILE-RULES.md specifications.
 */
export function computeAgileSprintMetrics<T extends { id: string; type?: string; storyPoints?: number | null; status?: any; createdAt?: Date | string } = any>(
  input: AgileMetricsInput<T>
): AgileSprintMetricsResult<T> {
  const { sprint, events, eligibleIssues, metric = "points", referenceTodayJakarta } = input;

  // 1. Determine sprint start day in Asia/Jakarta timezone (WIB)
  // Fallback hierarchy: startedAt -> startDate -> createdAt (ACTIVE and CLOSED only)
  let rawStart: Date | string | null = sprint.startedAt || sprint.startDate || null;
  if (!rawStart && sprint.state !== "FUTURE" && sprint.createdAt) {
    rawStart = sprint.createdAt;
  }
  if (!rawStart) {
    rawStart = new Date();
  }

  const startDateStr = getJakartaDateString(rawStart);
  const startDayEndTs = getJakartaEndOfDayTimestamp(startDateStr);

  // 2. Determine sprint end day in Asia/Jakarta timezone
  const rawEnd = sprint.endDate || (sprint.closedAt ? sprint.closedAt : null);
  let endDateStr: string;
  if (rawEnd) {
    endDateStr = getJakartaDateString(rawEnd);
    if (endDateStr < startDateStr) {
      endDateStr = startDateStr;
    }
  } else {
    // Default 14 days sprint duration if no end date provided
    const defaultEnd = new Date(new Date(rawStart).getTime() + 13 * 24 * 60 * 60 * 1000);
    endDateStr = getJakartaDateString(defaultEnd);
  }

  const dateList = generateDateRange(startDateStr, endDateStr);
  const totalDays = dateList.length;
  const todayJakarta = referenceTodayJakarta || getJakartaDateString(new Date());

  // 3. Evaluation cut-off date:
  // For ACTIVE sprints, evaluate up to today (or end date if today > end date, or start date if today < start date)
  // For CLOSED sprints, evaluate across the sprint duration
  const evalDateStr = sprint.state === "ACTIVE"
    ? (todayJakarta < startDateStr ? startDateStr : (todayJakarta > endDateStr ? endDateStr : todayJakarta))
    : endDateStr;

  // Chronologically sort events
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Issue state tracking
  interface IssueTrackingState {
    inSprint: boolean;
    points: number;
    hasEstimatedPoints: boolean;
    category: string; // TO_DO, IN_PROGRESS, DONE
  }
  const issuesMap = new Map<string, IssueTrackingState>();

  // Track previous day state per issue for net daily mutation
  const prevDayPointsMap = new Map<string, number>();
  const prevDayInSprintMap = new Map<string, number>();

  let cumulativeScopeAddedPoints = 0;
  let cumulativeRemovedPoints = 0;
  let cumulativeScopeAddedIssues = 0;
  let cumulativeRemovedIssues = 0;

  const inSprintOnDay0 = new Set<string>();
  const addedAfterDay0 = new Set<string>();

  let eventIdx = 0;
  const days: BurndownDayResult[] = [];

  let day0CommittedPoints = 0;
  let day0CommittedIssues = 0;

  // Snapshot of active issues at evaluation cut-off date
  let evalActiveIssues: IssueTrackingState[] = [];
  let unestimatedCount = 0;

  dateList.forEach((dateStr, idx) => {
    const dayEndTs = getJakartaEndOfDayTimestamp(dateStr);

    // Apply all events up to the end of this day
    while (
      eventIdx < sortedEvents.length &&
      new Date(sortedEvents[eventIdx].createdAt).getTime() <= dayEndTs
    ) {
      const e = sortedEvents[eventIdx];
      const existing = issuesMap.get(e.issueId);

      switch (e.eventType) {
        case "ADDED_TO_SPRINT":
          if (idx > 0) {
            addedAfterDay0.add(e.issueId);
          }
          issuesMap.set(e.issueId, {
            inSprint: true,
            points: e.points !== undefined && e.points !== null ? e.points : (existing?.points ?? 0),
            hasEstimatedPoints: e.points !== null && e.points !== undefined ? true : (existing?.hasEstimatedPoints ?? false),
            category: e.category || existing?.category || "TO_DO",
          });
          break;

        case "REMOVED_FROM_SPRINT":
          if (existing) {
            existing.inSprint = false;
          }
          break;

        case "POINTS_CHANGED":
          if (existing) {
            existing.points = e.points ?? 0;
            existing.hasEstimatedPoints = e.points !== null && e.points !== undefined;
          } else {
            issuesMap.set(e.issueId, {
              inSprint: true,
              points: e.points ?? 0,
              hasEstimatedPoints: e.points !== null && e.points !== undefined,
              category: "TO_DO",
            });
          }
          break;

        case "STATUS_CHANGED":
          if (existing) {
            if (e.category) existing.category = e.category;
          } else {
            issuesMap.set(e.issueId, {
              inSprint: true,
              points: 0,
              hasEstimatedPoints: false,
              category: e.category || "TO_DO",
            });
          }
          break;
      }
      eventIdx++;
    }

    // Active issues on this day
    const activeIssues = Array.from(issuesMap.values()).filter((i) => i.inSprint);

    let dayScope = 0;
    let dayDone = 0;

    if (metric === "points") {
      dayScope = activeIssues.reduce((sum, i) => sum + (i.points || 0), 0);
      dayDone = activeIssues
        .filter((i) => i.category === "DONE")
        .reduce((sum, i) => sum + (i.points || 0), 0);
    } else {
      dayScope = activeIssues.length;
      dayDone = activeIssues.filter((i) => i.category === "DONE").length;
    }

    // Day 0: calculate baseline committed at 23:59:59.999 WIB
    if (idx === 0) {
      for (const [id, st] of issuesMap.entries()) {
        if (st.inSprint) {
          day0CommittedPoints += st.points || 0;
          day0CommittedIssues += 1;
          inSprintOnDay0.add(id);
          prevDayPointsMap.set(id, st.points || 0);
          prevDayInSprintMap.set(id, 1);
        } else {
          prevDayPointsMap.set(id, 0);
          prevDayInSprintMap.set(id, 0);
        }
      }
    } else {
      // Days after Day 0: calculate net daily mutations per ticket up to evalDateStr
      if (dateStr <= evalDateStr) {
        for (const [id, st] of issuesMap.entries()) {
          const currentPts = st.inSprint ? (st.points || 0) : 0;
          const prevPts = prevDayPointsMap.get(id) ?? 0;
          const deltaPts = currentPts - prevPts;
          if (deltaPts > 0) {
            cumulativeScopeAddedPoints += deltaPts;
          } else if (deltaPts < 0) {
            cumulativeRemovedPoints += Math.abs(deltaPts);
          }
          prevDayPointsMap.set(id, currentPts);

          const currentIn = st.inSprint ? 1 : 0;
          const prevIn = prevDayInSprintMap.get(id) ?? 0;
          const deltaIn = currentIn - prevIn;
          if (deltaIn > 0) {
            cumulativeScopeAddedIssues += deltaIn;
          } else if (deltaIn < 0) {
            cumulativeRemovedIssues += Math.abs(deltaIn);
          }
          prevDayInSprintMap.set(id, currentIn);
        }
      }
    }

    // Capture state at evaluation cut-off date
    if (dateStr === evalDateStr) {
      evalActiveIssues = Array.from(issuesMap.values()).filter((i) => i.inSprint);
      unestimatedCount = evalActiveIssues.filter((i) => !i.hasEstimatedPoints).length;
    }

    // Baseline committed for ideal line:
    let idealBaseline = 0;
    if (sprint.state === "ACTIVE") {
      idealBaseline = metric === "points" ? day0CommittedPoints : day0CommittedIssues;
    } else if (sprint.state === "CLOSED") {
      const snap = metric === "points" ? sprint.committedPoints : sprint.committedIssues;
      idealBaseline = snap !== null && snap !== undefined ? snap : (metric === "points" ? day0CommittedPoints : day0CommittedIssues);
    }

    const idealVal = totalDays > 1 ? idealBaseline * (1 - idx / (totalDays - 1)) : 0;
    const ideal = Math.max(0, Math.round(idealVal * 10) / 10);

    const isToday = dateStr === todayJakarta;
    const isFuture = sprint.state === "ACTIVE" && dateStr > todayJakarta;

    let dayRemaining: number | null = null;
    let doneVal: number | null = null;

    if (isFuture) {
      dayRemaining = null;
      doneVal = null;
    } else {
      dayRemaining = Math.max(0, dayScope - dayDone);
      doneVal = dayDone;
    }

    days.push({
      date: dateStr,
      dayIndex: idx,
      ideal,
      scope: dayScope,
      done: doneVal,
      remaining: dayRemaining,
      isToday,
      isFuture,
    });
  });

  // If evalDateStr wasn't in dateList (e.g. todayJakarta < startDateStr), capture day 0 active issues
  if (evalActiveIssues.length === 0 && dateList.length > 0 && todayJakarta < startDateStr) {
    evalActiveIssues = Array.from(issuesMap.values()).filter((i) => i.inSprint);
    unestimatedCount = evalActiveIssues.filter((i) => !i.hasEstimatedPoints).length;
  }

  // 4. Baseline committed per AGILE-RULES
  let committedPoints = 0;
  let committedIssues = 0;

  if (sprint.state === "ACTIVE") {
    // Snapshot sprint.committedPoints is IGNORED for ACTIVE sprints
    committedPoints = day0CommittedPoints;
    committedIssues = day0CommittedIssues;
  } else if (sprint.state === "CLOSED") {
    committedPoints = sprint.committedPoints !== null && sprint.committedPoints !== undefined
      ? sprint.committedPoints
      : day0CommittedPoints;
    committedIssues = sprint.committedIssues !== null && sprint.committedIssues !== undefined
      ? sprint.committedIssues
      : day0CommittedIssues;
  } else {
    // FUTURE: committed, scopeAdded, removed are all 0
    committedPoints = 0;
    committedIssues = 0;
    cumulativeScopeAddedPoints = 0;
    cumulativeScopeAddedIssues = 0;
    cumulativeRemovedPoints = 0;
    cumulativeRemovedIssues = 0;
  }

  const completedPoints = sprint.state === "FUTURE" ? 0 : evalActiveIssues
    .filter((i) => i.category === "DONE")
    .reduce((sum, i) => sum + (i.points || 0), 0);
  const completedIssues = sprint.state === "FUTURE" ? 0 : evalActiveIssues.filter((i) => i.category === "DONE").length;

  const carriedOverPoints = sprint.state === "FUTURE" ? 0 : evalActiveIssues
    .filter((i) => i.category !== "DONE")
    .reduce((sum, i) => sum + (i.points || 0), 0);
  const carriedOverIssues = sprint.state === "FUTURE" ? 0 : evalActiveIssues.filter((i) => i.category !== "DONE").length;

  const committed = metric === "points" ? committedPoints : committedIssues;
  const scopeAdded = metric === "points" ? cumulativeScopeAddedPoints : cumulativeScopeAddedIssues;
  const removed = metric === "points" ? cumulativeRemovedPoints : cumulativeRemovedIssues;
  const completed = metric === "points" ? completedPoints : completedIssues;
  const remaining = metric === "points" ? carriedOverPoints : carriedOverIssues;

  const completionRate = sprint.state === "FUTURE" ? null : (committedPoints > 0 ? Math.round((completedPoints / committedPoints) * 100) : null);

  // Removed issues: tickets in sprint on Day 0 or added after Day 0, currently not in sprint
  const removedFromSprintIssuesList: Array<{ issueId: string; storyPoints: number }> = [];
  if (sprint.state !== "FUTURE") {
    for (const [id, st] of issuesMap.entries()) {
      if ((inSprintOnDay0.has(id) || addedAfterDay0.has(id)) && !st.inSprint) {
        removedFromSprintIssuesList.push({
          issueId: id,
          storyPoints: st.points || 0,
        });
      }
    }
  }

  // Earliest ADDED_TO_SPRINT timestamp map for issue classification
  const earliestAddedMap = new Map<string, number>();
  for (const e of sortedEvents) {
    if (e.eventType === "ADDED_TO_SPRINT") {
      const t = new Date(e.createdAt).getTime();
      if (!earliestAddedMap.has(e.issueId) || t < earliestAddedMap.get(e.issueId)!) {
        earliestAddedMap.set(e.issueId, t);
      }
    }
  }

  const isIssueAddedMidSprint = (issueId: string): boolean => {
    const addedTs = earliestAddedMap.get(issueId);
    if (addedTs !== undefined) {
      return addedTs > startDayEndTs;
    }
    return false;
  };

  const eligible = (eligibleIssues || []) as T[];
  const committedIssuesList = eligible.filter((i) => !isIssueAddedMidSprint(i.id));
  const addedMidSprintIssuesList = eligible.filter((i) => isIssueAddedMidSprint(i.id));
  const completedIssuesList = eligible.filter((i) => (i.status as any)?.category === "DONE");
  const notCompletedIssuesList = eligible.filter((i) => (i.status as any)?.category !== "DONE");

  return {
    sprint: {
      id: sprint.id || "",
      name: sprint.name || "",
      state: sprint.state,
    },
    metric,
    unestimated: unestimatedCount,
    summary: {
      committed,
      completed,
      remaining,
      scopeAdded,
      removed,

      committedPoints,
      committedIssues,
      completedPoints,
      completedIssues,
      scopeAddedPoints: cumulativeScopeAddedPoints,
      scopeAddedIssues: cumulativeScopeAddedIssues,
      removedPoints: cumulativeRemovedPoints,
      removedIssues: cumulativeRemovedIssues,
      carriedOverPoints,
      carriedOverIssues,
      completionRate,
    },
    days,
    committedIssuesList,
    addedMidSprintIssuesList,
    completedIssuesList,
    notCompletedIssuesList,
    removedFromSprintIssuesList,
    isIssueAddedMidSprint,
  };
}

/**
 * Backward compatibility wrapper for computeBurndown.
 */
export function computeBurndown(
  events: BurndownIssueEvent[],
  sprint: BurndownSprintInput,
  metric: "points" | "issues" = "points",
  referenceTodayJakarta?: string
): BurndownResult {
  const result = computeAgileSprintMetrics({
    sprint,
    events,
    metric,
    referenceTodayJakarta,
  });

  return {
    sprint: result.sprint,
    metric: result.metric,
    unestimated: result.unestimated,
    summary: {
      committed: result.summary.committed,
      completed: result.summary.completed,
      remaining: result.summary.remaining,
      scopeAdded: result.summary.scopeAdded,
      removed: result.summary.removed,
    },
    days: result.days,
  };
}

export interface ClassifySprintIssuesInput<T = any> {
  sprint: {
    id?: string;
    name?: string;
    state?: string;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    startedAt?: Date | string | null;
    closedAt?: Date | string | null;
    createdAt?: Date | string | null;
    committedPoints?: number | null;
    committedIssues?: number | null;
  };
  events: Array<{
    issueId: string;
    eventType: string;
    points?: number | null;
    createdAt: Date | string;
  }>;
  eligibleIssues: Array<T & {
    id: string;
    storyPoints?: number | null;
    status: { category: string; [key: string]: any };
  }>;
}

export interface ClassifySprintIssuesResult<T = any> {
  committedIssuesList: T[];
  committedPoints: number;
  committedIssuesCount: number;
  addedMidSprintIssuesList: T[];
  scopeAddedPoints: number;
  scopeAddedIssuesCount: number;
  completedIssuesList: T[];
  completedPoints: number;
  notCompletedIssuesList: T[];
  carriedOverPoints: number;
  isIssueAddedMidSprint: (issueId: string) => boolean;
}

/**
 * Backward compatibility wrapper for classifySprintIssues.
 */
export function classifySprintIssues<T = any>(
  input: ClassifySprintIssuesInput<T>
): ClassifySprintIssuesResult<T> {
  const sprint = input.sprint;

  // Tanggal evaluasi = hari kalender WIB dari event terakhir, atau hari ini WIB bila lebih akhir
  const todayJakarta = getJakartaDateString(new Date());
  let evalDateStr = todayJakarta;

  if (input.events && input.events.length > 0) {
    const latestEventTs = Math.max(
      ...input.events.map((e) => new Date(e.createdAt).getTime())
    );
    const latestEventDateStr = getJakartaDateString(latestEventTs);
    if (latestEventDateStr > evalDateStr) {
      evalDateStr = latestEventDateStr;
    }
  }

  const result = computeAgileSprintMetrics({
    sprint: {
      id: sprint.id || "classify",
      name: sprint.name || "classify",
      state: sprint.state || "ACTIVE",
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      startedAt: sprint.startedAt,
      closedAt: sprint.closedAt,
      createdAt: sprint.createdAt,
      committedPoints: sprint.committedPoints,
      committedIssues: sprint.committedIssues,
    },
    events: input.events as BurndownIssueEvent[],
    eligibleIssues: input.eligibleIssues,
    metric: "points",
    referenceTodayJakarta: evalDateStr,
  });

  return {
    committedIssuesList: result.committedIssuesList,
    committedPoints: result.summary.committedPoints,
    committedIssuesCount: result.summary.committedIssues,
    addedMidSprintIssuesList: result.addedMidSprintIssuesList,
    scopeAddedPoints: result.summary.scopeAddedPoints,
    scopeAddedIssuesCount: result.summary.scopeAddedIssues,
    completedIssuesList: result.completedIssuesList,
    completedPoints: result.summary.completedPoints,
    notCompletedIssuesList: result.notCompletedIssuesList,
    carriedOverPoints: result.summary.carriedOverPoints,
    isIssueAddedMidSprint: result.isIssueAddedMidSprint,
  };
}
