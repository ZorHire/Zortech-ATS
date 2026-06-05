// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------
// pdf-parse / pdfjs-dist references DOMMatrix at module load time, which does
// not exist in Node.js. Stub it before the require so the import doesn't crash.
if (typeof (globalThis as any).DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = class DOMMatrix {};
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (
  buffer: Buffer | Uint8Array | string,
) => Promise<{ text: string }>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth") as {
  extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
};

import { GoogleGenerativeAI } from "@google/generative-ai";
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
  parsed?: boolean;
  raw_text?: string;
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
  parsed?: boolean;
  raw_text?: string;
};

// ---------------------------------------------------------------------------
// Gemini client (lazy, only created when API key present)
// ---------------------------------------------------------------------------
let _geminiModel: ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]> | null = null;

const getGeminiModel = () => {
  if (_geminiModel) return _geminiModel;
  if (!env.GEMINI_API_KEY) return null;
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  _geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  return _geminiModel;
};

/** Strip markdown code fences that Gemini sometimes wraps JSON in. */
const extractJSON = (raw: string): Record<string, unknown> => {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  return JSON.parse(stripped);
};

// ---------------------------------------------------------------------------
// Text normalisation
// ---------------------------------------------------------------------------
const fixSpacedText = (text: string): string =>
  text.replace(
    /(?<![A-Za-z])((?:[A-Za-z] ){2,}[A-Za-z])(?![A-Za-z])/g,
    (match) => match.replace(/ /g, ""),
  );

const normalizeText = (value: string) =>
  value
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[^\x00-\x7F]/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();

const cleanText = (text: string): string => normalizeText(fixSpacedText(text));

// ---------------------------------------------------------------------------
// File text extraction
// ---------------------------------------------------------------------------
const readFileTextFallback = async (
  file: Express.Multer.File,
): Promise<string> => {
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
      // fall through
    }
    throw new Error("Legacy .doc not supported. Please upload .docx or PDF.");
  }

  if (extension === "txt" || file.mimetype.includes("text/plain")) {
    return buffer.toString("utf8");
  }

  throw new Error("Unsupported file type. Please upload PDF, DOCX, or TXT.");
};

export const extractFileText = async (file?: Express.Multer.File) => {
  if (!file || !file.buffer) return "";
  console.log("[Parse] File:", file.originalname, "| MIME:", file.mimetype);
  const text = await readFileTextFallback(file);
  const normalized = cleanText(text);
  console.log(`[Parse] Extracted ${normalized.length} chars`);
  return normalized;
};

// ---------------------------------------------------------------------------
// Section map — used by regex fallback parsers
// ---------------------------------------------------------------------------
const SECTION_ALIASES: Record<string, string[]> = {
  contact: [
    "contact", "contact information", "contact info", "contact details",
    "personal information", "personal info", "personal details",
    "basic information", "basic info", "details",
  ],
  summary: [
    "summary", "professional summary", "executive summary", "career summary",
    "career objective", "objective", "career objective summary",
    "about me", "about", "profile", "professional profile", "career profile",
    "personal profile", "overview", "professional overview",
    "introduction", "bio", "personal statement", "statement",
    "who i am", "background",
  ],
  skills: [
    "skills", "technical skills", "key skills", "core skills",
    "core competencies", "competencies", "technologies", "tech stack",
    "tools", "tools & technologies", "tools and technologies",
    "tools & frameworks", "tools and frameworks",
    "expertise", "technical expertise", "areas of expertise",
    "relevant skills", "programming skills", "programming languages",
    "technical proficiencies", "proficiencies", "technical strengths",
    "it skills", "digital skills", "computer skills", "software skills",
    "software", "frameworks", "languages and frameworks",
    "technical abilities", "abilities", "capabilities",
  ],
  experience: [
    "experience", "work experience", "professional experience",
    "employment history", "work history", "career history",
    "relevant experience", "employment", "positions held",
    "professional background", "work background", "career experience",
    "experience & projects", "work & experience", "professional work",
    "professional history", "job history", "previous experience",
  ],
  education: [
    "education", "educational background", "academic background",
    "academic history", "educational history", "academics",
    "academic qualifications", "educational qualifications", "schooling",
    "degrees", "academic credentials",
  ],
  projects: [
    "projects", "personal projects", "key projects", "notable projects",
    "project experience", "academic projects", "side projects",
    "open source", "portfolio",
  ],
  certifications: [
    "certifications", "certification", "certificates", "certificate",
    "professional certifications", "licenses", "licenses & certifications",
    "credentials", "accreditations", "courses", "training",
  ],
  achievements: [
    "achievements", "awards", "honors", "accomplishments",
    "recognition", "awards & achievements", "honors & awards",
  ],
  languages: ["languages", "language skills", "spoken languages", "foreign languages"],
  interests: ["interests", "hobbies", "activities", "personal interests", "extracurricular"],
  references: ["references", "referees", "references available upon request"],
  volunteer: ["volunteer", "volunteering", "volunteer experience", "community involvement"],
};

