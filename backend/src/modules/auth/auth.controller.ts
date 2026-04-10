import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../../db';
import env from '../../config/env';

const JWT_SECRET = env.JWT_SECRET;

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // Find user in users table
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Get user memberships and profile
    const membershipResult = await pool.query(
      `SELECT m.tenant_id, m.role, t.name as tenant_name 
       FROM tenant_memberships m 
       JOIN tenants t ON m.tenant_id = t.id 
       WHERE m.user_id = $1 AND m.is_active = true`,
      [user.id]
    );

    const profileResult = await pool.query('SELECT * FROM profiles WHERE id = $1', [user.id]);
    const profile = profileResult.rows[0];

    // For simplicity, we take the first membership if they have multiple, 
    // or provide a list. Usually, an ATS user belongs to one main tenant.
    const primaryMembership = membershipResult.rows[0];

    // Generate token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: primaryMembership?.role, 
        tenant_id: primaryMembership?.tenant_id,
        must_change_password: user.must_change_password 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
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
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const changePassword = async (req: any, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password incorrect' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password = $1, must_change_password = false, updated_at = now() WHERE id = $2',
      [hashedNewPassword, userId]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getMe = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    
    const userResult = await pool.query('SELECT email, must_change_password FROM users WHERE id = $1', [userId]);
    const profileResult = await pool.query('SELECT * FROM profiles WHERE id = $1', [userId]);
    const membershipResult = await pool.query(
      `SELECT m.tenant_id, m.role, t.name as tenant_name 
       FROM tenant_memberships m 
       JOIN tenants t ON m.tenant_id = t.id 
       WHERE m.user_id = $1 AND m.is_active = true`,
      [userId]
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
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};