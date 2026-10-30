import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { notifyUser } from "../lib/notifications.js";

const router = Router();

const commentSchema = z.object({
  body: z
    .string()
    .min(1, "Comment body cannot be empty")
    .max(5000, "Comment maximum 5,000 characters"),
});

// Helper to generate clean, inline preview snippet for notifications
function createCommentSnippet(html: string, maxLength: number = 70): string {
  if (!html) return "";

  // Replace images with text indicator
  let clean = html.replace(/<img\b[^>]*>/gi, " [Image] ");

  // Normalize HTML entities & clean wrappers
  clean = clean
    .replace(/&nbsp;/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<(div|p)[^>]*>\s*<br\s*\/?>\s*<\/\1>/gi, " ")
    .replace(/<\/?(div|p|pre|table|tbody|tr|td|ul|ol|li)[^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length <= maxLength) {
    return clean;
  }

  // Truncate cleanly
  let truncated = clean.slice(0, maxLength);
  // Avoid leaving a cut tag like '<b' or '<span' at the very end
  truncated = truncated.replace(/<[^>]*$/, "");

  // Auto-close any unclosed tags
  const openTags: string[] = [];
  const tagRegex = /<\/?([a-z0-9]+)(?:\s+[^>]*?)?>/gi;
  let match;
  while ((match = tagRegex.exec(truncated)) !== null) {
    const isClosing = match[0].startsWith("</");
    const tagName = match[1].toLowerCase();
    if (isClosing) {
      const idx = openTags.lastIndexOf(tagName);
      if (idx !== -1) openTags.splice(idx, 1);
    } else if (!["br", "hr", "img"].includes(tagName)) {
      openTags.push(tagName);
    }
  }

  while (openTags.length > 0) {
    const t = openTags.pop();
    truncated += `</${t}>`;
  }

  return truncated + "...";
}

// POST /api/issues/:key/comments
router.post(
  "/issues/:key/comments",
  authenticateToken,
  requirePermission("comment:create"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const key = req.params.key.toUpperCase();
      const { body } = commentSchema.parse(req.body);
      const userId = req.user!.id;

      const issue = await prisma.issue.findUnique({
        where: { key },
        select: {
          id: true,
          key: true,
          projectId: true,
          assigneeId: true,
          reporterId: true,
          watchers: { select: { userId: true } },
        },
      });

      if (!issue) {
        res.status(404).json({ message: "Issue not found" });
        return;
      }

      const comment = await prisma.$transaction(async (tx) => {
        const newComment = await tx.comment.create({
          data: {
            body,
            issueId: issue.id,
            authorId: userId,
          },
          include: {
            author: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        });

        await tx.activity.create({
          data: {
            action: "COMMENTED",
            field: "comment",
            newValue: body.slice(0, 80),
            issueId: issue.id,
            userId,
          },
        });

        return newComment;
      });

      // Notify assignee, reporter, and watchers (excluding the comment author)
      const recipients = new Set<string>();
      if (issue.assigneeId && issue.assigneeId !== userId) {
        recipients.add(issue.assigneeId);
      }
      if (issue.reporterId && issue.reporterId !== userId) {
        recipients.add(issue.reporterId);
      }
      if (issue.watchers) {
        for (const w of issue.watchers) {
          if (w.userId !== userId) {
            recipients.add(w.userId);
          }
        }
      }

      const snippet = createCommentSnippet(body, 70);
      await Promise.all(
        Array.from(recipients).map((rId) =>
          notifyUser({
            recipientId: rId,
            actorId: userId,
            type: "COMMENT",
            title: "Komentar Baru",
            message: `menambahkan komentar pada ${key}: "${snippet}"`,
            issueKey: key,
            projectId: issue.projectId,
          })
        )
      );

      res.status(201).json({ comment });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/comments/:id
router.delete(
  "/comments/:id",
  authenticateToken,
  requirePermission("comment:delete:own"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const { id } = req.params;

      const comment = await prisma.comment.findUnique({
        where: { id },
      });

      if (!comment) {
        res.status(404).json({ message: "Comment not found" });
        return;
      }

      await prisma.comment.delete({
        where: { id },
      });

      res.json({ message: "Comment deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