const HEADING_LOOKUP = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(SECTION_ALIASES)) {
  for (const alias of aliases) {
    HEADING_LOOKUP.set(alias.toLowerCase(), canonical);
  }
}

type SectionMap = Map<string, string>;

const toHeadingKey = (line: string): string =>
  line
    .replace(/^[\s•\-\*#=_~>|]+/, "")
    .replace(/[\s\-:_=~|]+$/, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const isHeadingLine = (line: string): string | null => {
  if (line.trim().length === 0 || line.trim().length > 60) return null;
  const key = toHeadingKey(line);
  return HEADING_LOOKUP.get(key) ?? null;
};

const buildSectionMap = (content: string): SectionMap => {
  const map: SectionMap = new Map();
  const lines = content.split("\n");
  let currentSection = "__header__";
  map.set(currentSection, "");
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.length < 2) continue;
    const canonical = isHeadingLine(trimmed);
    if (canonical) {
      currentSection = canonical;
      if (!map.has(currentSection)) map.set(currentSection, "");
      continue;
    }
    map.set(currentSection, (map.get(currentSection) ?? "") + trimmed + "\n");
  }
  return map;
};

const getSection = (map: SectionMap, ...names: string[]): string => {
  for (const name of names) {
    const val = map.get(name);
    if (val && val.trim()) return val.trim();
  }
  return "";
};

// ---------------------------------------------------------------------------
// Regex fallback helpers
// ---------------------------------------------------------------------------
const SUB_LABEL_RE = /^[A-Za-z][A-Za-z ,&/]{0,30}:\s*/;
const YEAR_SUFFIX_RE = /\s*[:\-]?\s*\d+(?:\.\d+)?\s*(?:years?|yrs?).*$/i;
const JOB_TITLE_WORD_RE =
  /\b(senior|junior|lead|principal|staff|associate|chief|head|vp|vice president|director|manager|officer|executive|specialist|consultant|analyst|architect|engineer|developer|designer|scientist|researcher|strategist|coordinator|administrator|advisor|intern|trainee|technician|programmer|coder)\b/i;

const dedupeStr = (items: string[]): string[] =>
  [...new Map(items.map((s) => [s.toLowerCase().trim(), s.trim()])).values()].filter(Boolean);

const splitYearCompound = (tok: string): string[] => {
  if (!/\d+(?:\.\d+)?\s*(?:years?|yrs?)/i.test(tok)) return [tok];
  const parts = tok.split(/\d+(?:\.\d+)?\s*(?:years?|yrs?)(?:\s*,\s*|\s+(?=[A-Za-z]))/gi);
  return parts.map((p) => p.replace(YEAR_SUFFIX_RE, "").trim()).filter(Boolean);
};

const extractListItems = (block: string): string[] => {
  const items: string[] = [];
  for (const raw of block.split(/[\n,•\-\*|;◆◇▪▸►✓✔●○·→]+/)) {
    const tok = raw.replace(SUB_LABEL_RE, "").trim();
    if (!tok || tok.length < 2) continue;
    for (const part of splitYearCompound(tok)) {
      if (part.length > 1 && part.length < 60 && !/^\d+$/.test(part)) items.push(part);
    }
  }
  return items;
};

const isTitleCase = (text: string): boolean =>
  text.trim().split(/\s+/).filter(Boolean).every((w) => /^[A-Z]/.test(w));

const parseName = (map: SectionMap): string => {
  const header = getSection(map, "__header__") || map.get("__header__") || "";
  const allContent = map.get("__header__") ?? "";
  const contactSection = getSection(map, "contact");
  const nameSearchIn = (header || allContent) + "\n" + contactSection;
  const nameLabel = nameSearchIn.match(
    /(?:^|\n)\s*(?:name|candidate name|full name|applicant name)\s*[:\-]\s*([A-Za-z][A-Za-z ,.'-]{1,80})/im,
  );
  if (nameLabel?.[1]) return nameLabel[1].trim();
  const headerLines = (map.get("__header__") ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of headerLines.slice(0, 10)) {
    if (/[0-9@]/.test(line)) continue;
    if (/[.&+()/]/.test(line)) continue;
    if (/^(skills|experience|education|summary|profile|contact|objective|references|certifications|about)/i.test(line)) continue;
    if (JOB_TITLE_WORD_RE.test(line)) continue;
    if (/\b(website|linkedin|github|portfolio|twitter|facebook|instagram|resume|cv|blog)\b/i.test(line)) continue;
    if (/\b(inc|ltd|llc|corp|limited|consultancy|services|technologies|systems|solutions|pvt|private)\b/i.test(line)) continue;
    if (line.includes(",")) continue;
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 5 && isTitleCase(line)) return line;
  }
  for (const line of headerLines.slice(0, 6)) {
    if (/[0-9@]/.test(line)) continue;
    if (/[.&+()/]/.test(line)) continue;
    if (/^(skills|experience|education|summary|profile|contact)/i.test(line)) continue;
    if (/\b(website|linkedin|github|portfolio|twitter|facebook|instagram|resume|cv|blog)\b/i.test(line)) continue;
    if (/\b(inc|ltd|llc|corp|limited|consultancy|services|technologies|systems|solutions|pvt|private)\b/i.test(line)) continue;
    if (line.includes(",")) continue;
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 5) return line;
  }
  return "";
};

const parseEmail = (content: string): string => {
  const match = content.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i);
  return match?.[0] ?? "";
};

