import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

// requirePermission is an additive middleware — place it AFTER the existing
// authorize() call on any route that needs fine-grained permission checking.
//
// Allow logic:
//   user.permissions includes "*"          → allow (super_admin wildcard)
//   user.permissions includes permission   → allow
//   otherwise                              → 403
//
// Example (additive — authorize() stays in place):
//   router.post(
//     "/candidates",
//     authMiddleware,
//     tenantIsolation,
//     authorize(["super_admin", "accounts_manager", "recruiter"]),
//     requirePermission("candidate:create"),   // ← new, additive only
//     controller,
//   );
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const perms = req.user?.permissions ?? [];
    if (perms.includes("*") || perms.includes(permission)) {
      return next();
    }
    return res.status(403).json({ message: "Forbidden: insufficient permissions" });
  };
};
