/**
 * /v1/help: help articles and the help assistant, for every signed-in user
 * (company staff, vendor portal and client portal users each see their own articles).
 */
import { Response, Router } from "express";
import pool from "../../db";
import env from "../../config/env";
import { AuthRequest, authMiddleware, tenantIsolation } from "../../middleware/auth";
import { articlesFor, audienceForRole, searchArticles } from "./articles";
import { askHelp, type Turn } from "./assistant";

const DAILY_LIMIT = 60; // questions per user per day
const MAX_QUESTION = 1000;
const MAX_HISTORY = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Admin",
  accounts_manager: "Accounts manager",
  recruiter: "Recruiter",
  vendor_manager: "Vendor manager",
  vendor_user: "Vendor (vendor portal user)",
  client_user: "Client (client portal user)",
};

export const helpRouter = Router();
helpRouter.use(authMiddleware, tenantIsolation);

const listItem = (a: ReturnType<typeof articlesFor>[number]) => ({ slug: a.slug, title: a.title, category: a.category, summary: a.summary });

/** GET /v1/help/articles?q= */
helpRouter.get("/articles", (req: AuthRequest, res: Response) => {
  const audience = audienceForRole(req.user?.role);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const list = q ? searchArticles(audience, q, 20) : articlesFor(audience);
  res.json({ articles: list.map(listItem), support_email: env.HELP_SUPPORT_EMAIL || null });
});

/** GET /v1/help/articles/:slug */
helpRouter.get("/articles/:slug", (req: AuthRequest, res: Response) => {
  const a = articlesFor(audienceForRole(req.user?.role)).find((x) => x.slug === req.params.slug);
  if (!a) return res.status(404).json({ message: "Help article not found" });
  res.json({ ...listItem(a), body: a.body });
});

/** POST /v1/help/ask { question, history?: [{role, content}], page? } */
helpRouter.post("/ask", async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question) return res.status(400).json({ message: "Type a question first." });
    if (question.length > MAX_QUESTION) return res.status(400).json({ message: `Please keep questions under ${MAX_QUESTION} characters.` });
    const history: Turn[] = (Array.isArray(req.body?.history) ? req.body.history : [])
      .filter((t: unknown): t is Turn => !!t && typeof (t as Turn).content === "string" && ((t as Turn).role === "user" || (t as Turn).role === "assistant"))
      .slice(-MAX_HISTORY)
      .map((t: Turn) => ({ role: t.role, content: t.content.slice(0, 4000) }));
    // The conversation must start with the user and alternate.
    while (history.length && history[0].role !== "user") history.shift();
    const page = typeof req.body?.page === "string" ? req.body.page.slice(0, 200) : null;

    const used = await pool.query(
      `SELECT count(*)::int AS n FROM help_questions WHERE user_id = $1 AND created_at > now() - interval '1 day'`,
      [user.id],
    );
    if (used.rows[0].n >= DAILY_LIMIT) {
      return res.status(429).json({ message: `You've asked ${DAILY_LIMIT} questions in the last day. Please try again tomorrow, or browse the help topics.` });
    }

    const sub = await pool.query(`SELECT plan_type, status FROM subscriptions WHERE tenant_id = $1`, [user.tenant_id]);
    const plan = sub.rows[0] ? `${sub.rows[0].plan_type}${sub.rows[0].status === "trial" ? " (free trial)" : ""}` : null;

    const row = await pool.query(
      `INSERT INTO help_questions (tenant_id, user_id, question, page) VALUES ($1,$2,$3,$4) RETURNING id`,
      [user.tenant_id, user.id, question, page],
    );
    const questionId = row.rows[0].id as string;
    const audience = audienceForRole(user.role);

    const result = await askHelp(
      { tenantId: user.tenant_id, audience, roleLabel: ROLE_LABELS[user.role] ?? user.role, plan, page, questionId },
      history,
      question,
    );

    await pool.query(
      `UPDATE help_questions SET answer = $2, articles = $3::jsonb, ai = $4, unanswered = $5 WHERE id = $1`,
      [questionId, result.answer, JSON.stringify(result.article_slugs), result.ai, !result.answered],
    );

    const titles = new Map(articlesFor(audience).map((a) => [a.slug, a.title]));
    res.json({
      id: questionId,
      answer: result.answer,
      answered: result.answered,
      ai: result.ai,
      articles: result.article_slugs.map((slug) => ({ slug, title: titles.get(slug) ?? slug })),
      links: result.links,
      support_email: !result.answered ? env.HELP_SUPPORT_EMAIL || null : null,
    });
  } catch (err) {
    console.error("help ask error:", err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

/** POST /v1/help/questions/:id/feedback { helpful: boolean, comment? } */
helpRouter.post("/questions/:id/feedback", async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id) || typeof req.body?.helpful !== "boolean") return res.status(400).json({ message: "helpful (true/false) is required" });
  try {
    const r = await pool.query(
      `UPDATE help_questions SET helpful = $3, comment = COALESCE($4, comment) WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, req.user!.id, req.body.helpful, typeof req.body.comment === "string" ? req.body.comment.slice(0, 1000) : null],
    );
    if (!r.rows[0]) return res.status(404).json({ message: "Question not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("help feedback error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});
