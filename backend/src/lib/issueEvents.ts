export const ELIGIBLE_REPORT_TYPES = ["STORY", "TASK", "BUG"] as const;

export function isEligibleForReporting(type: string): boolean {
  return (ELIGIBLE_REPORT_TYPES as readonly string[]).includes(type);
}

export interface RecordIssueEventParams {
  issueId: string;
  sprintId?: string | null;
  eventType: "ADDED_TO_SPRINT" | "REMOVED_FROM_SPRINT" | "POINTS_CHANGED" | "STATUS_CHANGED";
  points?: number | null;
  previousPoints?: number | null;
  category?: string | null;
  previousCategory?: string | null;
  createdAt?: Date;
}

export async function recordIssueEvent(
  prismaClient: any,
  params: RecordIssueEventParams
) {
  if (!params.sprintId) return null;
  return prismaClient.issueEvent.create({
    data: {
      issueId: params.issueId,
      sprintId: params.sprintId,
      eventType: params.eventType,
      points: params.points !== undefined ? params.points : null,
      previousPoints: params.previousPoints !== undefined ? params.previousPoints : null,
      category: params.category || null,
      previousCategory: params.previousCategory || null,
      createdAt: params.createdAt || new Date(),
    },
  });
}
