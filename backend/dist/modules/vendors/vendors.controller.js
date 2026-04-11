"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVendor = exports.updateVendor = exports.createVendor = exports.getVendorById = exports.getVendors = void 0;
const db_1 = __importDefault(require("../../db"));
const getVendors = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        const result = await db_1.default.query('SELECT * FROM vendors WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY company_name ASC', [tenantId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Get vendors error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getVendors = getVendors;
const getVendorById = async (req, res) => {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    try {
        const result = await db_1.default.query('SELECT * FROM vendors WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL', [id, tenantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Vendor not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Get vendor error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getVendorById = getVendorById;
const createVendor = async (req, res) => {
    const { company_name, registration_number, gst_id, primary_contact_name, primary_contact_email, primary_contact_phone, industry_specializations, geographies, tier } = req.body;
    const tenantId = req.user?.tenant_id;
    try {
        const result = await db_1.default.query(`INSERT INTO vendors (tenant_id, company_name, registration_number, gst_id, primary_contact_name, primary_contact_email, primary_contact_phone, industry_specializations, geographies, tier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`, [tenantId, company_name, registration_number, gst_id, primary_contact_name, primary_contact_email, primary_contact_phone, industry_specializations || [], geographies || [], tier || 'standard']);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Create vendor error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.createVendor = createVendor;
const updateVendor = async (req, res) => {
    const { id } = req.params;
    const { company_name, registration_number, gst_id, primary_contact_name, primary_contact_email, primary_contact_phone, industry_specializations, geographies, tier, is_active } = req.body;
    const tenantId = req.user?.tenant_id;
    try {
        const result = await db_1.default.query(`UPDATE vendors SET 
       company_name = COALESCE($1, company_name),
       registration_number = COALESCE($2, registration_number),
       gst_id = COALESCE($3, gst_id),
       primary_contact_name = COALESCE($4, primary_contact_name),
       primary_contact_email = COALESCE($5, primary_contact_email),
       primary_contact_phone = COALESCE($6, primary_contact_phone),
       industry_specializations = COALESCE($7, industry_specializations),
       geographies = COALESCE($8, geographies),
       tier = COALESCE($9, tier),
       is_active = COALESCE($10, is_active),
       updated_at = now()
       WHERE id = $11 AND tenant_id = $12 AND deleted_at IS NULL
       RETURNING *`, [company_name, registration_number, gst_id, primary_contact_name, primary_contact_email, primary_contact_phone, industry_specializations, geographies, tier, is_active, id, tenantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Vendor not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Update vendor error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.updateVendor = updateVendor;
const deleteVendor = async (req, res) => {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    try {
        const result = await db_1.default.query('UPDATE vendors SET deleted_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Vendor not found' });
        }
        res.json({ message: 'Vendor deleted successfully' });
    }
    catch (error) {
        console.error('Delete vendor error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.deleteVendor = deleteVendor;
