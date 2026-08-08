import crypto from 'crypto';
import { Request, Response } from 'express';
import pool from '../../db';
import env from '../../config/env';
import { AuthRequest } from '../../middleware/auth';
import { getAllAdapters, getAdapter } from './adapters/base.adapter';
import type { JobBoardCredentials } from './adapters/base.adapter';

// Import all adapters so they self-register
import './adapters/linkedin.adapter';
import './adapters/indeed.adapter';
import './adapters/india-boards.adapter';

// ── Encryption helpers (AES-256-GCM, same scheme as email.controller) ────────

function encrypt(plaintext: string): string {
  const key = Buffer.from(env.ENCRYPTION_KEY.slice(0, 64), 'hex');
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;
}

function decrypt(stored: string): string {
  const key = Buffer.from(env.ENCRYPTION_KEY.slice(0, 64), 'hex');
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted credential');
  const [ivHex, tagHex, ctHex] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(ctHex, 'hex')).toString('utf8') + decipher.final('utf8');
}

function safeDecrypt(stored: string | null | undefined): string | undefined {
  if (!stored) return undefined;
  if (!env.ENCRYPTION_KEY || env.ENCRYPTION_KEY.length < 64) return undefined;
  try { return decrypt(stored); } catch { return undefined; }
}

// ── List all boards with connection status ────────────────────────────────────

