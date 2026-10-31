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

export interface BurndownSprintInput {
  id: string;
  name: string;
  state: string; // ACTIVE, CLOSED, FUTURE
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  startedAt?: Date | string | null;
  closedAt?: Date | string | null;
  committedPoints?: number | null;
  committedIssues?: number | null;
}

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
  };
  days: BurndownDayResult[];
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
  // Asia/Jakarta is UTC+7 (420 minutes)
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
 * Pure function: Compute daily burndown metrics by replaying chronological events.
 * Adheres to 07-Pengembangan-Fitur-Tambahan-Burndown-Velocity-Sprint-Report.md specifications.
 */
export function computeBurndown(
  events: BurndownIssueEvent[],
  sprint: BurndownSprintInput,
  metric: "points" | "issues" = "points",
  referenceTodayJakarta?: string
): BurndownResult {
  const todayJakarta = referenceTodayJakarta || getJakartaDateString(new Date());

  // Determine sprint start and end dates
  const rawStart = sprint.startDate || sprint.startedAt || new Date();
  const rawEnd = sprint.endDate || (sprint.closedAt ? sprint.closedAt : null);

  const startDateStr = getJakartaDateString(rawStart);
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

  // Determine baseline committed
  let committed = metric === "points" 
    ? (sprint.committedPoints ?? 0)
    : (sprint.committedIssues ?? 0);

  // If committed is 0 and we have events, determine committed from initial ADDED_TO_SPRINT events on start day
  if (committed === 0 && events.length > 0) {
    const startDayEndTs = getJakartaEndOfDayTimestamp(startDateStr);
    const initialEvents = events.filter(
      (e) =>
        e.eventType === "ADDED_TO_SPRINT" &&
        new Date(e.createdAt).getTime() <= startDayEndTs
    );
    if (initialEvents.length > 0) {
      if (metric === "points") {
        committed = initialEvents.reduce((sum, e) => sum + (e.points || 0), 0);
      } else {
        committed = initialEvents.length;
      }
    }
  }

  // Sort events chronologically
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // State tracker per issue
  interface IssueState {
    inSprint: boolean;
    points: number;
    hasEstimatedPoints: boolean;
    category: string; // TO_DO, IN_PROGRESS, DONE
  }
  const issuesMap = new Map<string, IssueState>();

  let eventIdx = 0;
  const days: BurndownDayResult[] = [];

  let lastEvaluatedScope = committed;
  let lastEvaluatedDone = 0;
  let lastEvaluatedRemaining = committed;

  dateList.forEach((dateStr, idx) => {
    const dayEndTimestamp = getJakartaEndOfDayTimestamp(dateStr);

    // Apply all events up to the end of this day
    while (
      eventIdx < sortedEvents.length &&
      new Date(sortedEvents[eventIdx].createdAt).getTime() <= dayEndTimestamp
    ) {
      const e = sortedEvents[eventIdx];
      const existing = issuesMap.get(e.issueId);

      switch (e.eventType) {
        case "ADDED_TO_SPRINT":
          issuesMap.set(e.issueId, {
            inSprint: true,
            points: e.points !== undefined && e.points !== null ? e.points : (existing?.points ?? 0),
            hasEstimatedPoints: e.points !== null && e.points !== undefined,
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

    // If day 0 and no events occurred yet, fall back to committed as scope
    if (idx === 0 && dayScope === 0 && committed > 0) {
      dayScope = committed;
    }

    // Linear ideal burndown: committed * (1 - i / (totalDays - 1))
    const idealVal = totalDays > 1 ? committed * (1 - idx / (totalDays - 1)) : 0;
    const ideal = Math.max(0, Math.round(idealVal * 10) / 10);

    const isToday = dateStr === todayJakarta;
    // For active sprint, future days have remaining = null (line stops at today)
    const isFuture = sprint.state === "ACTIVE" && dateStr > todayJakarta;

    let dayRemaining: number | null = null;
    let doneVal: number | null = null;

    if (isFuture) {
      dayRemaining = null;
      doneVal = null;
    } else {
      dayRemaining = Math.max(0, dayScope - dayDone);
      doneVal = dayDone;
      lastEvaluatedScope = dayScope;
      lastEvaluatedDone = dayDone;
      lastEvaluatedRemaining = dayRemaining;
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

  // Calculate unestimated issues among active sprint issues
  const currentSprintIssues = Array.from(issuesMap.values()).filter((i) => i.inSprint);
  const unestimatedCount = currentSprintIssues.filter((i) => !i.hasEstimatedPoints).length;

  const scopeAdded = Math.max(0, lastEvaluatedScope - committed);

  return {
    sprint: {
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
    },
    metric,
    unestimated: unestimatedCount,
    summary: {
      committed,
      completed: lastEvaluatedDone,
      remaining: lastEvaluatedRemaining,
      scopeAdded,
    },
    days,
  };
}

export interface ClassifySprintIssuesInput<T = any> {
  sprint: {
    startDate?: Date | string | null;
    startedAt?: Date | string | null;
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
 * Single source of truth for sprint issue classification:
 * An issue is COMMITTED if its earliest ADDED_TO_SPRINT event occurred on or before
 * the sprint start date calendar day in Asia/Jakarta timezone (up to 23:59:59.999 WIB).
 * Any issue whose earliest ADDED_TO_SPRINT occurred after that midnight boundary is SCOPE ADDED (added mid-sprint).
 */
export function classifySprintIssues<T = any>(
  input: ClassifySprintIssuesInput<T>
): ClassifySprintIssuesResult<T> {
  const { sprint, events, eligibleIssues } = input;

  const rawStart = sprint.startDate || sprint.startedAt || new Date();
  const startDateStr = getJakartaDateString(rawStart);
  const startDayEndTs = getJakartaEndOfDayTimestamp(startDateStr);

  const earliestAddedMap = new Map<string, number>();
  for (const e of events) {
    if (e.eventType === "ADDED_TO_SPRINT") {
      const t = new Date(e.createdAt).getTime();
      if (!earliestAddedMap.has(e.issueId) || t < earliestAddedMap.get(e.issueId)!) {
        earliestAddedMap.set(e.issueId, t);
      }
    }
  }

  const isIssueAddedMidSprint = (issueId: string): boolean => {
    const addedTs = earliestAddedMap.get(issueId);
    if (addedTs === undefined) return false;
    return addedTs > startDayEndTs;
  };

  const committedIssuesList = eligibleIssues.filter((i) => !isIssueAddedMidSprint(i.id));
  const addedMidSprintIssuesList = eligibleIssues.filter((i) => isIssueAddedMidSprint(i.id));
  const completedIssuesList = eligibleIssues.filter((i) => i.status.category === "DONE");
  const notCompletedIssuesList = eligibleIssues.filter((i) => i.status.category !== "DONE");

  const committedPoints =
    sprint.committedPoints !== null && sprint.committedPoints !== undefined && sprint.committedPoints > 0
      ? sprint.committedPoints
      : committedIssuesList.reduce((sum, i) => sum + (i.storyPoints || 0), 0);

  const committedIssuesCount =
    sprint.committedIssues !== null && sprint.committedIssues !== undefined && sprint.committedIssues > 0
      ? sprint.committedIssues
      : committedIssuesList.length;

  const scopeAddedPoints = addedMidSprintIssuesList.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
  const completedPoints = completedIssuesList.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
  const carriedOverPoints = notCompletedIssuesList.reduce((sum, i) => sum + (i.storyPoints || 0), 0);

  return {
    committedIssuesList,
    committedPoints,
    committedIssuesCount,
    addedMidSprintIssuesList,
    scopeAddedPoints,
    scopeAddedIssuesCount: addedMidSprintIssuesList.length,
    completedIssuesList,
    completedPoints,
    notCompletedIssuesList,
    carriedOverPoints,
    isIssueAddedMidSprint,
  };
}