const parsePhone = (content: string): string => {
  const match = content.match(
    /(?:\+?\d{1,3}[\s\-.]?)?\(?\d{2,4}\)?[\s\-.]?\d{3,5}[\s\-.]?\d{3,5}(?:[\s\-.]?\d{1,4})?/,
  );
  if (!match) return "";
  const cleaned = match[0].replace(/[\s().\-]/g, "");
  return cleaned.length >= 7 ? cleaned : "";
};

const parseLocation = (map: SectionMap, rawContent: string): string => {
  const searchIn = getSection(map, "contact") + "\n" + (map.get("__header__") ?? "");
  const labelMatch = searchIn.match(
    /(?:location|address|city|based in|residing in|residence|located in)\s*[:\-]\s*([A-Za-z0-9 ,.\-]+)/i,
  );
  if (labelMatch?.[1]) return labelMatch[1].trim().split("\n")[0].trim();
  const workModeMatch = rawContent.match(/\b(remote|work from home|wfh|hybrid|onsite|on-site|on site)\b/i);
  if (workModeMatch) return workModeMatch[1];
  const headerLines = (map.get("__header__") ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of headerLines) {
    if (/@/.test(line) || /^\+?\d/.test(line)) continue;
    const cityMatch = line.match(/^([A-Z][A-Za-z\s]{1,30}),\s*([A-Z][A-Za-z\s]{1,30})$/);
    if (cityMatch) return line.trim();
  }
  return "";
};

const parseSkills = (map: SectionMap, rawContent: string): string[] => {
  const skillsBlock = getSection(map, "skills");
  if (skillsBlock) {
    const items = extractListItems(skillsBlock);
    if (items.length >= 1) return dedupeStr(items);
  }
  const profRe =
    /(?:proficient in|experience (?:in|with)|familiar with|knowledge of|skilled in|expertise in|worked with|working with|hands[\s\-]?on (?:with|in)|specializ(?:e|ing) in|adept (?:at|in))\s+([^.!?\n]{5,300})/gi;
  const fromPhrases: string[] = [];
  for (const m of rawContent.matchAll(profRe)) {
    m[1].split(/[,;|•]+/).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 50).forEach((s) => fromPhrases.push(s));
  }
  if (fromPhrases.length >= 3) return dedupeStr(fromPhrases);
  const TECH_KEYWORDS = [
    "javascript","typescript","python","java","c#","c++","go","rust","ruby","php","swift","kotlin",
    "react","next.js","nextjs","angular","vue","svelte","redux","tailwind","bootstrap",
    "node.js","nodejs","express","fastapi","django","flask","spring","laravel","nestjs",
    "html","css","sass","graphql","rest","grpc","websocket",
    "postgresql","mysql","mongodb","redis","sqlite","elasticsearch","dynamodb","firebase",
    "aws","azure","gcp","docker","kubernetes","terraform","ansible","jenkins","github actions",
    "git","linux","bash","nginx","apache",
    "machine learning","deep learning","tensorflow","pytorch","scikit-learn","pandas","numpy",
    "sql","nosql","microservices","ci/cd","agile","scrum","jira",
  ];
  const lowerContent = rawContent.toLowerCase();
  const fromKeywords = TECH_KEYWORDS.filter((kw) => lowerContent.includes(kw));
  if (fromKeywords.length >= 2) return dedupeStr(fromKeywords);
  const enumSkills: string[] = [];
  for (const line of rawContent.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const tokens = line.split(/[,;|•*\/◆◇▪]+/).map((t) => t.replace(SUB_LABEL_RE, "").trim()).filter((t) => t.length > 1);
    if (tokens.length < 3) continue;
    const allShort = tokens.every((t) => t.length <= 35);
    const avgWords = tokens.reduce((s, t) => s + t.split(/\s+/).length, 0) / tokens.length;
    if (allShort && avgWords <= 3) {
      tokens.filter((t) => t.length > 1 && t.length < 50).forEach((t) => enumSkills.push(t));
    }
  }
  if (enumSkills.length >= 2) return dedupeStr(enumSkills);
  return [];
};

