import { Request, Response } from "express";
import pool from "../../db";
import * as naukriSvc from "./services/naukri.service";

export async function searchExternalResumes(req: Request, res: Response) {
  const tenantId = (req as any).user?.tenantId;
  const q = req.query.q as string;
  const location = req.query.location as string | undefined;
  const minExp = req.query.minExp as string | undefined;
  const maxExp = req.query.maxExp as string | undefined;
  const page = (req.query.page as string) || "1";
  const pageSize = (req.query.pageSize as string) || "20";
  const source = (req.query.source as string) || "naukri";

  if (!q) return res.status(400).json({ message: "q (search query) is required" });

  try {
    let results: Awaited<ReturnType<typeof naukriSvc.searchNaukriResumes>>;

    if (source === "naukri") {
      results = await naukriSvc.searchNaukriResumes({
        keywords: q,
        location,
        minExperience: minExp ? parseInt(minExp) : undefined,
        maxExperience: maxExp ? parseInt(maxExp) : undefined,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      });
    } else {
      return res.status(400).json({ message: `Unsupported source: ${source}` });
    }

    await pool.query(
      `INSERT INTO search_history (tenant_id, user_id, query, filters, source, result_count, searched_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
      [tenantId, (req as any).user?.id, q, JSON.stringify({ location, minExp, maxExp }), source, results.total],
    ).catch(() => {});

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

export async function getExternalResumeDetails(req: Request, res: Response) {
  const candidateId = req.params.candidateId as string;
  const source = (req.query.source as string) || "naukri";

  try {
    let details: Awaited<ReturnType<typeof naukriSvc.getNaukriResumeDetails>>;

    if (source === "naukri") {
      details = await naukriSvc.getNaukriResumeDetails(candidateId);
    } else {
      return res.status(400).json({ message: `Unsupported source: ${source}` });
    }

    res.json(details);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

export async function importExternalCandidate(req: Request, res: Response) {
  const tenantId = (req as any).user?.tenantId;
  const { candidateId, source = "naukri" } = req.body;

  if (!candidateId) return res.status(400).json({ message: "candidateId is required" });

  try {
    let details: Awaited<ReturnType<typeof naukriSvc.getNaukriResumeDetails>>;

    if (source === "naukri") {
      details = await naukriSvc.getNaukriResumeDetails(candidateId);
    } else {
      return res.status(400).json({ message: `Unsupported source: ${source}` });
    }

    const result = await pool.query(
      `INSERT INTO candidates (tenant_id, first_name, last_name, email, phone, source, skills, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (tenant_id, email) DO NOTHING
       RETURNING id`,
      [
        tenantId,
        details.name.split(" ")[0] || details.name,
        details.name.split(" ").slice(1).join(" ") || "",
        details.email || `import-${candidateId}@${source}.imported`,
        details.phone || null,
        source,
        JSON.stringify(details.skills),
      ],
    );

    if (!result.rows[0]) {
      return res.status(409).json({ message: "Candidate with this email already exists" });
    }

    res.status(201).json({ message: "Candidate imported", candidateId: result.rows[0].id });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}
