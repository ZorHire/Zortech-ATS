import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import env from "../config/env";
import redis from "../lib/redis";

const JWT_SECRET = env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    tenant_id: string;
    vendor_id?: string;
    jti?: string;
    exp?: number;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: string;
      tenant_id: string;
      jti?: string;
      exp?: number;
    };

    // Tokens without a jti can never be revoked — reject them to enforce logout security
    if (!decoded.jti) {
      return res.status(401).json({ message: "Please log in again" });
    }

    try {
      const blacklisted = await redis.get(`blacklist:${decoded.jti}`);
      if (blacklisted) {
        return res.status(401).json({ message: "Token revoked" });
      }
    } catch {
      // Redis unavailable — fail closed: cannot verify revocation, reject the request.
      return res.status(503).json({ message: "Authentication service temporarily unavailable" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    const isExpired = error instanceof jwt.TokenExpiredError;
    return res.status(401).json({
      message: isExpired ? "Token expired" : "Invalid or expired token",
    });
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Access denied" });
    }
    next();
  };
};

export const tenantIsolation = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user?.tenant_id) {
    return res
      .status(403)
      .json({ message: "Forbidden: Tenant context missing" });
  }
  next();
};