const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const parseExperienceYears = (map: SectionMap, rawContent: string): number | undefined => {
  const rangeMatch = rawContent.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs|year)\b/i);
  if (rangeMatch) return Number(parseFloat(rangeMatch[1]));
  const singleMatch = rawContent.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs|year)\s+(?:of\s+)?(?:total\s+)?(?:work\s+|professional\s+|industry\s+|overall\s+)?experience/i);
  if (singleMatch) return Number(parseFloat(singleMatch[1]));
  const expLabel = rawContent.match(/experience\s*[:\-]\s*(\d+)/i);
  if (expLabel) return Number(parseFloat(expLabel[1]));
  const expBlock = getSection(map, "experience") || getSection(map, "projects") || rawContent;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const ranges: Array<[number, number]> = [];
  const fullMonthYearRe =
    /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[.,]?\s*(\d{4})\s*[-–—to]+\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|present|current|now|till\s*date)[.,]?\s*(\d{4})?/gi;
  let m: RegExpExecArray | null;
  while ((m = fullMonthYearRe.exec(expBlock)) !== null) {
    const startMon = MONTH_MAP[m[1].toLowerCase().slice(0, 3)] ?? 1;
    const startYr = parseInt(m[2], 10);
    const endWord = m[3].toLowerCase();
    const endMon = /present|current|now|till/.test(endWord) ? currentMonth : (MONTH_MAP[endWord.slice(0, 3)] ?? 12);
    const endYr = /present|current|now|till/.test(endWord) ? currentYear : parseInt(m[4] ?? String(currentYear), 10);
    if (startYr >= 1970 && startYr <= currentYear) {
      const startTotal = startYr * 12 + startMon;
      const endTotal = endYr * 12 + endMon;
      if (endTotal >= startTotal) ranges.push([startTotal, endTotal]);
    }
  }
  const yearOnlyRe = /(\d{4})\s*[-–—to]+\s*(\d{4}|present|current|now|till\s*date)/gi;
  while ((m = yearOnlyRe.exec(expBlock)) !== null) {
    const startYr = parseInt(m[1], 10);
    const endRaw = m[2].toLowerCase();
    const endYr = /\d{4}/.test(endRaw) ? parseInt(endRaw, 10) : currentYear;
    if (startYr >= 1970 && startYr <= currentYear && endYr >= startYr && endYr <= currentYear + 1) {
      ranges.push([startYr * 12, endYr * 12]);
    }
  }
  if (ranges.length === 0) return undefined;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) { last[1] = Math.max(last[1], r[1]); } else { merged.push([r[0], r[1]]); }
  }
  const totalMonths = merged.reduce((s, r) => s + (r[1] - r[0]), 0);
  const years = Math.round(totalMonths / 12);
  return years > 0 ? years : undefined;
};

