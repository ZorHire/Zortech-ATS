"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.updateUser = exports.createUser = exports.listUsers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = __importDefault(require("../../db"));
const listUsers = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        const result = await db_1.default.query(`SELECT u.id, u.email, u.is_active, u.must_change_password, m.role, p.full_name
       FROM users u
       JOIN tenant_memberships m ON u.id = m.user_id
       LEFT JOIN profiles p ON u.id = p.id
       WHERE m.tenant_id = $1
       ORDER BY u.created_at DESC`, [tenantId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.listUsers = listUsers;
const createUser = async (req, res) => {
    const { email, password, full_name, role } = req.body;
    const tenantId = req.user?.tenant_id;
    if (!email || !password || !role) {
        return res.status(400).json({ message: 'Email, password, and role are required' });
    }
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        // Check if user exists
        const userExists = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        let userId;
        if (userExists.rows.length > 0) {
            userId = userExists.rows[0].id;
            // Check if already a member of this tenant
            const memberExists = await client.query('SELECT id FROM tenant_memberships WHERE user_id = $1 AND tenant_id = $2', [userId, tenantId]);
            if (memberExists.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'User is already a member of this tenant' });
            }
        }
        else {
            // Create new user
            const hashedPassword = await bcryptjs_1.default.hash(password, 10);
            const newUser = await client.query('INSERT INTO users (email, password, must_change_password) VALUES ($1, $2, true) RETURNING id', [email, hashedPassword]);
            userId = newUser.rows[0].id;
            // Create profile
            await client.query('INSERT INTO profiles (id, email, full_name) VALUES ($1, $2, $3)', [userId, email, full_name || '']);
        }
        // Add membership
        await client.query('INSERT INTO tenant_memberships (user_id, tenant_id, role) VALUES ($1, $2, $3)', [userId, tenantId, role]);
        await client.query('COMMIT');
        res.status(201).json({ message: 'User created and added to tenant successfully' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Create user error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
    finally {
        client.release();
    }
};
exports.createUser = createUser;
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { role, is_active } = req.body;
    const tenantId = req.user?.tenant_id;
    try {
        await db_1.default.query('BEGIN');
        if (role) {
            await db_1.default.query('UPDATE tenant_memberships SET role = $1, updated_at = now() WHERE user_id = $2 AND tenant_id = $3', [role, id, tenantId]);
        }
        if (is_active !== undefined) {
            await db_1.default.query('UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2', [is_active, id]);
        }
        await db_1.default.query('COMMIT');
        res.json({ message: 'User updated successfully' });
    }
    catch (error) {
        await db_1.default.query('ROLLBACK');
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.updateUser = updateUser;
const resetPassword = async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    const tenantId = req.user?.tenant_id;
    try {
        // Verify user belongs to tenant
        const member = await db_1.default.query('SELECT id FROM tenant_memberships WHERE user_id = $1 AND tenant_id = $2', [id, tenantId]);
        if (member.rows.length === 0) {
            return res.status(404).json({ message: 'User not found in this tenant' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        await db_1.default.query('UPDATE users SET password = $1, must_change_password = true, updated_at = now() WHERE id = $2', [hashedPassword, id]);
        res.json({ message: 'Password reset successfully. User must change it on next login.' });
    }
    catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.resetPassword = resetPassword;
