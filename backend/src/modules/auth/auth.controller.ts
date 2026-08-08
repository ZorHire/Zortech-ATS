import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import pool from "../../db";
import env from "../../config/env";
import { withCache, invalidate } from "../../lib/cache";
import redis from "../../lib/redis";
import { AuthRequest } from "../../middleware/auth";
import { getTenantTransporter } from "../email/email.controller";

const JWT_SECRET = env.JWT_SECRET;

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // Find user in users table
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND is_active = true",
      [email],
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = userResult.rows[0];

    // Per-account brute-force lockout (5 failures → 15-min lock)
    const lockKey = `login_fails:${user.id}`;
    const failCount = await redis.get(lockKey);
    if (failCount && parseInt(failCount, 10) >= 5) {
      return res.status(429).json({ message: "Account temporarily locked. Please try again in 15 minutes." });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await redis.incr(lockKey);
      await redis.expire(lockKey, 900); // sliding 15-min window
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Successful login — clear failure counter
    await redis.del(lockKey);

    // Get user memberships, profile, and subscription in parallel
    const [membershipResult, profileResult] = await Promise.all([
      pool.query(
        `SELECT m.tenant_id, m.role, t.name as tenant_name
         FROM tenant_memberships m
         JOIN tenants t ON m.tenant_id = t.id
         WHERE m.user_id = $1 AND m.is_active = true`,
        [user.id],
      ),
      pool.query("SELECT * FROM profiles WHERE id = $1", [user.id]),
    ]);

    const profile = profileResult.rows[0];
    const primaryMembership = membershipResult.rows[0];

    // Fetch tenant platform-owner flag and active subscription
    const tenantRow = primaryMembership
      ? (await pool.query(
          `SELECT t.is_platform_owner,
                  (SELECT status FROM subscriptions
                   WHERE tenant_id = t.id AND status IN ('active','trial')
                   ORDER BY created_at DESC LIMIT 1) AS sub_status
           FROM tenants t WHERE t.id = $1`,
          [primaryMembership.tenant_id],
        )).rows[0]
      : null;

    const isPlatformOwner = !!tenantRow?.is_platform_owner;
    const subStatus = tenantRow?.sub_status ?? null;
    const subscription = {
      active: isPlatformOwner || subStatus === 'active' || subStatus === 'trial',
      isPlatformOwner,
      reason: subStatus ?? (isPlatformOwner ? 'platform_owner' : 'none'),
    };

    // Generate token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: primaryMembership?.role,
        tenant_id: primaryMembership?.tenant_id,
        must_change_password: user.must_change_password,
      },
      JWT_SECRET,
      { expiresIn: "24h", jwtid: crypto.randomUUID() },
    );

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
      },
      subscription,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const ALLOWED_REGISTRATION_ROLES = new Set(['recruiter', 'vendor_user']);