const parseWorkHistory = (map: SectionMap, rawContent: string): { title: string; company: string } => {
  const expBlock = getSection(map, "experience") || rawContent;
  const atMatch = expBlock.match(/([A-Za-z][A-Za-z /\-]{3,60}?)\s+(?:at|@)\s+([A-Z][A-Za-z0-9 &.,'\-]{1,60}?)(?:\s*[\(,|\n]|\s*\d{4}|$)/);
  if (atMatch) {
    const t = atMatch[1].trim();
    const c = atMatch[2].trim();
    if (JOB_TITLE_WORD_RE.test(t)) return { title: t, company: c };
  }
  const pipeMatch = expBlock.match(/([A-Za-z][A-Za-z0-9 &.,'\-]{1,60}?)\s*\|\s*([A-Za-z][A-Za-z0-9 &.,'\-]{1,60}?)\s*(?:\||\d{4})/);
  if (pipeMatch) {
    const first = pipeMatch[1].trim();
    const second = pipeMatch[2].trim();
    if (JOB_TITLE_WORD_RE.test(first) && !JOB_TITLE_WORD_RE.test(second)) return { title: first, company: second };
    if (JOB_TITLE_WORD_RE.test(second) && !JOB_TITLE_WORD_RE.test(first)) return { title: second, company: first };
    return { title: second, company: first };
  }
  const entryLines = expBlock.split("\n").map((l) => l.trim()).filter(Boolean);
  let title = "";
  let company = "";
  for (const line of entryLines.slice(0, 8)) {
    if (/^[•\-\*◆▪►✓]/.test(line)) break;
    if (/^\d{4}\s*[-–—]/.test(line) || /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line)) continue;
    if (line.length > 100) continue;
    if (!title && JOB_TITLE_WORD_RE.test(line)) { title = line; }
    else if (title && !company && /^[A-Z]/.test(line) && !JOB_TITLE_WORD_RE.test(line)) { company = line; }
    else if (!title && !company && /^[A-Z]/.test(line)) { company = line; }
    else if (company && !title && JOB_TITLE_WORD_RE.test(line)) { title = line; }
    if (title && company) break;
  }
  return { title, company };
};

const isGarbled = (text: string): boolean =>
  text.split(/\s+/).some((w) => w.length > 25 && !w.startsWith("http"));

const truncateAtSentence = (text: string, maxLen: number): string => {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastBoundary = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return lastBoundary > maxLen * 0.5 ? cut.slice(0, lastBoundary + 1) : cut;
};

const stripBullet = (line: string): string => line.replace(/^[•\-\*◆▪►✓✔●○·→\s]+/, "").trim();

const parseSummary = (map: SectionMap, rawContent: string): string => {
  const summaryBlock = getSection(map, "summary", "contact");
  if (summaryBlock && summaryBlock.length > 40) {
    const lines = summaryBlock.split("\n").map((l) => stripBullet(l)).filter((l) => l && !/@/.test(l) && !/^\+?\d/.test(l) && !isGarbled(l));
    const joined = lines.join(" ").trim();
    if (joined.length > 40) return truncateAtSentence(joined, 500);
  }
  const header = map.get("__header__") ?? "";
  const paragraphs = header.split(/\n{2,}/);
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length < 60) continue;
    if (/@/.test(trimmed) || /^\+?\d/.test(trimmed)) continue;
    if (isGarbled(trimmed)) continue;
    const lines = trimmed.split("\n");
    const avgLen = lines.reduce((s, l) => s + l.length, 0) / (lines.length || 1);
    if (avgLen > 30) return truncateAtSentence(trimmed, 500);
  }
  const sentences = rawContent.split(/(?<=[.!?])\s+/);
  const bio = sentences.find((s) => s.trim().length > 60 && !/@/.test(s) && !/^\+?\d/.test(s.trim()) && !isGarbled(s));
  return bio ? truncateAtSentence(bio.trim(), 500) : "";
};

