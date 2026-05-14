import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import env from "../config/env";
import { rolePermissions } from "../config/rolePermissions";

const JWT_SECRET = env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    tenant_id: string;
    vendor_id?: string;
    is_platform_owner?: boolean;
    permissions: string[];
  };
}

function extractTokenCandidates(req: Request): string[] {
  const candidates: string[] = [];
  // Bearer (localStorage) is tried first — it is explicitly set by the frontend
  // on login and cleared on logout, so it reflects the current session.
  const bearer = req.headers.authorization?.split(" ")[1];
  if (bearer) candidates.push(bearer);
  // Cookie is the fallback (e.g. for requests that don't send Authorization).
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = /(?:^|;\s*)jwt=([^;]+)/.exec(cookieHeader);
    if (match?.[1]) candidates.push(decodeURIComponent(match[1]));
  }
  return candidates;
}

type JwtPayload = {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
  vendor_id?: string;
  is_platform_owner?: boolean;
};

function verifyFirstValid(tokens: string[], secret: string): JwtPayload | undefined {
  for (const token of tokens) {
    try {
      return jwt.verify(token, secret) as JwtPayload;
    } catch {
      // try next candidate
    }
  }
  return undefined;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const tokens = extractTokenCandidates(req);
  if (tokens.length === 0) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const decoded = verifyFirstValid(tokens, JWT_SECRET);
  if (!decoded) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  req.user = {
    ...decoded,
    is_platform_owner: decoded.is_platform_owner ?? false,
    permissions: rolePermissions[decoded.role] ?? [],
  };
  next();
};

export const authorize = (roles: string[], permissions?: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Access denied" });
    }
    if (permissions && permissions.length > 0) {
      const userPerms = req.user.permissions;
      const hasWildcard = userPerms.includes("*");
      const hasAll = permissions.every((p) => hasWildcard || userPerms.includes(p));
      if (!hasAll) {
        return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
      }
    }
    next();
  };
};

/** Check whether the authenticated user holds a specific permission. */
export const hasPermission = (req: AuthRequest, permission: string): boolean => {
  const perms = req.user?.permissions ?? [];
  return perms.includes("*") || perms.includes(permission);
};

/**
 * Non-rejecting JWT parser. Sets req.user if the token is valid; calls next()
 * unconditionally. Used as a v1Router-level pass so requireActiveSubscription
 * can read the tenant before per-route authMiddleware runs. Routes that require
 * authentication still use authMiddleware to hard-reject missing/invalid tokens.
 */
export const softAuth = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const decoded = verifyFirstValid(extractTokenCandidates(req), JWT_SECRET);
  if (decoded) {
    req.user = {
      ...decoded,
      is_platform_owner: decoded.is_platform_owner ?? false,
      permissions: rolePermissions[decoded.role] ?? [],
    };
  }
  next();
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