export const register = async (req: Request, res: Response) => {
  const { email, password, full_name, role = 'recruiter' } = req.body;

  if (!ALLOWED_REGISTRATION_ROLES.has(role)) {
    return res.status(400).json({ message: "Invalid role. Allowed: recruiter, vendor_user." });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters." });
  }

  try {
    // Check if user already exists — respond generically to avoid email enumeration
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email],
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "Registration failed. Please try a different email or contact your administrator." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userResult = await pool.query(
      "INSERT INTO users (email, password, is_active, must_change_password) VALUES ($1, $2, $3, $4) RETURNING id",
      [email, hashedPassword, true, false],
    );
    
    const userId = userResult.rows[0].id;

    // Create profile
    await pool.query(
      "INSERT INTO profiles (id, email, full_name) VALUES ($1, $2, $3)",
      [userId, email, full_name],
    );

    // Get or create default tenant
    const tenantResult = await pool.query(
      "SELECT id FROM tenants WHERE name = 'Default' LIMIT 1"
    );
    
    let tenantId = tenantResult.rows[0]?.id;
    
    if (!tenantId) {
      const newTenant = await pool.query(
        "INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id",
        ['Default', 'default']
      );
      tenantId = newTenant.rows[0].id;
    }

    // Create tenant membership
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

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  // Always respond generically — never reveal whether the email is registered
  const respond = () =>
    res.json({ message: "If that email is registered, a reset link has been sent." });

  try {
    const userResult = await pool.query(
      "SELECT id FROM users WHERE email = $1 AND is_active = true",
      [email.trim().toLowerCase()],
    );

    if (userResult.rows.length === 0) return respond();

    const userId = userResult.rows[0].id;
    const token = crypto.randomBytes(32).toString("hex");

    // Store token in Redis with a 15-minute TTL
    await redis.setex(`pwd_reset:${token}`, 900, userId);

    const resetLink = `${env.FRONTEND_URL}/reset-password?token=${token}`;

    // Try to deliver via tenant SMTP; silently degrade if none is configured
    try {
      const memberResult = await pool.query(
        "SELECT tenant_id FROM tenant_memberships WHERE user_id = $1 AND is_active = true LIMIT 1",
        [userId],
      );

      if (memberResult.rows.length > 0) {
        const mailer = await getTenantTransporter(memberResult.rows[0].tenant_id);
        if (mailer) {
          await mailer.transporter.sendMail({
            from: mailer.fromEmail,
            to: email.trim().toLowerCase(),
            subject: "Reset your ZorHire password",
            html: `<p>You requested a password reset for your ZorHire account.</p>
<p><a href="${resetLink}">Click here to reset your password</a></p>
<p>This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>`,
          });
        } else if (env.NODE_ENV !== "production") {
          console.log(`[DEV] Password reset link for ${email}: ${resetLink}`);
        }
      }
    } catch (emailErr) {
      // Email failure must not expose user existence or block the generic response
      console.error("Password reset email error:", emailErr);
    }

    return respond();
  } catch (error) {
    console.error("Forgot password error:", error);
    return respond();
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  if (newPassword.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters." });
  }

  try {
    // Validate the one-time token from Redis
    const userId = await redis.get(`pwd_reset:${token}`);

    if (!userId) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset link. Please request a new one." });
    }

    const userResult = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND is_active = true",
      [userId],
    );

    if (userResult.rows.length === 0) {
      await redis.del(`pwd_reset:${token}`);
      return res
        .status(400)
        .json({ message: "Invalid or expired reset link. Please request a new one." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE users SET password = $1, must_change_password = false, updated_at = now() WHERE id = $2",
      [hashedPassword, userId],
    );

    // Delete token so it can only be used once
    await redis.del(`pwd_reset:${token}`);

    res.json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const changePassword = async (req: any, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters." });
  }

  try {
    const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
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

    await invalidate(`user:${userId}:me`);
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMe = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    const data = await withCache(`user:${userId}:me`, 300, async () => {
      const [userResult, profileResult, membershipResult] = await Promise.all([
        pool.query("SELECT email, must_change_password FROM users WHERE id = $1", [userId]),
        pool.query("SELECT * FROM profiles WHERE id = $1", [userId]),
        pool.query(
          `SELECT m.tenant_id, m.role, t.name as tenant_name
           FROM tenant_memberships m
           JOIN tenants t ON m.tenant_id = t.id
           WHERE m.user_id = $1 AND m.is_active = true`,
          [userId],
        ),
      ]);
      const user = userResult.rows[0];
      const profile = profileResult.rows[0];
      const primaryMembership = membershipResult.rows[0];

      const tenantRow = primaryMembership
        ? (await pool.query(
            `SELECT t.is_platform_owner,
                    (SELECT status FROM subscriptions
                     WHERE tenant_id = t.id AND status IN ('active','trial')
                     ORDER BY created_at DESC LIMIT 1) AS sub_status
             FROM tenants t WHERE t.id = $1`,
            [primaryMembership.tenant_id],
          )).rows[0]
        : null;

      const isPlatformOwner = !!tenantRow?.is_platform_owner;
      const subStatus = tenantRow?.sub_status ?? null;

      return {
        id: userId,
        email: user.email,
        full_name: profile?.full_name,
        role: primaryMembership?.role,
        tenant_id: primaryMembership?.tenant_id,
        tenant_name: primaryMembership?.tenant_name,
        must_change_password: user.must_change_password,
        avatar_url: profile?.avatar_url,
        subscription: {
          active: isPlatformOwner || subStatus === 'active' || subStatus === 'trial',
          isPlatformOwner,
          reason: subStatus ?? (isPlatformOwner ? 'platform_owner' : 'none'),
        },
      };
    });

    res.json(data);
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  try {
    const { jti, exp } = req.user ?? {};
    if (jti && exp) {
      const remainingTtl = exp - Math.floor(Date.now() / 1000);
      if (remainingTtl > 0) {
        await redis.setex(`blacklist:${jti}`, remainingTtl, "1");
      }
    }
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
