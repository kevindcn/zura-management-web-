import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.js";
import { isDemoUser } from "../lib/permissions.js";

/**
 * Middleware to block mutating or destructive actions for demo accounts.
 * Returns 403 Forbidden with standard message.
 */
export function blockDemo(req: AuthRequest, res: Response, next: NextFunction): void {
  if (isDemoUser(req.user)) {
    res.status(403).json({ message: "This feature is disabled in the demo account." });
    return;
  }
  next();
}

