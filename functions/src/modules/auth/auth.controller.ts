import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../../db";
import env from "../../config/env";

const JWT_SECRET = env.JWT_SECRET;

export const login = async (req: Request, res: Response) => {
  console.log("Login route hit");
  const { email, password } = req.body;

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

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: primaryMembership?.role,
        tenant_id: primaryMembership?.tenant_id,
        must_change_password: user.must_change_password,
      },
      JWT_SECRET,
      { expiresIn: "24h" },
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

    res.json({
      id: userId,
      email: user.email,
      full_name: profile?.full_name,
      role: primaryMembership?.role,
      tenant_id: primaryMembership?.tenant_id,
      tenant_name: primaryMembership?.tenant_name,
      must_change_password: user.must_change_password,
      avatar_url: profile?.avatar_url,
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