const parseCurrentTitle = (map: SectionMap, workHistory: { title: string; company: string }, rawContent: string): string => {
  const header = map.get("__header__") ?? "";
  const labelMatch = header.match(/(?:current title|job title|designation|position|role)\s*[:\-]\s*([A-Za-z][A-Za-z /\-]{3,80})/i);
  if (labelMatch?.[1]) return labelMatch[1].trim();
  if (workHistory.title) return workHistory.title;
  const searchIn = header + "\n" + getSection(map, "summary");
  const roleMatch = searchIn.match(/(?:i(?:'m| am) (?:a |an )?|working as (?:a |an )?|currently (?:a |an )?|serve(?:d|s)? as (?:a |an )?)([A-Za-z][A-Za-z /\-]{3,60}?)(?:\s+at\s|\s+with\s|\s+@\s|[,.\n]|$)/i);
  if (roleMatch?.[1] && JOB_TITLE_WORD_RE.test(roleMatch[1])) return roleMatch[1].trim();
  const headerLines = header.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of headerLines.slice(0, 12)) {
    if (/[0-9@+]/.test(line) && !/[A-Za-z]{4,}/.test(line)) continue;
    if (/^(Skills|Experience|Education|Summary|Profile|Contact|Objective)/i.test(line)) continue;
    const wc = line.split(/\s+/).length;
    if (wc >= 1 && wc <= 8 && line.length < 80 && JOB_TITLE_WORD_RE.test(line)) return line;
  }
  void rawContent;
  return "";
};

const parseCurrentCompany = (map: SectionMap, workHistory: { title: string; company: string }, rawContent: string): string => {
  const header = map.get("__header__") ?? "";
  const labelMatch = header.match(/(?:current company|current employer|company|employer|organization)\s*[:\-]\s*([A-Z][A-Za-z0-9 &.,'\-]{1,80})/i);
  if (labelMatch?.[1]) {
    const c = labelMatch[1].trim();
    if (!/^(the|a |an |my |our )/i.test(c)) return c;
  }
  if (workHistory.company) return workHistory.company;
  const searchIn = header + "\n" + getSection(map, "summary");
  const atMatch = searchIn.match(/(?:\bat\b|\bwith\b)\s+([A-Z][A-Za-z0-9 &.,'\-]{1,60}?)(?:\s+(?:Inc|Ltd|LLC|Corp|Limited|Technologies|Tech|Solutions|Systems|Services|Global|Group)\.?)?(?=[,.\n]|$|\s+(?:as|where|since|from|and)\b)/);
  if (atMatch?.[1]) {
    const c = atMatch[1].trim();
    if (!/^(the|a |an |my |our |present|least|most)/i.test(c)) return c;
  }
  const corpMatch = rawContent.match(/([A-Z][A-Za-z0-9 &'\-]{1,40}?)\s+(?:Inc|Ltd|LLC|Corp|Limited|Technologies|Tech|Solutions|Systems|Services)\.?(?=[^A-Za-z]|$)/);
  if (corpMatch?.[1]) return corpMatch[1].trim();
  return "";
};

const parseJobTitle = (map: SectionMap, rawContent: string): string => {
  const labelMatch = rawContent.match(/(?:job title|position title|role|designation)\s*[:\-]\s*([A-Za-z0-9 &\-\/+]{3,100})/i);
  if (labelMatch) return labelMatch[1].trim();
  const headerLines = (map.get("__header__") ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (headerLines.length > 0 && headerLines[0].length < 100) return headerLines[0];
  return "";
};

const parseBudget = (rawContent: string) => {
  const match = rawContent.match(/(?:budget|salary|compensation|ctc|package|remuneration)\s*[:\-]?\s*([^\n]{3,80})/i);
  if (!match) return { budget_text: "", salary_min: undefined, salary_max: undefined };
  const budgetText = match[1].trim();
  const numRe = /([\d,]+(?:\.\d+)?)/g;
  const nums: number[] = [];
  let nm: RegExpExecArray | null;
  while ((nm = numRe.exec(budgetText)) !== null) {
    const v = Number(nm[1].replace(/,/g, ""));
    if (v > 0) nums.push(v);
  }
  return { budget_text: budgetText, salary_min: nums[0], salary_max: nums[1] ?? nums[0] };
};

// ---------------------------------------------------------------------------
// Gemini parsers
// ---------------------------------------------------------------------------

const parseResumeWithGemini = async (text: string): Promise<ParsedResumeData | null> => {
  const model = getGeminiModel();
  if (!model) return null;

  const prompt = `You are an expert resume parser for an ATS (Applicant Tracking System). Extract ALL structured information from the resume text below and return ONLY a valid JSON object — no markdown, no explanation, no extra text.

JSON schema (EVERY field is REQUIRED — never return an empty string or null when the information can be found or inferred):
{
  "name": "candidate's full name — always present at the top of the resume",
  "email": "email address",
  "phone": "phone number with country code if present",
  "skills": ["EXHAUSTIVE list — include every programming language, framework, database, cloud platform, tool, methodology, certification mentioned ANYWHERE in the resume"],
  "experience_years": "total years of professional experience as a plain integer — sum non-overlapping date ranges from work history if not explicitly stated",
  "current_title": "most recent job title from the FIRST work experience entry (e.g. 'Senior Software Engineer')",
  "current_company": "most recent employer name from the FIRST work experience entry (e.g. 'TechCorp Solutions')",
  "current_location": "candidate's city and country/state (e.g. 'Mumbai, India')",
  "summary": "MANDATORY 2-3 sentence professional summary — copy the resume's own summary/objective section verbatim if present; otherwise synthesize one from the candidate's title, years of experience, and top skills"
}

Critical rules:
1. skills: be exhaustive — scan every section (skills, experience bullet points, projects, certifications) and include ALL technologies mentioned
2. experience_years: ALWAYS calculate if not stated — find the earliest start date and latest end date across all jobs, compute years
3. current_title and current_company: ALWAYS extract from the most recent job entry — never leave blank if there is any work experience
4. summary: NEVER return empty — the summary section MUST always be filled; synthesize if no explicit summary exists
5. Return ONLY valid JSON — no markdown fences, no extra text

Resume text:
${text.slice(0, 10000)}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log("[Gemini] Resume response length:", responseText.length);
    const parsed = extractJSON(responseText);

    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      email: typeof parsed.email === "string" ? parsed.email : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
      skills: Array.isArray(parsed.skills) ? (parsed.skills as string[]).filter((s) => typeof s === "string") : [],
      experience_years: typeof parsed.experience_years === "number" ? parsed.experience_years : undefined,
      current_title: typeof parsed.current_title === "string" ? parsed.current_title : "",
      current_company: typeof parsed.current_company === "string" ? parsed.current_company : "",
      current_location: typeof parsed.current_location === "string" ? parsed.current_location : "",
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
    };
  } catch (err) {
    console.error("[Gemini] Resume parse failed:", err instanceof Error ? err.message : err);
    return null;
  }
};

const parseJobWithGemini = async (text: string): Promise<ParsedJobData | null> => {
  const model = getGeminiModel();
  if (!model) return null;

  const prompt = `You are an expert job description parser for an ATS (Applicant Tracking System). Extract ALL structured information from the job description below and return ONLY a valid JSON object — no markdown, no explanation, no extra text.

JSON schema (use null for any field you cannot determine):
{
  "title": "job title / position name",
  "location": "job location (city, remote, hybrid, etc.)",
  "required_skills": ["complete list of all required and preferred technical skills, tools, technologies, frameworks"],
  "experience_min": "minimum years of experience required as a number",
  "experience_max": "maximum years of experience as a number (same as min if only one value given)",
  "budget_text": "salary/compensation text exactly as written in the JD",
  "salary_min": "minimum salary as a number (no currency symbol, no commas)",
  "salary_max": "maximum salary as a number",
  "description": "full cleaned job description text, max 2000 characters"
}

Critical rules:
- required_skills: include both mandatory and preferred/good-to-have skills
- experience_min/max: in years as plain numbers
- salary_min/max: strip currency symbols and commas, plain numbers only
- Return ONLY the JSON object

Job description:
${text.slice(0, 10000)}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log("[Gemini] JD response length:", responseText.length);
    const parsed = extractJSON(responseText);

    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      location: typeof parsed.location === "string" ? parsed.location : "",
      required_skills: Array.isArray(parsed.required_skills) ? (parsed.required_skills as string[]).filter((s) => typeof s === "string") : [],
      experience_min: typeof parsed.experience_min === "number" ? parsed.experience_min : undefined,
      experience_max: typeof parsed.experience_max === "number" ? parsed.experience_max : undefined,
      budget_text: typeof parsed.budget_text === "string" ? parsed.budget_text : "",
      salary_min: typeof parsed.salary_min === "number" ? parsed.salary_min : undefined,
      salary_max: typeof parsed.salary_max === "number" ? parsed.salary_max : undefined,
      description: typeof parsed.description === "string" ? parsed.description.slice(0, 3000) : text.slice(0, 3000),
    };
  } catch (err) {
    console.error("[Gemini] JD parse failed:", err instanceof Error ? err.message : err);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Public API — Gemini primary, regex fallback
// ---------------------------------------------------------------------------

export const parseResumeText = async (content: string): Promise<ParsedResumeData> => {
  console.log("[Parse] Resume parsing started");
  const normalized = cleanText(content);

  // Build section map once — used both for hybrid merge and full regex fallback
  const map = buildSectionMap(normalized);
  const workHistory = parseWorkHistory(map, normalized);

  // 1. Try Gemini
  const geminiResult = await parseResumeWithGemini(normalized);
  if (geminiResult) {
    const hasKeyFields = !!(geminiResult.name || geminiResult.email || geminiResult.phone);
    if (hasKeyFields) {
      // Hybrid: take Gemini's value for each field; fill blanks with regex result
      const regexSummary = parseSummary(map, normalized);
      const merged: ParsedResumeData = {
        name: geminiResult.name || parseName(map),
        email: geminiResult.email || parseEmail(normalized),
        phone: geminiResult.phone || parsePhone(normalized),
        skills: (geminiResult.skills && geminiResult.skills.length > 0)
          ? geminiResult.skills
          : parseSkills(map, normalized),
        experience_years: geminiResult.experience_years ?? parseExperienceYears(map, normalized),
        current_title: geminiResult.current_title || parseCurrentTitle(map, workHistory, normalized),
        current_company: geminiResult.current_company || parseCurrentCompany(map, workHistory, normalized),
        current_location: geminiResult.current_location || parseLocation(map, normalized),
        // Summary must never be empty — Gemini first, regex second, then raw header paragraph
        summary: geminiResult.summary || regexSummary || "",
        parsed: true,
      };
      console.log("[Parse] Resume parsed via Gemini+regex hybrid:", JSON.stringify({
        name: merged.name,
        email: merged.email,
        title: merged.current_title,
        company: merged.current_company,
        experience_years: merged.experience_years,
        skills_count: merged.skills?.length,
        has_summary: !!merged.summary,
      }));
      return merged;
    }
    console.warn("[Parse] Gemini returned no key fields — falling back to regex");
  }

  // 2. Full regex fallback (Gemini unavailable or returned no key fields)
  const result: ParsedResumeData = {
    name: parseName(map),
    email: parseEmail(normalized),
    phone: parsePhone(normalized),
    skills: parseSkills(map, normalized),
    experience_years: parseExperienceYears(map, normalized),
    current_title: parseCurrentTitle(map, workHistory, normalized),
    current_company: parseCurrentCompany(map, workHistory, normalized),
    current_location: parseLocation(map, normalized),
    summary: parseSummary(map, normalized),
  };

  const hasKeyFields = !!(result.name || result.email || result.phone);
  if (!hasKeyFields) {
    console.log("[Parse] Resume: key fields missing — attaching raw fallback");
    return { ...result, parsed: false, raw_text: normalized };
  }

  result.parsed = true;
  console.log("[Parse] Resume parsed via regex:", JSON.stringify({ name: result.name, email: result.email, skills_count: result.skills?.length }));
  return result;
};

export const parseVendorText = async (content: string) => {
  console.log("[Parse] Vendor parsing started");
  const normalized = cleanText(content);
  const map = buildSectionMap(normalized);
  const resume = await parseResumeText(normalized);
  const companySection = resume.current_company || "";
  const contactName =
    resume.name ||
    (map.get("__header__") ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/[0-9@]/.test(l) && !/^(Skills|Experience|Education|Summary|Profile|Contact|Company)/i.test(l))[0] ||
    "";
  const geoBlock = getSection(map, "contact") || "";
  const geographies = geoBlock
    ? geoBlock.split(/[\n,•\-\*|;]+/).map((t) => t.trim()).filter((t) => t.length > 1 && t.length < 60)
    : [];

  return {
    company_name: companySection,
    primary_contact_name: contactName,
    primary_contact_email: resume.email,
    primary_contact_phone: resume.phone,
    industry_specializations: resume.skills || [],
    geographies,
  };
};

export const parseJobDescriptionText = async (content: string): Promise<ParsedJobData> => {
  console.log("[Parse] JD parsing started");
  const normalized = cleanText(content);

  // 1. Try Gemini
  const geminiResult = await parseJobWithGemini(normalized);
  if (geminiResult?.title) {
    console.log("[Parse] JD parsed via Gemini:", JSON.stringify({ title: geminiResult.title, skills_count: geminiResult.required_skills?.length }));
    return { ...geminiResult, parsed: true };
  }

  if (geminiResult) {
    console.warn("[Parse] Gemini returned no title — falling back to regex");
  }

  // 2. Regex fallback
  const map = buildSectionMap(normalized);
  const skills = parseSkills(map, normalized);
  const exp = parseExperienceYears(map, normalized);
  const budget = parseBudget(normalized);
  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs|year)\b/i);
  const title = parseJobTitle(map, normalized);

  if (!title) {
    console.log("[Parse] JD: title missing — attaching raw fallback");
    return { title: "", location: "", required_skills: [], description: normalized.slice(0, 3000), parsed: false, raw_text: normalized };
  }

  const result: ParsedJobData = {
    title,
    location: parseLocation(map, normalized),
    required_skills: skills,
    experience_min: rangeMatch ? Number(parseFloat(rangeMatch[1])) : exp,
    experience_max: rangeMatch ? Number(parseFloat(rangeMatch[2])) : exp,
    budget_text: budget.budget_text,
    salary_min: budget.salary_min,
    salary_max: budget.salary_max,
    description: normalized.slice(0, 3000),
    parsed: true,
  };

  console.log("[Parse] JD parsed via regex:", JSON.stringify({ title: result.title, skills_count: result.required_skills?.length }));
  return result;
};
