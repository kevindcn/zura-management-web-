import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/notifications
 * Get user's notifications and unread count
 */
router.get("/notifications", authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const unreadOnly = req.query.unreadOnly === "true";
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 50);

    const [rawNotifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId,
          ...(unreadOnly ? { isRead: false } : {}),
        },
        include: {
          actor: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      }),
    ]);

    const notifications = rawNotifications.map((n) => ({
      id: n.id,
      actorName: n.actor?.name || "Seseorang",
      actorAvatar: n.actor?.avatarUrl || null,
      message: n.message,
      issueKey: n.issueKey || undefined,
      projectId: n.projectId || undefined,
      createdAt: n.createdAt.toISOString(),
      isRead: n.isRead,
      type: n.type,
      title: n.title || undefined,
    }));

    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
router.patch("/notifications/:id/read", authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const id = req.params.id;

    const notif = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notif || notif.userId !== userId) {
      return res.status(404).json({ error: "Notifikasi tidak ditemukan" });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ notification: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notifications/mark-all-read
 * Mark all unread notifications for current user as read
 */
router.post("/notifications/mark-all-read", authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;

    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ success: true, count: result.count });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete("/notifications/:id", authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const id = req.params.id;

    const notif = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notif || notif.userId !== userId) {
      return res.status(404).json({ error: "Notifikasi tidak ditemukan" });
    }

    await prisma.notification.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
