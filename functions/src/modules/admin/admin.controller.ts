import { Response } from "express";
import bcrypt from "bcryptjs";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";
import { sendEmailAsUser, EmailServiceError } from "../email/emailConfig.service";

export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
    const filterTenantId = req.user?.is_platform_owner ? null : req.user?.tenant_id;
    const limitVal = Math.min(Number(req.query.limit) || 500, 500);
    const offsetVal = Math.max(Number(req.query.offset) || 0, 0);
    const result = await pool.query(
      `SELECT u.id, u.email, u.is_active, u.must_change_password, m.role, p.full_name, m.tenant_id
       FROM users u
       JOIN tenant_memberships m ON u.id = m.user_id
       LEFT JOIN profiles p ON u.id = p.id
       WHERE ($1::uuid IS NULL OR m.tenant_id = $1)
       ORDER BY u.created_at DESC LIMIT $2 OFFSET $3`,
      [filterTenantId, limitVal, offsetVal],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const ALLOWED_ROLES = [
  "super_admin",
  "accounts_manager",
  "recruiter",
  "vendor_user",
  "vendor_manager",
] as const;

export const createUser = async (req: AuthRequest, res: Response) => {
  const { email, password, full_name, role, vendor_id } = req.body;
  const tenantId = req.user?.tenant_id;

  if (!email || !password || !role) {
    return res.status(400).json({ message: "Email, password, and role are required" });
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return res
      .status(400)
      .json({ message: `Invalid role '${role}'. Allowed: ${ALLOWED_ROLES.join(", ")}` });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userExists = await client.query("SELECT id FROM users WHERE email = $1", [email]);
    let userId;

    if (userExists.rows.length > 0) {
      userId = userExists.rows[0].id;
      const memberExists = await client.query(
        "SELECT id FROM tenant_memberships WHERE user_id = $1 AND tenant_id = $2",
        [userId, tenantId],
      );
      if (memberExists.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "User is already a member of this tenant" });
      }
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await client.query(
        "INSERT INTO users (email, password, must_change_password) VALUES ($1, $2, true) RETURNING id",
        [email, hashedPassword],
      );
      userId = newUser.rows[0].id;

      await client.query(
        "INSERT INTO profiles (id, email, full_name) VALUES ($1, $2, $3)",
        [userId, email, full_name || ""],
      );
    }

    if ((role === "vendor_user" || role === "vendor_manager") && vendor_id) {
      await client.query(
        "UPDATE profiles SET vendor_id = $1 WHERE id = $2",
        [vendor_id, userId],
      );
    }

    await client.query(
      "INSERT INTO tenant_memberships (user_id, tenant_id, role) VALUES ($1, $2, $3)",
      [userId, tenantId, role],
    );

    await client.query("COMMIT");

    // Attempt invite email — non-fatal: user is already created
    let emailSent = false;
    let emailError: string | undefined;
    try {
      const adminId = req.user!.id;
      const adminProfile = await pool.query<{ full_name: string }>(
        "SELECT full_name FROM profiles WHERE id = $1",
        [adminId],
      );
      const senderName = adminProfile.rows[0]?.full_name || undefined;
      const roleLabel: Record<string, string> = {
        super_admin: "Super Admin",
        accounts_manager: "Accounts Manager",
        vendor_manager: "Vendor Manager",
        recruiter: "Recruiter",
        vendor_user: "Vendor",
      };
      await sendEmailAsUser({
        userId: adminId,
        tenantId: tenantId!,
        senderName,
        to: email,
        subject: "You've been invited to ZorHire",
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e">
            <h2 style="color:#2563eb;margin-bottom:8px">Welcome to ZorHire!</h2>
            <p>Hi <strong>${full_name || email}</strong>,</p>
            <p>Your account has been created. Here are your login credentials:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px">
              <tr>
                <td style="padding:10px 14px;font-weight:600;color:#64748b;width:40%">Email</td>
                <td style="padding:10px 14px;color:#1e293b">${email}</td>
              </tr>
              <tr style="background:#f1f5f9">
                <td style="padding:10px 14px;font-weight:600;color:#64748b">Temporary Password</td>
                <td style="padding:10px 14px;color:#1e293b;font-family:monospace">${password}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;font-weight:600;color:#64748b">Role</td>
                <td style="padding:10px 14px;color:#1e293b">${roleLabel[role] || role}</td>
              </tr>
            </table>
            <p style="color:#ef4444;font-size:13px">You will be required to change your password upon first login.</p>
            <p style="margin-top:24px;font-size:13px;color:#94a3b8">If you have any questions, contact your administrator.</p>
          </div>
        `,
      });
      emailSent = true;
    } catch (emailErr) {
      emailError =
        emailErr instanceof EmailServiceError
          ? emailErr.code === "EMAIL_NOT_CONFIGURED"
            ? "Email not configured — go to Settings → Email to connect your SMTP."
            : emailErr.message
          : "Failed to send invite email.";
      console.warn("[admin] Invite email failed for", email, "—", emailError);
    }

    res.status(201).json({
      message: "User created and added to tenant successfully",
      emailSent,
      ...(emailError ? { emailError } : {}),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create user error:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { role, is_active } = req.body;
  const tenantId = req.user?.tenant_id;
  const isPlatformOwner = req.user?.is_platform_owner;

  if (role !== undefined) {
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        message: `Invalid role '${role}'. Allowed: ${ALLOWED_ROLES.join(", ")}`,
      });
    }
    // Only super_admin may assign the super_admin role
    if (role === "super_admin" && req.user?.role !== "super_admin") {
      return res.status(403).json({ message: "Only a super_admin can assign the super_admin role." });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (role) {
      if (isPlatformOwner) {
        await client.query(
          "UPDATE tenant_memberships SET role = $1, updated_at = now() WHERE user_id = $2",
          [role, id],
        );
      } else {
        await client.query(
          "UPDATE tenant_memberships SET role = $1, updated_at = now() WHERE user_id = $2 AND tenant_id = $3",
          [role, id, tenantId],
        );
      }
    }

    if (is_active !== undefined) {
      if (isPlatformOwner) {
        await client.query(
          "UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2",
          [is_active, id],
        );
      } else {
        await client.query(
          `UPDATE users SET is_active = $1, updated_at = now()
           WHERE id = $2
           AND EXISTS (SELECT 1 FROM tenant_memberships WHERE user_id = $2 AND tenant_id = $3)`,
          [is_active, id, tenantId],
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "User updated successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update user error:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  const requesterId = req.user?.id;
  const isPlatformOwner = req.user?.is_platform_owner;

  // Prevent self-deletion
  if (id === requesterId) {
    return res.status(400).json({ message: "You cannot delete your own account." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Platform owner can delete users across any tenant; others are scoped to their own tenant
    const member = isPlatformOwner
      ? await client.query(
          "SELECT id, role FROM tenant_memberships WHERE user_id = $1 LIMIT 1",
          [id],
        )
      : await client.query(
          "SELECT id, role FROM tenant_memberships WHERE user_id = $1 AND tenant_id = $2",
          [id, tenantId],
        );

    if (member.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found in this tenant." });
    }
    // Only super_admin may delete another super_admin
    if (member.rows[0].role === "super_admin" && req.user?.role !== "super_admin") {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Only a super_admin can delete another super_admin." });
    }

    // NULL out all non-cascading FK references before deleting so PostgreSQL
    // doesn't reject with a FK violation (these columns have no ON DELETE action).
    await client.query("UPDATE jobs SET assigned_recruiter_id = NULL WHERE assigned_recruiter_id = $1", [id]);
    await client.query("UPDATE jobs SET created_by = NULL WHERE created_by = $1", [id]);
    await client.query("UPDATE jobs SET approved_by = NULL WHERE approved_by = $1", [id]);
    await client.query("UPDATE candidates SET created_by = NULL WHERE created_by = $1", [id]);
    await client.query("UPDATE job_applications SET assigned_to = NULL WHERE assigned_to = $1", [id]);
    await client.query("UPDATE pipeline_events SET changed_by = NULL WHERE changed_by = $1", [id]);
    await client.query("UPDATE email_campaigns SET created_by = NULL WHERE created_by = $1", [id]);
    await client.query("UPDATE interviews SET created_by = NULL WHERE created_by = $1", [id]);
    await client.query("UPDATE clients SET created_by = NULL WHERE created_by = $1", [id]);
    await client.query("UPDATE tenants SET onboarded_by = NULL WHERE onboarded_by = $1", [id]);

    // Hard delete — CASCADE handles tenant_memberships and profiles.
    await client.query("DELETE FROM users WHERE id = $1", [id]);

    await client.query("COMMIT");
    res.json({ message: "User deleted successfully." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

export const resetPassword = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  const tenantId = req.user?.tenant_id;
  const isPlatformOwner = req.user?.is_platform_owner;

  try {
    const member = isPlatformOwner
      ? await pool.query(
          "SELECT id FROM tenant_memberships WHERE user_id = $1 LIMIT 1",
          [id],
        )
      : await pool.query(
          "SELECT id FROM tenant_memberships WHERE user_id = $1 AND tenant_id = $2",
          [id, tenantId],
        );
    if (member.rows.length === 0) {
      return res.status(404).json({ message: "User not found in this tenant" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE users SET password = $1, must_change_password = true, updated_at = now() WHERE id = $2",
      [hashedPassword, id],
    );

    res.json({ message: "Password reset successfully. User must change it on next login." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
