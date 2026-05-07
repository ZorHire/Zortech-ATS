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
    permissions: string[];
  };
}

export const authMiddleware = (
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
      vendor_id?: string;
    };
    req.user = {
      ...decoded,
      permissions: rolePermissions[decoded.role] ?? [],
    };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
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
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: string;
        email: string;
        role: string;
        tenant_id: string;
        vendor_id?: string;
      };
      req.user = {
        ...decoded,
        permissions: rolePermissions[decoded.role] ?? [],
      };
    } catch {
      // Invalid / expired token — req.user stays undefined; routes will 401.
    }
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
