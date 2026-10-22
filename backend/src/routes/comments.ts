import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

const commentSchema = z.object({
  body: z.string().min(1, "Comment body cannot be empty"),
});

// POST /api/issues/:key/comments
router.post("/issues/:key/comments", authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const { body } = commentSchema.parse(req.body);
    const userId = req.user!.id;

    const issue = await prisma.issue.findUnique({
      where: { key },
      select: { id: true },
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

    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/comments/:id
router.delete("/comments/:id", authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    if (comment.authorId !== userId) {
      res.status(403).json({ message: "You can only delete your own comments" });
      return;
    }

    await prisma.comment.delete({
      where: { id },
    });

    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    next(err);
  }
});

export default router;
