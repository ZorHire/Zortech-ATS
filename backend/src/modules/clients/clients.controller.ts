import { Response } from 'express';
import pool from '../../db';
import { AuthRequest } from '../../middleware/auth';

// ─── GET /clients ────────────────────────────────────────────────────────────
export const getClients = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const result = await pool.query(
      `SELECT c.*,
        COALESCE(
          json_agg(s.* ORDER BY s.created_at) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) AS stakeholders
       FROM clients c
       LEFT JOIN client_stakeholders s ON s.client_id = c.id
       WHERE c.tenant_id = $1 AND c.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY c.name ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── GET /clients/:id ────────────────────────────────────────────────────────
export const getClientById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      `SELECT c.*,
        COALESCE(
          json_agg(s.* ORDER BY s.created_at) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) AS stakeholders
       FROM clients c
       LEFT JOIN client_stakeholders s ON s.client_id = c.id
       WHERE c.id = $1 AND c.tenant_id = $2 AND c.deleted_at IS NULL
       GROUP BY c.id`,
      [id, tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── POST /clients ───────────────────────────────────────────────────────────
export const createClient = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const createdBy = req.user?.id;

  const {
    // Basic — accept both client_name (new form) and name (legacy)
    client_name, name,
    client_type,
    industry,
    company_size,
    website,
    linkedin,
    headquarters_location,
    operating_locations,
    // Primary contact
    primary_contact_name, contact_name,
    primary_contact_email,
    primary_contact_phone,
    alternate_contact,
    // Engagement
    engagement_type,
    hiring_volume,
    active_requirements,
    client_priority,
    sla,
    working_hours,
    // Billing
    billing_model,
    currency,
    markup,
    payment_terms,
    invoice_cycle,
    billing_contact,
    // Contract
    contract_start,
    contract_end,
    msa_signed,
    nda_signed,
    // AI
    preferred_skills,
    typical_roles,
    candidate_preference,
    hiring_strategy,
    interview_process,
    evaluation_criteria,
    // Performance
    positions_closed,
    avg_closure_time,
    interview_ratio,
    offer_acceptance_rate,
    // Communication
    preferred_channel,
    update_frequency,
    auto_report,
    // Internal
    account_manager,
    delivery_lead,
    recruiters,
    // Tags
    tags,
    notes,
    // Legacy fields
    tier,
    logo_url,
    address,
    city,
    country,
    sla_hours,
    // Stakeholders array
    stakeholders,
  } = req.body;

  const resolvedName = (client_name || name || '').trim();
  if (!resolvedName) {
    return res.status(400).json({ message: 'Client name is required' });
  }

  const resolvedContactName = primary_contact_name || contact_name || null;

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const clientResult = await dbClient.query(
      `INSERT INTO clients (
        tenant_id, name, client_type, industry, company_size,
        website, linkedin, headquarters_location, operating_locations,
        primary_contact_name, primary_contact_email, primary_contact_phone, alternate_contact,
        engagement_type, hiring_volume, active_requirements, client_priority, sla, working_hours,
        billing_model, currency, markup, payment_terms, invoice_cycle, billing_contact,
        contract_start, contract_end, msa_signed, nda_signed,
        preferred_skills, typical_roles, candidate_preference, hiring_strategy,
        interview_process, evaluation_criteria,
        positions_closed, avg_closure_time, interview_ratio, offer_acceptance_rate,
        preferred_channel, update_frequency, auto_report,
        account_manager, delivery_lead, recruiters,
        tags, notes,
        tier, logo_url, address, city, country, sla_hours,
        created_by
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,
        $10,$11,$12,$13,
        $14,$15,$16,$17,$18,$19,
        $20,$21,$22,$23,$24,$25,
        $26,$27,$28,$29,
        $30,$31,$32,$33,$34,$35,
        $36,$37,$38,$39,
        $40,$41,$42,
        $43,$44,$45,
        $46,$47,
        $48,$49,$50,$51,$52,$53,
        $54
      ) RETURNING *`,
      [
        tenantId, resolvedName, client_type || null, industry || null, company_size || null,
        website || null, linkedin || null, headquarters_location || null,
        Array.isArray(operating_locations) ? operating_locations : [],
        resolvedContactName, primary_contact_email || null, primary_contact_phone || null, alternate_contact || null,
        engagement_type || null, hiring_volume || null, active_requirements || null,
        client_priority || null, sla || null, working_hours || null,
        billing_model || null, currency || 'INR', markup || null, payment_terms || null,
        invoice_cycle || null, billing_contact || null,
        contract_start || null, contract_end || null,
        msa_signed === true || msa_signed === 'true',
        nda_signed === true || nda_signed === 'true',
        Array.isArray(preferred_skills) ? preferred_skills : [],
        Array.isArray(typical_roles) ? typical_roles : [],
        candidate_preference || null, hiring_strategy || null,
        interview_process || null, evaluation_criteria || null,
        positions_closed || 0, avg_closure_time || null,
        interview_ratio || null, offer_acceptance_rate || null,
        preferred_channel || null, update_frequency || null,
        auto_report === true || auto_report === 'true',
        account_manager || null, delivery_lead || null,
        Array.isArray(recruiters) ? recruiters : [],
        Array.isArray(tags) ? tags : [],
        notes || null,
        tier || 'standard', logo_url || null,
        address || null, city || null, country || 'India',
        sla_hours || 48,
        createdBy,
      ]
    );

    const newClient = clientResult.rows[0];

    // Insert stakeholders if provided
    if (Array.isArray(stakeholders) && stakeholders.length > 0) {
      for (const s of stakeholders) {
        if (!s.name?.trim()) continue;
        await dbClient.query(
          `INSERT INTO client_stakeholders (client_id, tenant_id, name, role, email, phone, timezone)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [newClient.id, tenantId, s.name.trim(), s.role || null, s.email || null, s.phone || null, s.timezone || null]
        );
      }
    }

    await dbClient.query('COMMIT');

    // Return client with stakeholders
    const fullResult = await pool.query(
      `SELECT c.*,
        COALESCE(json_agg(s.* ORDER BY s.created_at) FILTER (WHERE s.id IS NOT NULL), '[]') AS stakeholders
       FROM clients c
       LEFT JOIN client_stakeholders s ON s.client_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [newClient.id]
    );

    res.status(201).json(fullResult.rows[0]);
  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Create client error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    dbClient.release();
  }
};

// ─── PATCH /clients/:id ──────────────────────────────────────────────────────
export const updateClient = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;

  const {
    client_name, name, client_type, industry, company_size,
    website, linkedin, headquarters_location, operating_locations,
    primary_contact_name, contact_name, primary_contact_email, primary_contact_phone, alternate_contact,
    engagement_type, hiring_volume, active_requirements, client_priority, sla, working_hours,
    billing_model, currency, markup, payment_terms, invoice_cycle, billing_contact,
    contract_start, contract_end, msa_signed, nda_signed,
    preferred_skills, typical_roles, candidate_preference, hiring_strategy,
    interview_process, evaluation_criteria,
    positions_closed, avg_closure_time, interview_ratio, offer_acceptance_rate,
    preferred_channel, update_frequency, auto_report,
    account_manager, delivery_lead, recruiters, tags, notes,
    tier, logo_url, address, city, country, sla_hours, is_active,
    stakeholders,
  } = req.body;

  const resolvedName = client_name || name;
  const resolvedContactName = primary_contact_name || contact_name;

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const result = await dbClient.query(
      `UPDATE clients SET
        name                 = COALESCE($1,  name),
        client_type          = COALESCE($2,  client_type),
        industry             = COALESCE($3,  industry),
        company_size         = COALESCE($4,  company_size),
        website              = COALESCE($5,  website),
        linkedin             = COALESCE($6,  linkedin),
        headquarters_location= COALESCE($7,  headquarters_location),
        operating_locations  = COALESCE($8,  operating_locations),
        primary_contact_name = COALESCE($9,  primary_contact_name),
        primary_contact_email= COALESCE($10, primary_contact_email),
        primary_contact_phone= COALESCE($11, primary_contact_phone),
        alternate_contact    = COALESCE($12, alternate_contact),
        engagement_type      = COALESCE($13, engagement_type),
        hiring_volume        = COALESCE($14, hiring_volume),
        active_requirements  = COALESCE($15, active_requirements),
        client_priority      = COALESCE($16, client_priority),
        sla                  = COALESCE($17, sla),
        working_hours        = COALESCE($18, working_hours),
        billing_model        = COALESCE($19, billing_model),
        currency             = COALESCE($20, currency),
        markup               = COALESCE($21, markup),
        payment_terms        = COALESCE($22, payment_terms),
        invoice_cycle        = COALESCE($23, invoice_cycle),
        billing_contact      = COALESCE($24, billing_contact),
        contract_start       = COALESCE($25, contract_start),
        contract_end         = COALESCE($26, contract_end),
        msa_signed           = COALESCE($27, msa_signed),
        nda_signed           = COALESCE($28, nda_signed),
        preferred_skills     = COALESCE($29, preferred_skills),
        typical_roles        = COALESCE($30, typical_roles),
        candidate_preference = COALESCE($31, candidate_preference),
        hiring_strategy      = COALESCE($32, hiring_strategy),
        interview_process    = COALESCE($33, interview_process),
        evaluation_criteria  = COALESCE($34, evaluation_criteria),
        positions_closed     = COALESCE($35, positions_closed),
        avg_closure_time     = COALESCE($36, avg_closure_time),
        interview_ratio      = COALESCE($37, interview_ratio),
        offer_acceptance_rate= COALESCE($38, offer_acceptance_rate),
        preferred_channel    = COALESCE($39, preferred_channel),
        update_frequency     = COALESCE($40, update_frequency),
        auto_report          = COALESCE($41, auto_report),
        account_manager      = COALESCE($42, account_manager),
        delivery_lead        = COALESCE($43, delivery_lead),
        recruiters           = COALESCE($44, recruiters),
        tags                 = COALESCE($45, tags),
        notes                = COALESCE($46, notes),
        tier                 = COALESCE($47, tier),
        logo_url             = COALESCE($48, logo_url),
        address              = COALESCE($49, address),
        city                 = COALESCE($50, city),
        country              = COALESCE($51, country),
        sla_hours            = COALESCE($52, sla_hours),
        is_active            = COALESCE($53, is_active),
        updated_at           = now()
       WHERE id = $54 AND tenant_id = $55 AND deleted_at IS NULL
       RETURNING *`,
      [
        resolvedName, client_type, industry, company_size,
        website, linkedin, headquarters_location,
        Array.isArray(operating_locations) ? operating_locations : null,
        resolvedContactName, primary_contact_email, primary_contact_phone, alternate_contact,
        engagement_type, hiring_volume, active_requirements, client_priority, sla, working_hours,
        billing_model, currency, markup, payment_terms, invoice_cycle, billing_contact,
        contract_start || null, contract_end || null,
        msa_signed !== undefined ? (msa_signed === true || msa_signed === 'true') : null,
        nda_signed !== undefined ? (nda_signed === true || nda_signed === 'true') : null,
        Array.isArray(preferred_skills) ? preferred_skills : null,
        Array.isArray(typical_roles) ? typical_roles : null,
        candidate_preference, hiring_strategy, interview_process, evaluation_criteria,
        positions_closed, avg_closure_time, interview_ratio, offer_acceptance_rate,
        preferred_channel, update_frequency,
        auto_report !== undefined ? (auto_report === true || auto_report === 'true') : null,
        account_manager, delivery_lead,
        Array.isArray(recruiters) ? recruiters : null,
        Array.isArray(tags) ? tags : null,
        notes,
        tier, logo_url, address, city, country, sla_hours, is_active,
        id, tenantId,
      ]
    );

    if (result.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ message: 'Client not found' });
    }

    // Replace stakeholders if provided
    if (Array.isArray(stakeholders)) {
      await dbClient.query('DELETE FROM client_stakeholders WHERE client_id = $1', [id]);
      for (const s of stakeholders) {
        if (!s.name?.trim()) continue;
        await dbClient.query(
          `INSERT INTO client_stakeholders (client_id, tenant_id, name, role, email, phone, timezone)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, tenantId, s.name.trim(), s.role || null, s.email || null, s.phone || null, s.timezone || null]
        );
      }
    }

    await dbClient.query('COMMIT');

    const fullResult = await pool.query(
      `SELECT c.*,
        COALESCE(json_agg(s.* ORDER BY s.created_at) FILTER (WHERE s.id IS NOT NULL), '[]') AS stakeholders
       FROM clients c
       LEFT JOIN client_stakeholders s ON s.client_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id]
    );

    res.json(fullResult.rows[0]);
  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Update client error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    dbClient.release();
  }
};

// ─── DELETE /clients/:id ─────────────────────────────────────────────────────
export const deleteClient = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      'UPDATE clients SET deleted_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
