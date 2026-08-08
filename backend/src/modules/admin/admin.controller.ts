import { Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../../db';
import { AuthRequest } from '../../middleware/auth';
import { withCache, invalidate } from '../../lib/cache';
import { getUserTransporter, classifySmtpError } from '../email/email.controller';
import env from '../../config/env';

export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const rows = await withCache(`tenant:${tenantId}:users`, 300, async () => {
      const result = await pool.query(
        `SELECT u.id, u.email, u.is_active, u.must_change_password, m.role, p.full_name
         FROM users u
         JOIN tenant_memberships m ON u.id = m.user_id
         LEFT JOIN profiles p ON u.id = p.id
         WHERE m.tenant_id = $1
         ORDER BY u.created_at DESC`,
        [tenantId]
      );
      return result.rows;
    });
    res.json(rows);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createUser = async (req: AuthRequest, res: Response) => {
  const { email, password, full_name, role, vendor_id } = req.body;
  const tenantId = req.user?.tenant_id;
  const adminId = req.user?.id;

  if (!email || !password || !role) {
    return res.status(400).json({ message: 'Email, password, and role are required' });
  }

  const ALLOWED_ADMIN_ROLES = new Set(['super_admin', 'accounts_manager', 'recruiter', 'vendor_manager', 'vendor_user']);
  if (!ALLOWED_ADMIN_ROLES.has(role)) {
    return res.status(400).json({ message: 'Invalid role.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userExists = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;

    if (userExists.rows.length > 0) {
      userId = userExists.rows[0].id;
      const memberExists = await client.query(
        'SELECT id FROM tenant_memberships WHERE user_id = $1 AND tenant_id = $2',
        [userId, tenantId]
      );
      if (memberExists.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'User is already a member of this tenant' });
      }
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await client.query(
        'INSERT INTO users (email, password, must_change_password) VALUES ($1, $2, true) RETURNING id',
        [email, hashedPassword]
      );
      userId = newUser.rows[0].id;

      await client.query(
        'INSERT INTO profiles (id, email, full_name, vendor_id) VALUES ($1, $2, $3, $4)',
        [userId, email, full_name || '', vendor_id || null]
      );
    }

    await client.query(
      'INSERT INTO tenant_memberships (user_id, tenant_id, role) VALUES ($1, $2, $3)',
      [userId, tenantId, role]
    );

    await client.query('COMMIT');
    await invalidate(`tenant:${tenantId}:users`);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Create user error:', error?.message, error?.detail);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }

  // Email is sent AFTER the response-path try-catch so a corrupt/missing
  // email config can never turn a successful user creation into a 500.
  let emailSent = false;
  let emailError: string | undefined;
  try {
    const mail = await getUserTransporter(adminId!);
    if (!mail) {
      emailError = 'Email not configured on your account. Configure it in Settings → Email.';
    } else {
      const platformUrl = env.FRONTEND_URL;
      const textBody =
        `Hello ${full_name || email},\n\n` +
        `Your account has been created on ZorHire ATS.\n\n` +
        `Login details:\nEmail: ${email}\nTemporary password: ${password}\n\n` +
        `You will be asked to change your password on first login.\n\n` +
        `Access the platform here: ${platformUrl}`;
      const htmlBody = `
        <div style="font-family:sans-serif;line-height:1.6;color:#333;max-width:520px">
          <h2 style="color:#1a1a1a">Welcome to ZorHire ATS</h2>
          <p>Hello ${full_name || email},</p>
          <p>Your account has been created. Here are your login details:</p>
          <table style="border-collapse:collapse;margin:12px 0">
            <tr><td style="padding:4px 12px 4px 0;font-weight:600">Email</td><td>${email}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600">Temporary password</td><td style="font-family:monospace">${password}</td></tr>
          </table>
          <p>You will be asked to change your password on first login.</p>
          <p style="margin-top:24px">
            <a href="${platformUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
              Access ZorHire ATS
            </a>
          </p>
          <p style="margin-top:16px;font-size:13px;color:#666">
            Or copy this link: <a href="${platformUrl}">${platformUrl}</a>
          </p>
        </div>`;
      await mail.transporter.sendMail({
        from: mail.fromEmail,
        to: email,
        subject: 'Your ZorHire ATS account has been created',
        text: textBody,
        html: htmlBody,
      });
      emailSent = true;
    }
  } catch (emailErr: any) {
    emailError = classifySmtpError(emailErr).message;
  }

  res.status(201).json({ message: 'User created successfully', emailSent, emailError });
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { role, is_active } = req.body;
  const tenantId = req.user?.tenant_id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (role) {
      await client.query(
        'UPDATE tenant_memberships SET role = $1, updated_at = now() WHERE user_id = $2 AND tenant_id = $3',
        [role, id, tenantId]
      );
    }

    if (is_active !== undefined) {
      // Scope to tenant — prevent cross-tenant deactivation
      await client.query(
        `UPDATE users SET is_active = $1, updated_at = now()
         WHERE id = $2 AND EXISTS (
           SELECT 1 FROM tenant_memberships WHERE user_id = $2 AND tenant_id = $3
         )`,
        [is_active, id, tenantId]
      );
    }

    await client.query('COMMIT');
    await invalidate(`tenant:${tenantId}:users`, `user:${id}:me`);
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;

  const client = await pool.connect();
  try {
    const member = await client.query(
      'SELECT id FROM tenant_memberships WHERE user_id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (member.rows.length === 0) {
      return res.status(404).json({ message: 'User not found in this tenant' });
    }

    // If the user belongs to other tenants, only remove from this one
    const otherMemberships = await client.query(
      'SELECT id FROM tenant_memberships WHERE user_id = $1 AND tenant_id != $2',
      [id, tenantId]
    );

    if (otherMemberships.rows.length > 0) {
      await client.query(
        'DELETE FROM tenant_memberships WHERE user_id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
    } else {
      // No other tenants — delete the user entirely (cascades to profiles + memberships)
      await client.query('DELETE FROM users WHERE id = $1', [id]);
    }

    await invalidate(`tenant:${tenantId}:users`, `user:${id}:me`);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const resetPassword = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  const tenantId = req.user?.tenant_id;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify user belongs to this tenant
    const member = await client.query(
      'SELECT id FROM tenant_memberships WHERE user_id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (member.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found in this tenant' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // Tenant guard in WHERE ensures cross-tenant resets are impossible even if membership
    // check above is somehow bypassed (defence in depth)
    await client.query(
      `UPDATE users SET password = $1, must_change_password = true, updated_at = now()
       WHERE id = $2 AND id IN (SELECT user_id FROM tenant_memberships WHERE tenant_id = $3)`,
      [hashedPassword, id, tenantId]
    );

    await client.query('COMMIT');
    await invalidate(`user:${id}:me`);
    res.json({ message: 'Password reset successfully. User must change it on next login.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
};