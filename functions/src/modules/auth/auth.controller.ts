import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../../db";
import env from "../../config/env";
import { isTenantActive } from "../tenants/tenantBootstrap.service";

const JWT_SECRET = env.JWT_SECRET;

export const login = async (req: Request, res: Response) => {
  console.log("Login route hit");
  const { email, password, role: selectedRole } = req.body;

  try {
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND is_active = true",
      [email],
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const membershipResult = await pool.query(
      `SELECT m.tenant_id, m.role, t.name as tenant_name
       FROM tenant_memberships m
       JOIN tenants t ON m.tenant_id = t.id
       WHERE m.user_id = $1 AND m.is_active = true`,
      [user.id],
    );

    const profileResult = await pool.query(
      "SELECT * FROM profiles WHERE id = $1",
      [user.id],
    );
    const profile = profileResult.rows[0];
    const primaryMembership = membershipResult.rows[0];

    // RBAC: if a role was provided at login, it must match the DB-assigned role
    if (selectedRole && primaryMembership?.role !== selectedRole) {
      return res.status(401).json({
        message:
          "Role does not match your assigned role. Please select the correct role.",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: primaryMembership?.role,
        tenant_id: primaryMembership?.tenant_id,
        must_change_password: user.must_change_password,
        vendor_id: profile?.vendor_id ?? null,
      },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    let subscription = null;
    if (primaryMembership?.tenant_id) {
      try {
        subscription = await isTenantActive(primaryMembership.tenant_id);
      } catch {
        // fail open — subscription check is non-fatal at login time
      }
    }

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name,
        role: primaryMembership?.role,
        tenant_id: primaryMembership?.tenant_id,
        tenant_name: primaryMembership?.tenant_name,
        must_change_password: user.must_change_password,
        avatar_url: profile?.avatar_url,
        vendor_id: profile?.vendor_id ?? null,
      },
      subscription,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const register = async (req: Request, res: Response) => {
  const { email, password, full_name, role = "recruiter" } = req.body;

  try {
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email],
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userResult = await pool.query(
      "INSERT INTO users (email, password, is_active, must_change_password) VALUES ($1, $2, $3, $4) RETURNING id",
      [email, hashedPassword, true, false],
    );

    const userId = userResult.rows[0].id;

    await pool.query(
      "INSERT INTO profiles (id, full_name) VALUES ($1, $2)",
      [userId, full_name],
    );

    const tenantResult = await pool.query(
      "SELECT id FROM tenants WHERE name = 'Default' LIMIT 1",
    );

    let tenantId = tenantResult.rows[0]?.id;

    if (!tenantId) {
      const newTenant = await pool.query(
        "INSERT INTO tenants (name) VALUES ($1) RETURNING id",
        ["Default"],
      );
      tenantId = newTenant.rows[0].id;
    }

    await pool.query(
      "INSERT INTO tenant_memberships (user_id, tenant_id, role, is_active) VALUES ($1, $2, $3, $4)",
      [userId, tenantId, role, true],
    );

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ message: "Email and new password are required." });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters." });
  }
  try {
    const userResult = await pool.query(
      "SELECT id FROM users WHERE email = $1 AND is_active = true",
      [email.trim().toLowerCase()],
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "No active account found with that email." });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE users SET password = $1, must_change_password = false, updated_at = now() WHERE id = $2",
      [hashedPassword, userResult.rows[0].id],
    );
    res.json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const changePassword = async (req: any, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  try {
    const userResult = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [userId],
    );
    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password incorrect" });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE users SET password = $1, must_change_password = false, updated_at = now() WHERE id = $2",
      [hashedNewPassword, userId],
    );

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * POST /v1/auth/setup
 * One-time super_admin bootstrap.
 * Allowed ONLY when zero active super_admin accounts exist in the system.
 * Requires the SETUP_TOKEN env var to match the `setupToken` body field so this
 * endpoint cannot be called by random visitors.
 */
export const setupAdmin = async (req: Request, res: Response) => {
  const { email, password, full_name, setupToken } = req.body;

  const expectedToken = process.env.SERVER_SETUP_TOKEN || process.env.SETUP_TOKEN;
  if (!expectedToken) {
    return res.status(503).json({ message: "Setup is disabled on this server." });
  }
  if (setupToken !== expectedToken) {
    return res.status(401).json({ message: "Invalid setup token." });
  }

  // Only allow if no super_admin already exists
  const existing = await pool.query(
    `SELECT 1 FROM tenant_memberships WHERE role = 'super_admin' AND is_active = true LIMIT 1`,
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ message: "A super_admin account already exists. Setup is not available." });
  }

  if (!email || !password || !full_name) {
    return res.status(400).json({ message: "email, password, and full_name are required." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get (or create) the primary tenant
    let tenantResult = await client.query(
      "SELECT id FROM tenants WHERE is_active = true ORDER BY created_at ASC LIMIT 1",
    );
    let tenantId: string;
    if (tenantResult.rows.length === 0) {
      const slug = email.split("@")[1]?.split(".")[0] ?? "default";
      const newTenant = await client.query(
        "INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id",
        ["Default Organization", slug],
      );
      tenantId = newTenant.rows[0].id;
    } else {
      tenantId = tenantResult.rows[0].id;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      "INSERT INTO users (email, password, must_change_password) VALUES ($1, $2, false) RETURNING id",
      [email.trim().toLowerCase(), hashedPassword],
    );
    const userId = userResult.rows[0].id;

    await client.query(
      "INSERT INTO profiles (id, email, full_name) VALUES ($1, $2, $3)",
      [userId, email.trim().toLowerCase(), full_name],
    );

    await client.query(
      "INSERT INTO tenant_memberships (user_id, tenant_id, role, is_active) VALUES ($1, $2, 'super_admin', true)",
      [userId, tenantId],
    );

    await client.query("COMMIT");
    res.status(201).json({ message: "Super admin created successfully." });
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") {
      return res.status(400).json({ message: "Email already in use." });
    }
    console.error("Setup admin error:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

export const getMe = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    const userResult = await pool.query(
      "SELECT email, must_change_password FROM users WHERE id = $1",
      [userId],
    );
    const profileResult = await pool.query(
      "SELECT * FROM profiles WHERE id = $1",
      [userId],
    );
    const membershipResult = await pool.query(
      `SELECT m.tenant_id, m.role, t.name as tenant_name
       FROM tenant_memberships m
       JOIN tenants t ON m.tenant_id = t.id
       WHERE m.user_id = $1 AND m.is_active = true`,
      [userId],
    );

    const user = userResult.rows[0];
    const profile = profileResult.rows[0];
    const primaryMembership = membershipResult.rows[0];

    let subscription = null;
    if (primaryMembership?.tenant_id) {
      try {
        subscription = await isTenantActive(primaryMembership.tenant_id);
      } catch {
        // fail open
      }
    }

    res.json({
      id: userId,
      email: user.email,
      full_name: profile?.full_name,
      role: primaryMembership?.role,
      tenant_id: primaryMembership?.tenant_id,
      tenant_name: primaryMembership?.tenant_name,
      must_change_password: user.must_change_password,
      avatar_url: profile?.avatar_url,
      vendor_id: profile?.vendor_id ?? null,
      subscription,
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
