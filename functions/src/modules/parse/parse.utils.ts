// ---------------------------------------------------------------------------
// Dependencies — kept for fallback when Tika server is unavailable
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth") as {
  extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
};

import { extractTextWithTika } from "../../services/tika.service";
import {
  parseResumeWithGemini,
  parseJobDescriptionWithGemini,
  parseVendorWithGemini,
} from "../../services/gemini.service";
import env from "../../config/env";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ParsedResumeData = {
  name?: string;
  email?: string;
  phone?: string;
  skills?: string[];
  experience_years?: number;
  current_title?: string;
  current_company?: string;
  current_location?: string;
  summary?: string;
  preferred_location?: string;
  notice_period_days?: number;
  current_ctc?: number;
  expected_ctc?: number;
  low_confidence_fields?: string[];
};

export type ParsedJobData = {
  title?: string;
  location?: string;
  required_skills?: string[];
  mandatory_skills?: string[];
  preferred_skills?: string[];
  experience_min?: number;
  experience_max?: number;
  budget_text?: string;
  salary_min?: number;
  salary_max?: number;
  description?: string;
  department?: string;
  work_mode?: string;
  priority?: string;
  headcount?: number;
  low_confidence_fields?: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const normalizeText = (value: string) =>
  value
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();

/**
 * Local fallback extractor — used when Tika is unreachable.
 * Supports PDF (pdf-parse), DOCX/DOC (mammoth), and plain text.
 */
const readFileTextFallback = async (file: Express.Multer.File): Promise<string> => {
  const buffer: Buffer = file.buffer;
  const extension = file.originalname
    ? file.originalname.split(".").pop()?.toLowerCase() ?? ""
    : "";

  console.log(`[Parse] Fallback: ext=${extension}, mime=${file.mimetype}, size=${buffer.length}`);

  if (extension === "pdf" || file.mimetype === "application/pdf") {
    try {
      const result = await pdfParse(buffer);
      const text = result.text || "";
      console.log(`[Parse] pdf-parse extracted ${text.length} chars`);
      return text;
    } catch (err) {
      console.error("[Parse] pdf-parse failed:", err instanceof Error ? err.message : err);
      throw new Error("Failed to extract text from PDF. Please try uploading the file as DOCX or TXT.");
    }
  }

  if (
    extension === "docx" ||
    file.mimetype.includes("officedocument.wordprocessingml.document")
  ) {
    try {
      const data = await mammoth.extractRawText({ buffer });
      const text = data.value || "";
      console.log(`[Parse] mammoth extracted ${text.length} chars`);
      return text;
    } catch (err) {
      console.error("[Parse] mammoth (docx) failed:", err instanceof Error ? err.message : err);
      throw new Error("Failed to extract text from DOCX file. Please try uploading as PDF or TXT.");
    }
  }

  if (extension === "doc" || file.mimetype === "application/msword") {
    try {
      const data = await mammoth.extractRawText({ buffer });
      if (data.value && data.value.trim().length > 20) return data.value;
    } catch {
      // fall through to error below
    }
    throw new Error(
      "Legacy .doc format could not be parsed. Please save the file as .docx or .pdf and re-upload.",
    );
  }

  if (extension === "txt" || file.mimetype.includes("text/plain")) {
    return buffer.toString("utf8");
  }

  throw new Error("Unsupported file type. Please upload PDF, DOCX, or TXT.");
};

const splitListText = (value: string) =>
  value
    .split(/[\n,•\-\*]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const findSectionText = (content: string, label: RegExp) => {
  const match = content.match(label);
  if (!match || match.index === undefined) return "";

  const start = match.index + match[0].length;
  const remainder = content.slice(start).trim();
  const lines = remainder.split(/\r?\n/).map((line) => line.trim());
  const sectionLines: string[] = [];

  for (const line of lines) {
    if (!line) {
      if (sectionLines.length > 0) break;
      continue;
    }
    if (/^[A-Za-z ]{1,30}:/.test(line) && sectionLines.length > 0) break;
    sectionLines.push(line);
    if (sectionLines.length >= 8) break;
  }

  return sectionLines.join(" ");
};

const parseName = (content: string) => {
  const nameLabel = content.match(
    /(?:name|candidate name)[:\s]*([A-Za-z][A-Za-z ,.'-]{1,80})/i,
  );
  if (nameLabel?.[1]) return nameLabel[1].trim();

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    if (/[0-9@]/.test(line)) continue;
    if (/^(Skills|Experience|Education|Summary|Profile|Contact)/i.test(line)) continue;
    if (line.split(" ").length <= 5) return line;
  }
  return "";
};

const parseEmail = (content: string) => {
  const match = content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] || "";
};

const parsePhone = (content: string) => {
  const match = content.match(/(\+?\d[\d\s\-().]{7,}\d)/);
  if (!match) return "";
  const cleaned = match[0].replace(/[\s().-]/g, "");
  return cleaned.length >= 9 ? cleaned : "";
};

const parseExperience = (content: string): { min?: number; max?: number } => {
  const rangeMatch = content.match(
    /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years|yrs|year)\b/i,
  );
  if (rangeMatch) {
    return { min: Number(parseFloat(rangeMatch[1])), max: Number(parseFloat(rangeMatch[2])) };
  }

  const singleMatch = content.match(
    /(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years|yrs|year)\b/i,
  );
  if (singleMatch) {
    const val = Number(parseFloat(singleMatch[1]));
    return { min: val, max: val };
  }

  const underExp = content.match(/experience[:\s]*([0-9]+)/i);
  if (underExp) {
    const val = Number(parseFloat(underExp[1]));
    return { min: val, max: val };
  }

  return {};
};

const KNOWN_SKILLS = [
  "javascript","typescript","python","java","c++","c#","c","go","golang","rust","ruby","php","swift","kotlin","scala","r","matlab","perl","bash","shell",
  "react","vue","angular","next.js","nextjs","nuxt","svelte","html","css","sass","less","tailwind","bootstrap","jquery","redux","mobx","zustand","graphql","rest","websocket",
  "node","node.js","nodejs","express","fastapi","django","flask","spring","laravel","rails","nestjs","fastify","hapi","koa",
  "sql","mysql","postgresql","postgres","mongodb","redis","elasticsearch","cassandra","dynamodb","sqlite","oracle","mssql","firestore","supabase",
  "aws","azure","gcp","docker","kubernetes","terraform","ansible","jenkins","ci/cd","github actions","gitlab ci","linux","nginx","apache",
  "machine learning","deep learning","tensorflow","pytorch","keras","pandas","numpy","scikit-learn","spark","hadoop","tableau","power bi","data analysis","nlp",
  "react native","flutter","ios","android","xamarin",
  "git","jira","figma","postman","webpack","vite","babel","eslint",
];

// Major section headers that end a skills block
const MAJOR_SECTION_RE =
  /^(experience|work experience|employment|education|projects?|certifications?|awards?|achievements?|publications?|interests?|references?|work history|summary|profile|about|objective)\s*$/i;

const parseSkills = (content: string) => {
  // Find the SKILLS section header as a standalone line
  const headerMatch = content.match(
    /(?:^|\n)[ \t]*(skills|technical skills|key skills|core competencies|core skills|technologies)[ \t]*\n/im,
  );

  if (headerMatch && headerMatch.index !== undefined) {
    const start = headerMatch.index + headerMatch[0].length;
    const lines = content.slice(start).split(/\r?\n/);
    const skillItems: string[] = [];
    let blankCount = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        blankCount++;
        // Two consecutive blank lines → end of section
        if (blankCount >= 2) break;
        continue;
      }
      blankCount = 0;

      // A major section header ends the skills block
      if (MAJOR_SECTION_RE.test(line)) break;

      // Strip sub-section label prefix e.g. "Languages:", "Frameworks:", "Tools:"
      const withoutLabel = line.replace(/^[A-Za-z][A-Za-z &\/]{0,25}:\s*/, "");

      // Split on common delimiters
      const items = withoutLabel
        .split(/[,•|\*\/]+/)
        .map((s) => s.replace(/^[-\s]+/, "").trim())
        .filter((s) => s.length > 1 && s.length < 60);

      skillItems.push(...items);
    }

    if (skillItems.length > 0) return skillItems;
  }

  // Fallback: use findSectionText (single-line skills lists work fine here)
  const section = findSectionText(
    content,
    /(?:skills|technical skills|key skills|core competencies|core skills|technologies)[:\s]*/i,
  );
  if (section && section.length > 10) {
    const items = splitListText(section);
    const filtered = items.filter((skill) => skill.length > 1 && skill.length < 60);
    if (filtered.length > 0) return filtered;
  }

  // Last resort: scan for known skill names in the full text
  const lower = content.toLowerCase();
  return KNOWN_SKILLS.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![a-z])${escaped}(?![a-z])`, "i").test(lower);
  });
};

const parseJobTitle = (content: string) => {
  const match = content.match(
    /(?:job title|position|role)[:\s]*([A-Za-z0-9 &\-\/+]{3,100})/i,
  );
  if (match) return match[1].trim();

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 0 && lines[0].length < 80) return lines[0];
  return "";
};

const parseLocation = (content: string) => {
  const match = content.match(/location[:\s]*([A-Za-z0-9 ,\-]+)/i);
  if (match) return match[1].trim();
  const remoteMatch = content.match(/\b(remote|work from home|hybrid|onsite)\b/i);
  return remoteMatch ? remoteMatch[1] : "";
};

const parseNumericString = (s: string): number => Number(s.replace(/,/g, ""));

const parseBudget = (content: string) => {
  const match = content.match(/(?:budget|salary|compensation|ctc)[:\s]*([^\n]+)/i);
  if (!match) return { budget_text: "", salary_min: undefined, salary_max: undefined };

  const budgetText = match[1].trim();
  const valueMatch = budgetText.match(/([\d,]+)\s*(?:-\s*([\d,]+))?/);
  if (!valueMatch) {
    return { budget_text: budgetText, salary_min: undefined, salary_max: undefined };
  }

  const min = parseNumericString(valueMatch[1]);
  const max = valueMatch[2] ? parseNumericString(valueMatch[2]) : undefined;

  return {
    budget_text: budgetText,
    salary_min: min || undefined,
    salary_max: max ?? min,
  };
};

// ---------------------------------------------------------------------------
// Deterministic plausibility checks — applied once after Gemini/regex result
// is chosen, so both paths get checked. Hard-invalid values are clamped and
// flagged (they'd otherwise corrupt a Postgres numeric/integer column). Soft
// anomalies are flagged only, value left untouched, since they might be
// genuinely correct.
// ---------------------------------------------------------------------------
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export const checkResumePlausibility = (
  data: ParsedResumeData,
): { data: ParsedResumeData; flagged: string[] } => {
  const flagged: string[] = [];
  const out = { ...data };

  if (out.experience_years !== undefined && (out.experience_years < 0 || out.experience_years > 50)) {
    out.experience_years = clamp(out.experience_years, 0, 50);
    flagged.push("experience_years");
  }
  if (out.notice_period_days !== undefined && (out.notice_period_days < 0 || out.notice_period_days > 180)) {
    out.notice_period_days = clamp(out.notice_period_days, 0, 180);
    flagged.push("notice_period_days");
  }
  if (out.current_ctc !== undefined && out.current_ctc <= 0) {
    out.current_ctc = undefined;
    flagged.push("current_ctc");
  }
  if (out.expected_ctc !== undefined && out.expected_ctc <= 0) {
    out.expected_ctc = undefined;
    flagged.push("expected_ctc");
  }
  if (out.current_ctc && out.expected_ctc) {
    const ratio = out.expected_ctc / out.current_ctc;
    if ((ratio < 0.5 || ratio > 10) && !flagged.includes("expected_ctc")) {
      flagged.push("expected_ctc"); // soft anomaly — flag only, value untouched
    }
  }

  return { data: out, flagged };
};

export const checkJobPlausibility = (
  data: ParsedJobData,
): { data: ParsedJobData; flagged: string[] } => {
  const flagged: string[] = [];
  const out = { ...data };

  if (
    out.experience_min !== undefined &&
    out.experience_max !== undefined &&
    out.experience_min > out.experience_max
  ) {
    [out.experience_min, out.experience_max] = [out.experience_max, out.experience_min];
    flagged.push("experience_min", "experience_max");
  }
  (["experience_min", "experience_max"] as const).forEach((key) => {
    const v = out[key];
    if (v !== undefined && (v < 0 || v > 50)) {
      out[key] = clamp(v, 0, 50);
      if (!flagged.includes(key)) flagged.push(key);
    }
  });
  if (
    out.salary_min !== undefined &&
    out.salary_max !== undefined &&
    out.salary_min > out.salary_max
  ) {
    [out.salary_min, out.salary_max] = [out.salary_max, out.salary_min];
    flagged.push("salary_min", "salary_max");
  }
  if (out.headcount !== undefined && out.headcount < 1) {
    out.headcount = 1;
    flagged.push("headcount");
  }

  return { data: out, flagged };
};

export const extractFileText = async (file?: Express.Multer.File) => {
  if (!file || !file.buffer) return "";
  console.log("[Parse] File:", file.originalname, "| MIME:", file.mimetype);

  // 1. Try Apache Tika (most reliable — handles PDF, DOCX, DOC, TXT and more)
  const tikaText = await extractTextWithTika(file);
  if (tikaText !== null) {
    const normalized = normalizeText(tikaText);
    console.log(`[Parse] Tika extracted ${normalized.length} chars`);
    return normalized;
  }

  // 2. Tika unavailable — fall back to local parsers
  console.log("[Parse] Using local fallback parsers");
  const text = await readFileTextFallback(file);
  const normalized = normalizeText(text);
  console.log(`[Parse] Fallback extracted ${normalized.length} chars`);
  return normalized;
};

const parseResumeTextRegex = (content: string): ParsedResumeData => {
  const normalized = normalizeText(content);
  return {
    name: parseName(normalized),
    email: parseEmail(normalized),
    phone: parsePhone(normalized),
    skills: parseSkills(normalized),
    experience_years: parseExperience(normalized).min,
    current_title: findSectionText(normalized, /(?:^|\n)\s*(?:current title|job title|designation)\s*[:\-]\s*/im) || "",
    current_company: findSectionText(normalized, /(?:^|\n)\s*(?:current company|current employer|current organization)\s*[:\-]\s*/im) || "",
    current_location: parseLocation(normalized),
    summary: findSectionText(normalized, /(?:summary|profile|about me|professional summary)[:\s]*/i) || "",
  };
};

export const parseResumeText = async (content: string, tenantId: string): Promise<ParsedResumeData> => {
  let result: ParsedResumeData;
  let uncertainFields: string[] = [];

  if (env.GEMINI_API_KEY) {
    try {
      const geminiResult = await parseResumeWithGemini(content, tenantId);
      console.log("[Parse] Gemini resume parse succeeded");
      uncertainFields = geminiResult.uncertain_fields;
      result = geminiResult;
    } catch (err) {
      console.warn("[Parse] Gemini resume parse failed, falling back to regex:", err instanceof Error ? err.message : err);
      result = parseResumeTextRegex(content);
    }
  } else {
    result = parseResumeTextRegex(content);
  }

  const { data, flagged } = checkResumePlausibility(result);
  data.low_confidence_fields = [...new Set([...uncertainFields, ...flagged])];
  return data;
};

export type ParsedVendorData = {
  company_name?: string;
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  industry_specializations?: string[];
  geographies?: string[];
  low_confidence_fields?: string[];
};

const parseVendorTextRegex = (content: string): ParsedVendorData => {
  const normalized = normalizeText(content);
  return {
    company_name:
      findSectionText(normalized, /(?:company|organization|vendor)[:\s]*/i) ||
      normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] ||
      "",
    primary_contact_name: parseName(normalized),
    primary_contact_email: parseEmail(normalized),
    primary_contact_phone: parsePhone(normalized),
    industry_specializations: parseSkills(normalized),
    geographies: [],
  };
};

export const parseVendorText = async (content: string, tenantId: string): Promise<ParsedVendorData> => {
  if (env.GEMINI_API_KEY) {
    try {
      const result = await parseVendorWithGemini(content, tenantId);
      console.log("[Parse] Gemini vendor parse succeeded");
      return { ...result, low_confidence_fields: result.uncertain_fields };
    } catch (err) {
      console.warn("[Parse] Gemini vendor parse failed, falling back to regex:", err instanceof Error ? err.message : err);
    }
  }
  return parseVendorTextRegex(content);
};

const parseJobDescriptionTextRegex = (content: string): ParsedJobData => {
  const normalized = normalizeText(content);
  const skills = parseSkills(normalized);
  const experience = parseExperience(normalized);
  const budget = parseBudget(normalized);

  return {
    title: parseJobTitle(normalized),
    location: parseLocation(normalized),
    required_skills: skills,
    experience_min: experience.min,
    experience_max: experience.max,
    budget_text: budget.budget_text,
    salary_min: budget.salary_min,
    salary_max: budget.salary_max,
    description: normalized.slice(0, 3000),
  };
};

export const parseJobDescriptionText = async (content: string, tenantId: string): Promise<ParsedJobData> => {
  let result: ParsedJobData;
  let uncertainFields: string[] = [];

  if (env.GEMINI_API_KEY) {
    try {
      const geminiResult = await parseJobDescriptionWithGemini(content, tenantId);
      console.log("[Parse] Gemini JD parse succeeded");
      uncertainFields = geminiResult.uncertain_fields;
      result = geminiResult;
    } catch (err) {
      console.warn("[Parse] Gemini JD parse failed, falling back to regex:", err instanceof Error ? err.message : err);
      result = parseJobDescriptionTextRegex(content);
    }
  } else {
    result = parseJobDescriptionTextRegex(content);
  }

  const { data, flagged } = checkJobPlausibility(result);
  data.low_confidence_fields = [...new Set([...uncertainFields, ...flagged])];
  return data;
};
