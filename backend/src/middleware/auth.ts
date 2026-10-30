import { Request, Response, NextFunction } from "express";
import { verifyToken, AuthUser } from "../lib/jwt.js";
import { ProjectRole } from "../lib/permissions.js";

export { AuthUser };

export interface AuthRequest extends Request {
  user?: AuthUser;
  projectId?: string;
  projectRole?: ProjectRole;
  projectLeadId?: string;
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }
};
