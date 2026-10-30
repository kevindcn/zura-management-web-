import jwt from "jsonwebtoken";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    console.error("❌ FATAL: JWT_SECRET environment variable is missing. Server cannot operate securely.");
    throw new Error("FATAL: JWT_SECRET environment variable is required.");
  }
  return secret;
}

export function generateToken(user: AuthUser, expiresIn: string = "7d"): string {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    secret,
    { expiresIn: expiresIn as any }
  );
}

export function verifyToken(token: string): AuthUser {
  const secret = getJwtSecret();
  return jwt.verify(token, secret) as AuthUser;
}
