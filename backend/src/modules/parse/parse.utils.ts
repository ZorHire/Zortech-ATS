// ---------------------------------------------------------------------------
// Dependencies — kept for fallback when Tika server is unavailable
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (
  buffer: Buffer | Uint8Array | string,
) => Promise<{ text: string }>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth") as {
  extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
};

import { extractTextWithTika } from "../../services/tika.service";

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
};

export type ParsedJobData = {
  title?: string;
  location?: string;
  required_skills?: string[];
  experience_min?: number;
  experience_max?: number;
  budget_text?: string;
  salary_min?: number;
  salary_max?: number;
  description?: string;
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
  // file.buffer is populated by multer memoryStorage
  const buffer: Buffer = file.buffer;
  const extension = file.originalname
    ? (file.originalname.split(".").pop()?.toLowerCase() ?? "")
    : "";

  if (extension === "pdf" || file.mimetype === "application/pdf") {
    const result = await pdfParse(buffer);
    return result.text || "";
  }

  if (
    extension === "docx" ||
    file.mimetype.includes("officedocument.wordprocessingml.document")
  ) {
    const data = await mammoth.extractRawText({ buffer });
    return data.value || "";
  }

  if (extension === "doc" || file.mimetype === "application/msword") {
    try {
      const data = await mammoth.extractRawText({ buffer });
      if (data.value && data.value.trim().length > 20) return data.value;
    } catch {
      // fall through to clear error message below
    }
    throw new Error("Legacy .doc not supported. Please upload .docx or PDF.");
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
    if (/^[A-Za-z ]{1,30}:/.test(line) && sectionLines.length > 0) {
      break;
    }
    sectionLines.push(line);
    if (sectionLines.length >= 8) break;
  }

  return sectionLines.join(" ");
};

// Common job-title keywords — used to avoid misidentifying a title line as the name
const JOB_TITLE_WORD_RE =
  /\b(senior|junior|lead|principal|staff|associate|chief|head|vp|director|manager|officer|executive|specialist|consultant|analyst|architect|engineer|developer|designer|scientist|researcher|strategist|coordinator|administrator|advisor|intern|trainee)\b/i;

const isTitleCase = (text: string): boolean =>
  text
    .trim()
    .split(/\s+/)
    .every((w) => /^[A-Z]/.test(w));

