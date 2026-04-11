"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.changePassword = exports.register = exports.login = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../../db"));
const env_1 = __importDefault(require("../../config/env"));
const JWT_SECRET = env_1.default.JWT_SECRET;
const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        // Find user in users table
        const userResult = await db_1.default.query("SELECT * FROM users WHERE email = $1 AND is_active = true", [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const user = userResult.rows[0];
        // Check password
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        // Get user memberships and profile
        const membershipResult = await db_1.default.query(`SELECT m.tenant_id, m.role, t.name as tenant_name 
       FROM tenant_memberships m 
       JOIN tenants t ON m.tenant_id = t.id 
       WHERE m.user_id = $1 AND m.is_active = true`, [user.id]);
        const profileResult = await db_1.default.query("SELECT * FROM profiles WHERE id = $1", [user.id]);
        const profile = profileResult.rows[0];
        // For simplicity, we take the first membership if they have multiple,
        // or provide a list. Usually, an ATS user belongs to one main tenant.
        const primaryMembership = membershipResult.rows[0];
        // Generate token
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            role: primaryMembership?.role,
            tenant_id: primaryMembership?.tenant_id,
            must_change_password: user.must_change_password,
        }, JWT_SECRET, { expiresIn: "24h" });
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
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.login = login;
const register = async (req, res) => {
    const { email, password, full_name, role = 'recruiter' } = req.body;
    try {
        // Check if user already exists
        const existingUser = await db_1.default.query("SELECT id FROM users WHERE email = $1", [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: "Email already registered" });
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Create user
        const userResult = await db_1.default.query("INSERT INTO users (email, password, is_active, must_change_password) VALUES ($1, $2, $3, $4) RETURNING id", [email, hashedPassword, true, false]);
        const userId = userResult.rows[0].id;
        // Create profile
        await db_1.default.query("INSERT INTO profiles (id, full_name) VALUES ($1, $2)", [userId, full_name]);
        // Get or create default tenant
        const tenantResult = await db_1.default.query("SELECT id FROM tenants WHERE name = 'Default' LIMIT 1");
        let tenantId = tenantResult.rows[0]?.id;
        if (!tenantId) {
            const newTenant = await db_1.default.query("INSERT INTO tenants (name) VALUES ($1) RETURNING id", ['Default']);
            tenantId = newTenant.rows[0].id;
        }
        // Create tenant membership
        await db_1.default.query("INSERT INTO tenant_memberships (user_id, tenant_id, role, is_active) VALUES ($1, $2, $3, $4)", [userId, tenantId, role, true]);
        res.status(201).json({ message: "User registered successfully" });
    }
    catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.register = register;
const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    try {
        const userResult = await db_1.default.query("SELECT * FROM users WHERE id = $1", [
            userId,
        ]);
        const user = userResult.rows[0];
        const isMatch = await bcryptjs_1.default.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Current password incorrect" });
        }
        const hashedNewPassword = await bcryptjs_1.default.hash(newPassword, 10);
        await db_1.default.query("UPDATE users SET password = $1, must_change_password = false, updated_at = now() WHERE id = $2", [hashedNewPassword, userId]);
        res.json({ message: "Password updated successfully" });
    }
    catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.changePassword = changePassword;
const getMe = async (req, res) => {
    try {
        const userId = req.user.id;
        const userResult = await db_1.default.query("SELECT email, must_change_password FROM users WHERE id = $1", [userId]);
        const profileResult = await db_1.default.query("SELECT * FROM profiles WHERE id = $1", [userId]);
        const membershipResult = await db_1.default.query(`SELECT m.tenant_id, m.role, t.name as tenant_name 
       FROM tenant_memberships m 
       JOIN tenants t ON m.tenant_id = t.id 
       WHERE m.user_id = $1 AND m.is_active = true`, [userId]);
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
    }
    catch (error) {
        console.error("Get me error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getMe = getMe;
