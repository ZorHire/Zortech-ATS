import { Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../../db';
import { AuthRequest } from '../../middleware/auth';
import { withCache, invalidate } from '../../lib/cache';

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
  const { email, password, full_name, role } = req.body;
  const tenantId = req.user?.tenant_id;

  if (!email || !password || !role) {
    return res.status(400).json({ message: 'Email, password, and role are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user exists
    const userExists = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;

    if (userExists.rows.length > 0) {
      userId = userExists.rows[0].id;
      // Check if already a member of this tenant
      const memberExists = await client.query(
        'SELECT id FROM tenant_memberships WHERE user_id = $1 AND tenant_id = $2',
        [userId, tenantId]
      );
      if (memberExists.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'User is already a member of this tenant' });
      }
    } else {
      // Create new user
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await client.query(
        'INSERT INTO users (email, password, must_change_password) VALUES ($1, $2, true) RETURNING id',
        [email, hashedPassword]
      );
      userId = newUser.rows[0].id;

      // Create profile
      await client.query(
        'INSERT INTO profiles (id, email, full_name) VALUES ($1, $2, $3)',
        [userId, email, full_name || '']
      );
    }

    // Add membership
    await client.query(
      'INSERT INTO tenant_memberships (user_id, tenant_id, role) VALUES ($1, $2, $3)',
      [userId, tenantId, role]
    );

    await client.query('COMMIT');
    await invalidate(`tenant:${tenantId}:users`);
    res.status(201).json({ message: 'User created and added to tenant successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
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
      await client.query(
        'UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2',
        [is_active, id]
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

export const resetPassword = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  const tenantId = req.user?.tenant_id;

  try {
    // Verify user belongs to tenant
    const member = await pool.query(
      'SELECT id FROM tenant_memberships WHERE user_id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (member.rows.length === 0) {
      return res.status(404).json({ message: 'User not found in this tenant' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password = $1, must_change_password = true, updated_at = now() WHERE id = $2',
      [hashedPassword, id]
    );

    await invalidate(`user:${id}:me`);
    res.json({ message: 'Password reset successfully. User must change it on next login.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};