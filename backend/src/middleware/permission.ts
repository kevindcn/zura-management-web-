import { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "./auth.js";
import { can, Permission, ROLES, ProjectRole } from "../lib/permissions.js";

/**
 * Middleware factory to enforce project-level permissions.
 *
 * Rules:
 * 1. Resolves project from project key, issue key, or comment ID.
 * 2. If project/resource doesn't exist -> 404.
 * 3. If user is NOT a member of the project -> 404 (prevents leaking existence of private projects).
 * 4. If user is member but lacks permission -> 403 with clear message.
 * 5. Handles ownership permissions (delete own issue/comment vs delete any).
 */
export function requirePermission(permission: Permission) {
  const permissionMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      let projectId: string | null = null;
      let issueData: { id: string; projectId: string; reporterId: string } | null = null;
      let commentData: { id: string; authorId: string; issue: { projectId: string } } | null = null;

      // 1. Resolve from req.params.key (either project key or issue key)
      if (req.params.key) {
        const rawKey = req.params.key.toUpperCase().trim();

        // Check if route belongs to project route (e.g. /projects/:key, /projects/:key/sprints, /projects/:key/issues)
        const isProjectRoute =
          req.baseUrl.includes("/projects") ||
          req.path.startsWith("/projects/") ||
          (req.originalUrl ? req.originalUrl.includes("/projects/") : false);

        if (isProjectRoute) {
          const project = await prisma.project.findFirst({
            where: {
              OR: [
                { key: rawKey },
                { id: req.params.key },
              ],
            },
            select: { id: true },
          });
          if (!project) {
            res.status(404).json({ message: "Project tidak ditemukan" });
            return;
          }
          projectId = project.id;
        } else {
          // It's an issue key (e.g. /issues/:key, /issues/:key/move, /issues/:key/comments)
          issueData = await prisma.issue.findUnique({
            where: { key: rawKey },
            select: { id: true, projectId: true, reporterId: true },
          });

          if (!issueData) {
            res.status(404).json({ message: "Work item tidak ditemukan" });
            return;
          }
          projectId = issueData.projectId;
        }
      }
      // 2. Resolve from comment ID (e.g. DELETE /api/comments/:id)
      else if (req.params.id) {
        commentData = await prisma.comment.findUnique({
          where: { id: req.params.id },
          select: {
            id: true,
            authorId: true,
            issue: { select: { projectId: true } },
          },
        });

        if (!commentData) {
          res.status(404).json({ message: "Komentar tidak ditemukan" });
          return;
        }
        projectId = commentData.issue.projectId;
      }

      if (!projectId) {
        res.status(400).json({ message: "Konteks project tidak ditemukan" });
        return;
      }

      // 3. Verify user membership in project
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          leadId: true,
          members: {
            where: { userId },
            select: { role: true },
          },
        },
      });

      if (!project) {
        res.status(404).json({ message: "Project tidak ditemukan" });
        return;
      }

      const isLead = project.leadId === userId;
      const membership = project.members[0];

      // Non-member check -> return 404 so existence is NOT leaked!
      if (!membership && !isLead) {
        res.status(404).json({ message: "Resource tidak ditemukan" });
        return;
      }

      // Determine effective role
      const userRole: ProjectRole = isLead
        ? ROLES.ADMIN
        : ((membership?.role?.toUpperCase() || ROLES.VIEWER) as ProjectRole);

      // Attach context to request
      req.projectId = projectId;
      req.projectRole = userRole;
      req.projectLeadId = project.leadId;

      // 4. Ownership-specific permission handling
      if (permission === "issue:delete:own") {
        const canDeleteAny = can(userRole, "issue:delete:any");
        if (canDeleteAny) {
          return next();
        }
        if (issueData && issueData.reporterId === userId && can(userRole, "issue:delete:own")) {
          return next();
        }
        res.status(403).json({
          message: "Anda hanya memiliki izin untuk menghapus work item yang Anda buat sendiri",
        });
        return;
      }

      if (permission === "comment:delete:own") {
        const canDeleteAny = can(userRole, "comment:delete:any");
        if (canDeleteAny) {
          return next();
        }
        if (commentData && commentData.authorId === userId && can(userRole, "comment:delete:own")) {
          return next();
        }
        res.status(403).json({
          message: "Anda hanya memiliki izin untuk menghapus komentar milik Anda sendiri",
        });
        return;
      }

      if (permission === "project:delete") {
        if (!isLead) {
          res.status(403).json({ message: "Hanya pemilik project (lead) yang dapat menghapus project" });
          return;
        }
        return next();
      }

      // 5. Standard role permission check
      if (!can(userRole, permission)) {
        res.status(403).json({
          message: `Peran Anda (${userRole}) tidak memiliki izin '${permission}' untuk aksi ini`,
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };

  (permissionMiddleware as any).permission = permission;
  return permissionMiddleware;
}