export const listBoards = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  try {
    const { rows } = await pool.query(
      `SELECT board_key, connected_at, extra_config FROM job_board_credentials WHERE tenant_id = $1`,
      [tenantId],
    );
    const connected = new Map(rows.map((r) => [r.board_key, r]));

    const boards = getAllAdapters().map((adapter) => {
      const cred = connected.get(adapter.key);
      return {
        key:          adapter.key,
        name:         adapter.name,
        color:        adapter.color,
        configFields: adapter.configFields,
        connected:    !!cred,
        connected_at: cred?.connected_at ?? null,
      };
    });

    res.json({ boards });
  } catch (error) {
    console.error('listBoards error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── Connect a board (save / update credentials) ───────────────────────────────

export const connectBoard = async (req: AuthRequest, res: Response) => {
  const boardKey = req.params.boardKey as string;
  const { access_token, refresh_token, token_expires_at, webhook_secret, extra_config } = req.body as {
    access_token?: string;
    refresh_token?: string;
    token_expires_at?: string;
    webhook_secret?: string;
    extra_config?: Record<string, unknown>;
  };

  if (!getAdapter(boardKey)) {
    return res.status(400).json({ message: `Unknown board: ${boardKey}` });
  }
  if (!access_token) {
    return res.status(400).json({ message: 'access_token is required' });
  }

  const tenantId = req.user?.tenant_id;
  const userId   = req.user?.id;

  let encryptedAccess: string;
  let encryptedRefresh: string | null = null;
  try {
    encryptedAccess  = encrypt(access_token);
    if (refresh_token) encryptedRefresh = encrypt(refresh_token);
  } catch {
    return res.status(400).json({ message: 'EMAIL_ENCRYPTION_KEY is not set — cannot encrypt credentials.' });
  }

  try {
    await pool.query(
      `INSERT INTO job_board_credentials
         (tenant_id, board_key, access_token, refresh_token, token_expires_at, webhook_secret, extra_config, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tenant_id, board_key) DO UPDATE SET
         access_token     = EXCLUDED.access_token,
         refresh_token    = EXCLUDED.refresh_token,
         token_expires_at = EXCLUDED.token_expires_at,
         webhook_secret   = EXCLUDED.webhook_secret,
         extra_config     = EXCLUDED.extra_config,
         connected_at     = now()`,
      [tenantId, boardKey, encryptedAccess, encryptedRefresh,
       token_expires_at ?? null, webhook_secret ?? null,
       JSON.stringify(extra_config ?? {}), userId],
    );
    res.json({ message: `${boardKey} connected successfully` });
  } catch (error) {
    console.error('connectBoard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── Disconnect a board ────────────────────────────────────────────────────────

export const disconnectBoard = async (req: AuthRequest, res: Response) => {
  const { boardKey } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    await pool.query(
      `DELETE FROM job_board_credentials WHERE tenant_id = $1 AND board_key = $2`,
      [tenantId, boardKey],
    );
    res.json({ message: `${boardKey} disconnected` });
  } catch (error) {
    console.error('disconnectBoard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── Get posting status for a job (all boards) ─────────────────────────────────

export const getJobPostings = async (req: AuthRequest, res: Response) => {
  const { jobId } = req.params;
  const tenantId  = req.user?.tenant_id;
  try {
    const { rows } = await pool.query(
      `SELECT board_key, external_job_id, status, posted_at, expires_at,
              error_message, application_count, updated_at
       FROM job_board_postings
       WHERE tenant_id = $1 AND job_id = $2`,
      [tenantId, jobId],
    );
    const postingMap = new Map(rows.map((r) => [r.board_key, r]));

    const postings = getAllAdapters().map((adapter) => {
      const p = postingMap.get(adapter.key);
      return {
        board_key:         adapter.key,
        board_name:        adapter.name,
        board_color:       adapter.color,
        status:            p?.status ?? 'not_posted',
        external_job_id:   p?.external_job_id ?? null,
        posted_at:         p?.posted_at ?? null,
        expires_at:        p?.expires_at ?? null,
        error_message:     p?.error_message ?? null,
        application_count: p?.application_count ?? 0,
        updated_at:        p?.updated_at ?? null,
      };
    });

    res.json({ postings });
  } catch (error) {
    console.error('getJobPostings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── Publish a job to selected boards ─────────────────────────────────────────

export const publishJob = async (req: AuthRequest, res: Response) => {
  const { jobId }      = req.params;
  const { board_keys } = req.body as { board_keys: string[] };
  const tenantId       = req.user?.tenant_id;

  if (!Array.isArray(board_keys) || board_keys.length === 0) {
    return res.status(400).json({ message: 'board_keys must be a non-empty array' });
  }

  try {
    // Fetch job details
    const jobResult = await pool.query(
      `SELECT title, description, location, work_mode, employment_type,
              experience_min, experience_max, salary_min, salary_max, currency,
              mandatory_skills, preferred_skills
       FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [jobId, tenantId],
    );
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }
    const job = jobResult.rows[0];

    // Fetch credentials for all requested boards
    const { rows: credRows } = await pool.query(
      `SELECT board_key, access_token, refresh_token, token_expires_at, extra_config
       FROM job_board_credentials WHERE tenant_id = $1 AND board_key = ANY($2)`,
      [tenantId, board_keys],
    );
    const credMap = new Map(credRows.map((r) => [r.board_key, r]));

    const results: Array<{ board_key: string; success: boolean; error?: string }> = [];

    for (const boardKey of board_keys) {
      const adapter = getAdapter(boardKey);
      if (!adapter) {
        results.push({ board_key: boardKey, success: false, error: `Unknown board: ${boardKey}` });
        continue;
      }

      const rawCred = credMap.get(boardKey);
      if (!rawCred) {
        results.push({ board_key: boardKey, success: false, error: `${adapter.name} is not connected. Add credentials in Settings → Job Boards.` });
        continue;
      }

      // Build decrypted credentials
      const credentials: JobBoardCredentials = {
        access_token:     safeDecrypt(rawCred.access_token),
        refresh_token:    safeDecrypt(rawCred.refresh_token),
        token_expires_at: rawCred.token_expires_at ? new Date(rawCred.token_expires_at) : undefined,
        extra_config:     rawCred.extra_config ?? {},
      };

      // Auto-refresh token if expired and adapter supports it
      if (
        adapter.refreshToken &&
        credentials.token_expires_at &&
        credentials.token_expires_at < new Date()
      ) {
        try {
          const refreshed = await adapter.refreshToken(credentials);
          credentials.access_token    = refreshed.access_token;
          credentials.token_expires_at = refreshed.expires_at;
          const newEncrypted = encrypt(refreshed.access_token);
          await pool.query(
            `UPDATE job_board_credentials SET access_token = $1, token_expires_at = $2
             WHERE tenant_id = $3 AND board_key = $4`,
            [newEncrypted, refreshed.expires_at, tenantId, boardKey],
          );
        } catch (refreshErr) {
          const msg = refreshErr instanceof Error ? refreshErr.message : 'Token refresh failed';
          results.push({ board_key: boardKey, success: false, error: msg });
          continue;
        }
      }

      try {
        const postResult = await adapter.postJob(job, credentials);
        await pool.query(
          `INSERT INTO job_board_postings
             (tenant_id, job_id, board_key, external_job_id, status, posted_at, expires_at, application_count)
           VALUES ($1,$2,$3,$4,'active',now(),$5,0)
           ON CONFLICT (tenant_id, job_id, board_key) DO UPDATE SET
             external_job_id = EXCLUDED.external_job_id,
             status          = 'active',
             posted_at       = now(),
             expires_at      = EXCLUDED.expires_at,
             error_message   = NULL,
             updated_at      = now()`,
          [tenantId, jobId, boardKey, postResult.external_job_id, postResult.expires_at ?? null],
        );
        results.push({ board_key: boardKey, success: true });
      } catch (postErr) {
        const msg = postErr instanceof Error ? postErr.message : 'Posting failed';
        await pool.query(
          `INSERT INTO job_board_postings (tenant_id, job_id, board_key, status, error_message)
           VALUES ($1,$2,$3,'error',$4)
           ON CONFLICT (tenant_id, job_id, board_key) DO UPDATE SET
             status = 'error', error_message = EXCLUDED.error_message, updated_at = now()`,
          [tenantId, jobId, boardKey, msg],
        );
        results.push({ board_key: boardKey, success: false, error: msg });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('publishJob error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── Withdraw a job from a board ───────────────────────────────────────────────

export const withdrawJob = async (req: AuthRequest, res: Response) => {
  const { jobId } = req.params;
  const boardKey = req.params.boardKey as string;
  const tenantId = req.user?.tenant_id;

  const adapter = getAdapter(boardKey);
  if (!adapter) return res.status(400).json({ message: `Unknown board: ${boardKey}` });

  try {
    const { rows } = await pool.query(
      `SELECT jbp.external_job_id, jbc.access_token, jbc.extra_config
       FROM job_board_postings jbp
       LEFT JOIN job_board_credentials jbc ON jbc.tenant_id = jbp.tenant_id AND jbc.board_key = jbp.board_key
       WHERE jbp.tenant_id = $1 AND jbp.job_id = $2 AND jbp.board_key = $3`,
      [tenantId, jobId, boardKey],
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Posting not found' });

    const row = rows[0];
    if (row.external_job_id && row.access_token) {
      const credentials: JobBoardCredentials = {
        access_token: safeDecrypt(row.access_token),
        extra_config: row.extra_config ?? {},
      };
      try { await adapter.withdrawJob(row.external_job_id, credentials); } catch { /* best-effort */ }
    }

    await pool.query(
      `UPDATE job_board_postings SET status = 'withdrawn', updated_at = now()
       WHERE tenant_id = $1 AND job_id = $2 AND board_key = $3`,
      [tenantId, jobId, boardKey],
    );
    res.json({ message: `Withdrawn from ${adapter.name}` });
  } catch (error) {
    console.error('withdrawJob error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── Webhook: receive application from a board ─────────────────────────────────
// No auth middleware — called by external services.
// Verifies webhook_secret when stored (compares X-Webhook-Secret header).

export const handleWebhook = async (req: Request, res: Response) => {
  const boardKey = req.params.boardKey as string;
  const adapter = getAdapter(boardKey);
  if (!adapter) return res.status(400).json({ message: 'Unknown board' });

  const incoming = adapter.parseWebhook(req.body, req.headers as Record<string, string>);
  if (!incoming) {
    return res.status(200).json({ message: 'Event ignored' });
  }

  try {
    // Single JOIN query: get posting + credentials atomically so secret check comes first
    const { rows } = await pool.query(
      `SELECT jbp.tenant_id, jbp.job_id, jbc.webhook_secret
       FROM job_board_postings jbp
       LEFT JOIN job_board_credentials jbc
         ON jbc.tenant_id = jbp.tenant_id AND jbc.board_key = jbp.board_key
       WHERE jbp.board_key = $1 AND jbp.external_job_id = $2
       LIMIT 1`,
      [boardKey, incoming.external_job_id],
    );
    if (rows.length === 0) {
      return res.status(200).json({ message: 'Job posting not found — ignoring' });
    }

    const { tenant_id: tenantId, job_id: jobId, webhook_secret: storedSecret } = rows[0];

    // Auth check BEFORE touching any payload data — constant-time comparison prevents timing attacks
    if (storedSecret) {
      const provided = String(req.headers['x-webhook-secret'] || req.headers['x-hub-signature-256'] || '');
      const providedBuf = Buffer.from(provided);
      const expectedBuf = Buffer.from(storedSecret);
      if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
        return res.status(401).json({ message: 'Invalid webhook secret' });
      }
    }

    // ── Deduplication: check for existing candidate by email ──────────────────
    const { email, first_name, last_name, phone, current_location, experience_years, resume_url } = incoming.candidate;

    let candidateId: string | null = null;

    const emailMatch = await pool.query(
      `SELECT id FROM candidates WHERE tenant_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
      [tenantId, email],
    );
    if (emailMatch.rows.length > 0) {
      candidateId = emailMatch.rows[0].id;
    }

    // Phone dedup if no email match
    if (!candidateId && phone) {
      const phoneMatch = await pool.query(
        `SELECT id FROM candidates WHERE tenant_id = $1 AND phone = $2 LIMIT 1`,
        [tenantId, phone],
      );
      if (phoneMatch.rows.length > 0) candidateId = phoneMatch.rows[0].id;
    }

    // Create new candidate if no match found
    if (!candidateId) {
      const newCandidate = await pool.query(
        `INSERT INTO candidates
           (tenant_id, first_name, last_name, email, phone, location,
            experience_years, resume_url, source, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'job_board','active')
         RETURNING id`,
        [tenantId, first_name, last_name, email, phone ?? null,
         current_location ?? null, experience_years ?? null, resume_url ?? null],
      );
      candidateId = newCandidate.rows[0].id;
    }

    // Create job application if not already linked
    await pool.query(
      `INSERT INTO job_applications (tenant_id, job_id, candidate_id, stage, source)
       VALUES ($1,$2,$3,'applied','job_board')
       ON CONFLICT (job_id, candidate_id) DO NOTHING`,
      [tenantId, jobId, candidateId],
    );

    // Increment application_count on the posting row
    await pool.query(
      `UPDATE job_board_postings SET application_count = application_count + 1, updated_at = now()
       WHERE tenant_id = $1 AND job_id = $2 AND board_key = $3`,
      [tenantId, jobId, boardKey],
    );

    res.status(200).json({ message: 'Application ingested', candidate_id: candidateId });
  } catch (error) {
    console.error('handleWebhook error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
