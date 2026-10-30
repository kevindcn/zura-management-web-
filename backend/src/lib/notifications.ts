import { prisma } from "./prisma.js";

export interface CreateNotificationParams {
  recipientId: string;
  actorId: string;
  type: "ASSIGNED" | "COMMENT" | "STATUS_CHANGED" | "SPRINT";
  title?: string;
  message: string;
  issueKey?: string;
  projectId?: string;
}

/**
 * Creates a notification safely.
 * Prevents self-notifications (recipientId === actorId).
 * Catches errors to ensure main flow is never interrupted.
 */
export async function notifyUser(params: CreateNotificationParams) {
  if (!params.recipientId || !params.actorId) return null;
  if (params.recipientId === params.actorId) return null;

  try {
    return await prisma.notification.create({
      data: {
        userId: params.recipientId,
        actorId: params.actorId,
        type: params.type,
        title: params.title || null,
        message: params.message,
        issueKey: params.issueKey || null,
        projectId: params.projectId || null,
      },
    });
  } catch (err) {
    console.error("[Notification Service] Error creating notification:", err);
    return null;
  }
}