const parseName = (content: string) => {
  // 1. Explicit "Name:" label
  const nameLabel = content.match(
    /(?:name|candidate name)[:\s]*([A-Za-z][A-Za-z ,.'-]{1,80})/i,
  );
  if (nameLabel?.[1]) return nameLabel[1].trim();

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // 2. First title-cased line (2-4 words, no digits/@ , not a section heading, not a job title)
  for (const line of lines.slice(0, 8)) {
    if (/[0-9@]/.test(line)) continue;
    if (
      /^(Skills|Experience|Education|Summary|Profile|Contact|Objective|References|Certifications)/i.test(
        line,
      )
    )
      continue;
    if (JOB_TITLE_WORD_RE.test(line)) continue; // skip job-title-like lines
    const wordCount = line.split(/\s+/).length;
    if (wordCount >= 2 && wordCount <= 4 && isTitleCase(line)) return line;
  }

  // 3. Relaxed fallback — any short line from first 5
  for (const line of lines.slice(0, 5)) {
    if (/[0-9@]/.test(line)) continue;
    if (
      /^(Skills|Experience|Education|Summary|Profile|Contact)/i.test(line)
    )
      continue;
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
  // Handle range: "4-7 years" or "4 to 7 years"
  const rangeMatch = content.match(
    /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years|yrs|year)\b/i,
  );
  if (rangeMatch) {
    return {
      min: Number(parseFloat(rangeMatch[1])),
      max: Number(parseFloat(rangeMatch[2])),
    };
  }

  // Handle single value: "5+ years"
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

// Broad keyword list used as a fallback when section parsing yields nothing
const KNOWN_SKILLS = [
  // Languages
  "javascript",
  "typescript",
  "python",
  "java",
  "c++",
  "c#",
  "c",
  "go",
  "golang",
  "rust",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "scala",
  "r",
  "matlab",
  "perl",
  "bash",
  "shell",
  // Frontend
  "react",
  "vue",
  "angular",
  "next.js",
  "nextjs",
  "nuxt",
  "svelte",
  "html",
  "css",
  "sass",
  "less",
  "tailwind",
  "bootstrap",
  "jquery",
  "redux",
  "mobx",
  "zustand",
  "graphql",
  "rest",
  "websocket",
  // Backend
  "node",
  "node.js",
  "nodejs",
  "express",
  "fastapi",
  "django",
  "flask",
  "spring",
  "laravel",
  "rails",
  "nestjs",
  "fastify",
  "hapi",
  "koa",
  // Databases
  "sql",
  "mysql",
  "postgresql",
  "postgres",
  "mongodb",
  "redis",
  "elasticsearch",
  "cassandra",
  "dynamodb",
  "sqlite",
  "oracle",
  "mssql",
  "firestore",
  "supabase",
  // Cloud & DevOps
  "aws",
  "azure",
  "gcp",
  "docker",
  "kubernetes",
  "terraform",
  "ansible",
  "jenkins",
  "ci/cd",
  "github actions",
  "gitlab ci",
  "linux",
  "nginx",
  "apache",
  // Data & ML
  "machine learning",
  "deep learning",
  "tensorflow",
  "pytorch",
  "keras",
  "pandas",
  "numpy",
  "scikit-learn",
  "spark",
  "hadoop",
  "tableau",
  "power bi",
  "data analysis",
  "nlp",
  // Mobile
  "react native",
  "flutter",
  "ios",
  "android",
  "xamarin",
  // Tools
  "git",
  "jira",
  "figma",
  "postman",
  "webpack",
  "vite",
  "babel",
  "eslint",
];

const parseSkills = (content: string) => {
  // First try to find a skills section
  const section = findSectionText(
    content,
    /(?:skills|technical skills|key skills|core competencies|core skills|technologies)[:\s]*/i,
  );

  if (section && section.length > 10) {
    const items = splitListText(section);
    const filtered = items.filter(
      (skill) => skill.length > 1 && skill.length < 60,
    );
    if (filtered.length > 0) return filtered;
  }

  // Fallback: scan the whole text for known skill keywords
  const lower = content.toLowerCase();
  return KNOWN_SKILLS.filter((skill) => {
    // Use word-boundary-like check to avoid false positives (e.g. "c" matching "catch")
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

  if (lines.length > 0 && lines[0].length < 80) {
    return lines[0];
  }

  return "";
};

const parseLocation = (content: string) => {
  const match = content.match(/location[:\s]*([A-Za-z0-9 ,\-]+)/i);
  if (match) return match[1].trim();
  const remoteMatch = content.match(
    /\b(remote|work from home|hybrid|onsite)\b/i,
  );
  return remoteMatch ? remoteMatch[1] : "";
};

// ---------------------------------------------------------------------------
// Headingless-resume heuristics
// These run as fallbacks when labeled-section parsing finds nothing.
// ---------------------------------------------------------------------------

/**
 * Infer current job title from free-form text.
 * Strategies (in order):
 *  1. "I am a/an [Title]", "working as [Title]", "as a [Title]", "role: [Title]"
 *  2. First short line in the opening block that contains a title keyword
 */
const parseCurrentTitleFromContent = (content: string): string => {
  // Inline role declaration
  const roleMatch = content.match(
    /(?:i(?:'m| am) (?:a |an )?|working as (?:a |an )?|as (?:a |an )?|currently (?:a |an )?|position[:\s]+(?:a |an )?)([A-Za-z][A-Za-z /\-]{3,60}?)(?:\s+at\s|\s+with\s|\s+for\s|\s+@\s|[,.\n]|$)/i,
  );
  if (roleMatch?.[1]) {
    const candidate = roleMatch[1].trim();
    if (JOB_TITLE_WORD_RE.test(candidate)) return candidate;
  }

  // Standalone title line near the top
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 12)) {
    if (/[0-9@+]/.test(line) && !/[A-Za-z]{4,}/.test(line)) continue;
    if (
      /^(Skills|Experience|Education|Summary|Profile|Contact|Objective)/i.test(
        line,
      )
    )
      continue;
    const wordCount = line.split(/\s+/).length;
    if (
      wordCount >= 1 &&
      wordCount <= 8 &&
      line.length < 80 &&
      JOB_TITLE_WORD_RE.test(line)
    ) {
      return line;
    }
  }

  return "";
};

/**
 * Infer current company from free-form text.
 * Strategies:
 *  1. "at [Company]" / "with [Company]" / "for [Company]" patterns
 *  2. Corporate suffix — "[Name] Inc / Ltd / LLC / Corp …"
 */
const parseCurrentCompanyFromContent = (content: string): string => {
  // "at / with / for [Company]" — company starts with capital letter
  const atMatch = content.match(
    /(?:\bat\b|\bwith\b|\bfor\b)\s+([A-Z][A-Za-z0-9 &.,'-]{1,60}?)(?:\s+(?:Inc|Ltd|LLC|Corp|Limited|Technologies|Tech|Solutions|Systems|Services|International|Global|Group)\.?)?(?=[,.\n]|$|\s+(?:as|where|since|from|and|in\b))/,
  );
  if (atMatch?.[1]) {
    const company = atMatch[1].trim();
    // Skip common false positives
    if (
      !/^(the|a|an|my|our|your|this|that|which|who|what|where|when|how|present|least|most)\b/i.test(
        company,
      )
    ) {
      return company;
    }
  }

  // Corporate suffix anywhere in text
  const corpMatch = content.match(
    /([A-Z][A-Za-z0-9 &'-]{1,40}?)\s+(?:Inc|Ltd|LLC|Corp|Limited|Technologies|Tech|Solutions|Systems|Services)\.?(?=[^A-Za-z]|$)/,
  );
  if (corpMatch?.[1]) return corpMatch[1].trim();

  return "";
};

/**
 * Extract a summary/profile from free-form text (no "Summary:" heading).
 * Takes the first paragraph that looks like a professional bio.
 */
const parseSummaryFromContent = (content: string): string => {
  // Try paragraph-based split first
  const paragraphs = content.split(/\n{2,}/);
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length < 60) continue;
    if (/@/.test(trimmed) || /^\+?\d/.test(trimmed)) continue;
    // Skip skill-list-only paragraphs (mostly short comma-separated tokens)
    const lines = trimmed.split("\n");
    const avgLen =
      lines.reduce((s, l) => s + l.length, 0) / (lines.length || 1);
    if (lines.length <= 3 && avgLen < 40) continue;
    return trimmed.slice(0, 500);
  }

  // Fallback: first sentence longer than 60 chars that isn't contact info
  const sentences = content.split(/(?<=[.!?])\s+/);
  const bio = sentences.find(
    (s) => s.trim().length > 60 && !/@/.test(s) && !/^\+?\d/.test(s.trim()),
  );
  return bio ? bio.trim().slice(0, 500) : "";
};

/**
 * Calculate total years of experience from date ranges found in text.
 * Handles formats like "2018 - 2023", "Jan 2019 – Present", "2019 to 2024".
 * Returns undefined when no date ranges are found.
 */
const calculateExperienceFromDates = (content: string): number | undefined => {
  const currentYear = new Date().getFullYear();
  const ranges: Array<[number, number]> = [];

  const rangeRe =
    /(\d{4})\s*[-–—]|to\s+(\d{4}|present|current|now|till\s+date|till\s+now)/gi;

  // Simpler full-range scan: "YYYY … YYYY|present"
  const fullRangeRe =
    /(\d{4})\s*(?:[-–—]|to)\s*(\d{4}|present|current|now|till\s*date|till\s*now)/gi;
  let m: RegExpExecArray | null;
  while ((m = fullRangeRe.exec(content)) !== null) {
    const start = parseInt(m[1], 10);
    const endRaw = m[2];
    const end = /\d{4}/.test(endRaw) ? parseInt(endRaw, 10) : currentYear;
    if (
      start >= 1970 &&
      start <= currentYear &&
      end >= start &&
      end <= currentYear + 1
    ) {
      ranges.push([start, end]);
    }
  }
  // Suppress unused variable warning
  void rangeRe;

  if (ranges.length === 0) return undefined;

  // Use min-start → max-end as a conservative total span
  const minStart = Math.min(...ranges.map((r) => r[0]));
  const maxEnd = Math.max(...ranges.map((r) => r[1]));
  return maxEnd - minStart || undefined;
};

// Parse a number string that may use Indian (1,00,000) or Western (100,000) comma formatting
const parseNumericString = (s: string): number => {
  // Remove all commas then parse — handles both 1,00,000 and 1,000,000
  return Number(s.replace(/,/g, ""));
};

const parseBudget = (content: string) => {
  const match = content.match(
    /(?:budget|salary|compensation|ctc)[:\s]*([^\n]+)/i,
  );
  if (!match)
    return { budget_text: "", salary_min: undefined, salary_max: undefined };

  const budgetText = match[1].trim();
  // Match full numbers including commas (Indian/Western format), then optional range
  const valueMatch = budgetText.match(/([\d,]+)\s*(?:-\s*([\d,]+))?/);
  if (!valueMatch) {
    return {
      budget_text: budgetText,
      salary_min: undefined,
      salary_max: undefined,
    };
  }

  const min = parseNumericString(valueMatch[1]);
  const max = valueMatch[2] ? parseNumericString(valueMatch[2]) : undefined;

  return {
    budget_text: budgetText,
    salary_min: min || undefined,
    salary_max: max ?? min,
  };
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

export const parseResumeText = (content: string): ParsedResumeData => {
  const normalized = normalizeText(content);

  // --- Labeled-section parsing (works for resumes with headings) ---
  const labeledTitle = findSectionText(
    normalized,
    /(?:current title|title|designation)[:\s]*/i,
  );
  const labeledCompany = findSectionText(
    normalized,
    /(?:current company|company|organization|employer)[:\s]*/i,
  );
  const labeledSummary = findSectionText(
    normalized,
    /(?:summary|profile|about me|professional summary|objective)[:\s]*/i,
  );

  // --- Experience: explicit mention wins; date-range calc as backup ---
  const expFromText = parseExperience(normalized).min;
  const expFromDates = calculateExperienceFromDates(normalized);

  return {
    name: parseName(normalized),
    email: parseEmail(normalized),
    phone: parsePhone(normalized),
    skills: parseSkills(normalized),
    experience_years: expFromText ?? expFromDates,
    // Headingless fallback: infer from free-form text when no label found
    current_title: labeledTitle || parseCurrentTitleFromContent(normalized),
    current_company: labeledCompany || parseCurrentCompanyFromContent(normalized),
    current_location: parseLocation(normalized),
    summary: labeledSummary || parseSummaryFromContent(normalized),
  };
};

export const parseVendorText = (content: string) => {
  const normalized = normalizeText(content);
  const resume = parseResumeText(normalized);
  const companySection =
    findSectionText(
      normalized,
      /(?:company|organization|agency|vendor|firm|business)[:\s]*/i,
    ) ||
    resume.current_company ||
    "";

  const contactName =
    resume.name ||
    normalized
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .find(
        (line) =>
          !/[0-9@]/.test(line) &&
          !/^(Skills|Experience|Education|Summary|Profile|Contact|Company)/i.test(
            line,
          ),
      ) ||
    "";

  const geographyText =
    findSectionText(
      normalized,
      /(?:locations|geographies|operating in|territories)[:\s]*/i,
    ) || "";

  return {
    company_name: companySection,
    primary_contact_name: contactName,
    primary_contact_email: resume.email,
    primary_contact_phone: resume.phone,
    industry_specializations: resume.skills || [],
    geographies: geographyText ? splitListText(geographyText) : [],
  };
};

export const parseJobDescriptionText = (content: string): ParsedJobData => {
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
    // Cap description at 3000 chars — enough context without flooding the textarea
    description: normalized.slice(0, 3000),
  };
};
