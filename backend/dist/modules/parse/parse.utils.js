"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJobDescriptionText = exports.parseVendorText = exports.parseResumeText = exports.extractFileText = void 0;
// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth");
// ---------------------------------------------------------------------------
// Text normalisation
// ---------------------------------------------------------------------------
/**
 * Fix PDFs where characters are extracted individually: "J o h n D o e" → "JohnDoe".
 * Matches 3+ single letters each separated by exactly one space (word-boundary guarded).
 */
const fixSpacedText = (text) => text.replace(/(?<![A-Za-z])((?:[A-Za-z] ){2,}[A-Za-z])(?![A-Za-z])/g, (match) => match.replace(/ /g, ""));
const normalizeText = (value) => value
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[^\x00-\x7F]/g, " ") // remove non-ASCII artifacts from PDF extraction
    .replace(/[ ]{2,}/g, " ")
    .trim();
/**
 * Full pre-processing pipeline applied to raw extracted text before any parsing.
 * Fixes spaced characters first, then normalizes whitespace and strips non-ASCII.
 */
const cleanText = (text) => normalizeText(fixSpacedText(text));
// ---------------------------------------------------------------------------
// File text extraction
// ---------------------------------------------------------------------------
const readFileTextFallback = async (file) => {
    const buffer = file.buffer;
    const extension = file.originalname
        ? (file.originalname.split(".").pop()?.toLowerCase() ?? "")
        : "";
    if (extension === "pdf" || file.mimetype === "application/pdf") {
        const result = await pdfParse(buffer);
        return result.text || "";
    }
    if (extension === "docx" ||
        file.mimetype.includes("officedocument.wordprocessingml.document")) {
        const data = await mammoth.extractRawText({ buffer });
        return data.value || "";
    }
    if (extension === "doc" || file.mimetype === "application/msword") {
        try {
            const data = await mammoth.extractRawText({ buffer });
            if (data.value && data.value.trim().length > 20)
                return data.value;
        }
        catch {
            // fall through
        }
        throw new Error("Legacy .doc not supported. Please upload .docx or PDF.");
    }
    if (extension === "txt" || file.mimetype.includes("text/plain")) {
        return buffer.toString("utf8");
    }
    throw new Error("Unsupported file type. Please upload PDF, DOCX, or TXT.");
};
const extractFileText = async (file) => {
    if (!file || !file.buffer)
        return "";
    console.log("[Parse] File:", file.originalname, "| MIME:", file.mimetype);
    const text = await readFileTextFallback(file);
    const normalized = cleanText(text);
    console.log(`[Parse] Extracted ${normalized.length} chars`);
    return normalized;
};
exports.extractFileText = extractFileText;
// ---------------------------------------------------------------------------
// Section map — the core of robust parsing
//
// Instead of scanning for one label at a time (which breaks on blank lines,
// stops after 8 lines, and misses aliases), we walk the document ONCE and
// build a map of canonical-section-name → full section content.
// Every field parser then queries this map by canonical name.
// ---------------------------------------------------------------------------
// All recognised heading aliases grouped by canonical name.
// Add more aliases here to handle new resume styles — nothing else needs changing.
const SECTION_ALIASES = {
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
// Build fast lookup: normalised alias → canonical name
const HEADING_LOOKUP = new Map();
for (const [canonical, aliases] of Object.entries(SECTION_ALIASES)) {
    for (const alias of aliases) {
        HEADING_LOOKUP.set(alias.toLowerCase(), canonical);
    }
}
/**
 * Decide whether a line is a section heading.
 * Strips decorative characters, trailing colons/dashes, then checks the
 * heading lookup. The line must also be short enough (≤ 60 chars) to rule
 * out sentences that happen to start with a keyword.
 */
const toHeadingKey = (line) => line
    .replace(/^[\s•\-\*#=_~>|]+/, "") // leading decorators
    .replace(/[\s\-:_=~|]+$/, "") // trailing decorators
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const isHeadingLine = (line) => {
    if (line.trim().length === 0 || line.trim().length > 60)
        return null;
    const key = toHeadingKey(line);
    return HEADING_LOOKUP.get(key) ?? null;
};
/**
 * Walk the document once and return a map of canonical-name → section content.
 * Content before the first recognised heading is stored as "__header__" and
 * typically contains name + contact info.
 */
const buildSectionMap = (content) => {
    const map = new Map();
    const lines = content.split("\n");
    let currentSection = "__header__";
    map.set(currentSection, "");
    for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (trimmed.length < 2)
            continue; // skip noise lines
        const canonical = isHeadingLine(trimmed);
        if (canonical) {
            currentSection = canonical;
            if (!map.has(currentSection))
                map.set(currentSection, "");
            continue;
        }
        map.set(currentSection, (map.get(currentSection) ?? "") + trimmed + "\n");
    }
    return map;
};
/** Return the first non-empty section matching any of the given canonical names. */
const getSection = (map, ...names) => {
    for (const name of names) {
        const val = map.get(name);
        if (val && val.trim())
            return val.trim();
    }
    return "";
};
// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
// Sub-label prefixes inside skill blocks: "Languages: ", "Frameworks: ", etc.
const SUB_LABEL_RE = /^[A-Za-z][A-Za-z ,&/]{0,30}:\s*/;
const dedupeStr = (items) => [...new Map(items.map((s) => [s.toLowerCase().trim(), s.trim()])).values()].filter(Boolean);
/** Split a block by common list delimiters and strip sub-labels / empties. */
const extractListItems = (block) => block
    .split(/[\n,•\-\*|;◆◇▪▸►✓✔●○·→]+/)
    .map((tok) => tok.replace(SUB_LABEL_RE, "").trim())
    .filter((tok) => tok.length > 1 && tok.length < 60 && !/^\d+$/.test(tok));
// Regex that matches common job-title words — distinguishes title lines from name lines
const JOB_TITLE_WORD_RE = /\b(senior|junior|lead|principal|staff|associate|chief|head|vp|vice president|director|manager|officer|executive|specialist|consultant|analyst|architect|engineer|developer|designer|scientist|researcher|strategist|coordinator|administrator|advisor|intern|trainee|technician|programmer|coder)\b/i;
const isTitleCase = (text) => text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => /^[A-Z]/.test(w));
// ---------------------------------------------------------------------------
// Name
// ---------------------------------------------------------------------------
const parseName = (map) => {
    const header = getSection(map, "__header__") || map.get("__header__") || "";
    const allContent = map.get("__header__") ?? "";
    // 1. Explicit "Name:" label anywhere in header or contact section
    const contactSection = getSection(map, "contact");
    const nameSearchIn = (header || allContent) + "\n" + contactSection;
    const nameLabel = nameSearchIn.match(/(?:^|\n)\s*(?:name|candidate name|full name|applicant name)\s*[:\-]\s*([A-Za-z][A-Za-z ,.'-]{1,80})/im);
    if (nameLabel?.[1])
        return nameLabel[1].trim();
    // 2. Scan first lines of header for a title-cased 2-4 word name
    const headerLines = (map.get("__header__") ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    for (const line of headerLines.slice(0, 10)) {
        if (/[0-9@]/.test(line))
            continue;
        if (/^(skills|experience|education|summary|profile|contact|objective|references|certifications|about)/i.test(line))
            continue;
        if (JOB_TITLE_WORD_RE.test(line))
            continue;
        // Skip lines that look like company names or locations (contain corporate keywords or commas)
        if (/\b(inc|ltd|llc|corp|limited|consultancy|services|technologies|systems|solutions|pvt|private)\b/i.test(line))
            continue;
        if (line.includes(","))
            continue; // "Company, City" or "City, Country" patterns
        const words = line.split(/\s+/);
        if (words.length >= 2 && words.length <= 5 && isTitleCase(line))
            return line;
    }
    // 3. Relaxed: any short non-numeric line from the first few header lines
    for (const line of headerLines.slice(0, 6)) {
        if (/[0-9@]/.test(line))
            continue;
        if (/^(skills|experience|education|summary|profile|contact)/i.test(line))
            continue;
        if (/\b(inc|ltd|llc|corp|limited|consultancy|services|technologies|systems|solutions|pvt|private)\b/i.test(line))
            continue;
        if (line.includes(","))
            continue;
        const words = line.split(/\s+/);
        if (words.length >= 2 && words.length <= 5)
            return line;
    }
    return "";
};
// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------
const parseEmail = (content) => {
    const match = content.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i);
    return match?.[0] ?? "";
};
// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------
const parsePhone = (content) => {
    // Covers: +91 98765 43210, (123) 456-7890, 123-456-7890, +1234567890, etc.
    const match = content.match(/(?:\+?\d{1,3}[\s\-.]?)?\(?\d{2,4}\)?[\s\-.]?\d{3,5}[\s\-.]?\d{3,5}(?:[\s\-.]?\d{1,4})?/);
    if (!match)
        return "";
    const cleaned = match[0].replace(/[\s().\-]/g, "");
    return cleaned.length >= 7 ? cleaned : "";
};
// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------
const parseLocation = (map, rawContent) => {
    // 1. Explicit label in contact or header
    const searchIn = getSection(map, "contact") + "\n" + (map.get("__header__") ?? "");
    const labelMatch = searchIn.match(/(?:location|address|city|based in|residing in|residence|located in)\s*[:\-]\s*([A-Za-z0-9 ,.\-]+)/i);
    if (labelMatch?.[1])
        return labelMatch[1].trim().split("\n")[0].trim();
    // 2. Remote / hybrid / onsite keywords
    const workModeMatch = rawContent.match(/\b(remote|work from home|wfh|hybrid|onsite|on-site|on site)\b/i);
    if (workModeMatch)
        return workModeMatch[1];
    // 3. "City, State" or "City, Country" pattern near email/phone in header
    const headerLines = (map.get("__header__") ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    for (const line of headerLines) {
        // Skip lines that are clearly email or phone
        if (/@/.test(line) || /^\+?\d/.test(line))
            continue;
        // City, Country/State pattern: two capitalised words separated by comma
        const cityMatch = line.match(/^([A-Z][A-Za-z\s]{1,30}),\s*([A-Z][A-Za-z\s]{1,30})$/);
        if (cityMatch)
            return line.trim();
    }
    return "";
};
// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------
const parseSkills = (map, rawContent) => {
    // ── 1. From labeled skills section (most reliable) ────────────────────────
    const skillsBlock = getSection(map, "skills");
    if (skillsBlock) {
        const items = extractListItems(skillsBlock);
        if (items.length >= 1)
            return dedupeStr(items);
    }
    // ── 2. Proficiency phrases in any section ─────────────────────────────────
    const profRe = /(?:proficient in|experience (?:in|with)|familiar with|knowledge of|skilled in|expertise in|worked with|working with|hands[\s\-]?on (?:with|in)|specializ(?:e|ing) in|adept (?:at|in))\s+([^.!?\n]{5,300})/gi;
    const fromPhrases = [];
    for (const m of rawContent.matchAll(profRe)) {
        m[1]
            .split(/[,;|•]+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 1 && s.length < 50)
            .forEach((s) => fromPhrases.push(s));
    }
    if (fromPhrases.length >= 3)
        return dedupeStr(fromPhrases);
    // ── 3. Tech-keyword scan across entire text ──────────────────────────────
    // Used when no skills section and no proficiency phrases were found.
    const TECH_KEYWORDS = [
        "javascript", "typescript", "python", "java", "c#", "c++", "go", "rust", "ruby", "php", "swift", "kotlin",
        "react", "next.js", "nextjs", "angular", "vue", "svelte", "redux", "tailwind", "bootstrap",
        "node.js", "nodejs", "express", "fastapi", "django", "flask", "spring", "laravel", "nestjs",
        "html", "css", "sass", "graphql", "rest", "grpc", "websocket",
        "postgresql", "mysql", "mongodb", "redis", "sqlite", "elasticsearch", "dynamodb", "firebase",
        "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ansible", "jenkins", "github actions",
        "git", "linux", "bash", "nginx", "apache",
        "machine learning", "deep learning", "tensorflow", "pytorch", "scikit-learn", "pandas", "numpy",
        "sql", "nosql", "microservices", "ci/cd", "agile", "scrum", "jira",
    ];
    const lowerContent = rawContent.toLowerCase();
    const fromKeywords = TECH_KEYWORDS.filter((kw) => lowerContent.includes(kw));
    if (fromKeywords.length >= 2)
        return dedupeStr(fromKeywords);
    // ── 4. Dense-enumeration lines (headingless resumes) ─────────────────────
    // A line with ≥3 comma/pipe/bullet-separated short tokens that don't look
    // like prose is almost certainly a skill list.
    const enumSkills = [];
    for (const line of rawContent.split("\n").map((l) => l.trim()).filter(Boolean)) {
        const tokens = line
            .split(/[,;|•*\/◆◇▪]+/)
            .map((t) => t.replace(SUB_LABEL_RE, "").trim())
            .filter((t) => t.length > 1);
        if (tokens.length < 3)
            continue;
        const allShort = tokens.every((t) => t.length <= 35);
        const avgWords = tokens.reduce((s, t) => s + t.split(/\s+/).length, 0) / tokens.length;
        if (allShort && avgWords <= 3) {
            tokens
                .filter((t) => t.length > 1 && t.length < 50)
                .forEach((t) => enumSkills.push(t));
        }
    }
    if (enumSkills.length >= 2)
        return dedupeStr(enumSkills);
    return [];
};
// ---------------------------------------------------------------------------
// Experience years
// ---------------------------------------------------------------------------
const MONTH_MAP = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    january: 1, february: 2, march: 3, april: 4, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const parseExperienceYears = (map, rawContent) => {
    // 1. Explicit "X years" statement
    const rangeMatch = rawContent.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs|year)\b/i);
    if (rangeMatch)
        return Number(parseFloat(rangeMatch[1]));
    const singleMatch = rawContent.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs|year)\s+(?:of\s+)?(?:total\s+)?(?:work\s+|professional\s+|industry\s+|overall\s+)?experience/i);
    if (singleMatch)
        return Number(parseFloat(singleMatch[1]));
    const expLabel = rawContent.match(/experience\s*[:\-]\s*(\d+)/i);
    if (expLabel)
        return Number(parseFloat(expLabel[1]));
    // 2. Calculate from date ranges in experience section
    const expBlock = getSection(map, "experience") ||
        getSection(map, "projects") ||
        rawContent;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const ranges = []; // [startMonth, endMonth] as total months
    // Pattern: "Month YYYY – Month YYYY|Present"
    const fullMonthYearRe = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[.,]?\s*(\d{4})\s*[-–—to]+\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|present|current|now|till\s*date)[.,]?\s*(\d{4})?/gi;
    let m;
    while ((m = fullMonthYearRe.exec(expBlock)) !== null) {
        const startMon = MONTH_MAP[m[1].toLowerCase().slice(0, 3)] ?? 1;
        const startYr = parseInt(m[2], 10);
        const endWord = m[3].toLowerCase();
        const endMon = /present|current|now|till/.test(endWord)
            ? currentMonth
            : (MONTH_MAP[endWord.slice(0, 3)] ?? 12);
        const endYr = /present|current|now|till/.test(endWord)
            ? currentYear
            : parseInt(m[4] ?? String(currentYear), 10);
        if (startYr >= 1970 && startYr <= currentYear) {
            const startTotal = startYr * 12 + startMon;
            const endTotal = endYr * 12 + endMon;
            if (endTotal >= startTotal)
                ranges.push([startTotal, endTotal]);
        }
    }
    // Pattern: "YYYY – YYYY|Present"
    const yearOnlyRe = /(\d{4})\s*[-–—to]+\s*(\d{4}|present|current|now|till\s*date)/gi;
    while ((m = yearOnlyRe.exec(expBlock)) !== null) {
        const startYr = parseInt(m[1], 10);
        const endRaw = m[2].toLowerCase();
        const endYr = /\d{4}/.test(endRaw) ? parseInt(endRaw, 10) : currentYear;
        if (startYr >= 1970 &&
            startYr <= currentYear &&
            endYr >= startYr &&
            endYr <= currentYear + 1) {
            ranges.push([startYr * 12, endYr * 12]);
        }
    }
    if (ranges.length === 0)
        return undefined;
    // Merge overlapping ranges to avoid double-counting concurrent positions
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of ranges) {
        const last = merged[merged.length - 1];
        if (last && r[0] <= last[1]) {
            last[1] = Math.max(last[1], r[1]);
        }
        else {
            merged.push([r[0], r[1]]);
        }
    }
    const totalMonths = merged.reduce((s, r) => s + (r[1] - r[0]), 0);
    const years = Math.round(totalMonths / 12);
    return years > 0 ? years : undefined;
};
// ---------------------------------------------------------------------------
// Work history — extract most recent title & company from experience section
// ---------------------------------------------------------------------------
const parseWorkHistory = (map, rawContent) => {
    const expBlock = getSection(map, "experience") || rawContent;
    // ── Pattern A: "Title at Company" / "Title @ Company" ────────────────────
    const atMatch = expBlock.match(/([A-Za-z][A-Za-z /\-]{3,60}?)\s+(?:at|@)\s+([A-Z][A-Za-z0-9 &.,'\-]{1,60}?)(?:\s*[\(,|\n]|\s*\d{4}|$)/);
    if (atMatch) {
        const t = atMatch[1].trim();
        const c = atMatch[2].trim();
        if (JOB_TITLE_WORD_RE.test(t))
            return { title: t, company: c };
    }
    // ── Pattern B: "Company | Title | dates" or "Title | Company | dates" ─────
    const pipeMatch = expBlock.match(/([A-Za-z][A-Za-z0-9 &.,'\-]{1,60}?)\s*\|\s*([A-Za-z][A-Za-z0-9 &.,'\-]{1,60}?)\s*(?:\||\d{4})/);
    if (pipeMatch) {
        const first = pipeMatch[1].trim();
        const second = pipeMatch[2].trim();
        if (JOB_TITLE_WORD_RE.test(first) && !JOB_TITLE_WORD_RE.test(second))
            return { title: first, company: second };
        if (JOB_TITLE_WORD_RE.test(second) && !JOB_TITLE_WORD_RE.test(first))
            return { title: second, company: first };
        // Default order: Company | Title
        return { title: second, company: first };
    }
    // ── Pattern C: Multi-line entry — scan first job block ────────────────────
    const entryLines = expBlock
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    let title = "";
    let company = "";
    for (const line of entryLines.slice(0, 8)) {
        // Stop when we hit bullet points (job duties)
        if (/^[•\-\*◆▪►✓]/.test(line))
            break;
        // Skip pure date lines
        if (/^\d{4}\s*[-–—]/.test(line) || /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line))
            continue;
        if (line.length > 100)
            continue;
        if (!title && JOB_TITLE_WORD_RE.test(line)) {
            title = line;
        }
        else if (title && !company && /^[A-Z]/.test(line) && !JOB_TITLE_WORD_RE.test(line)) {
            company = line;
        }
        else if (!title && !company && /^[A-Z]/.test(line)) {
            // Could be company or title — store as company tentatively
            company = line;
        }
        else if (company && !title && JOB_TITLE_WORD_RE.test(line)) {
            title = line;
        }
        if (title && company)
            break;
    }
    return { title, company };
};
// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const parseSummary = (map, rawContent) => {
    // 1. From a labeled summary section
    const summaryBlock = getSection(map, "summary", "contact");
    if (summaryBlock && summaryBlock.length > 40) {
        // Take up to 500 chars; skip lines that are purely contact info
        const lines = summaryBlock
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !/@/.test(l) && !/^\+?\d/.test(l));
        const joined = lines.join(" ").trim();
        if (joined.length > 40)
            return joined.slice(0, 500);
    }
    // 2. From header section — look for a paragraph-like block
    const header = map.get("__header__") ?? "";
    const paragraphs = header.split(/\n{2,}/);
    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (trimmed.length < 60)
            continue;
        if (/@/.test(trimmed) || /^\+?\d/.test(trimmed))
            continue;
        const lines = trimmed.split("\n");
        const avgLen = lines.reduce((s, l) => s + l.length, 0) / (lines.length || 1);
        if (avgLen > 30)
            return trimmed.slice(0, 500);
    }
    // 3. First long sentence from raw content that looks like a bio
    const sentences = rawContent.split(/(?<=[.!?])\s+/);
    const bio = sentences.find((s) => s.trim().length > 60 && !/@/.test(s) && !/^\+?\d/.test(s.trim()));
    return bio ? bio.trim().slice(0, 500) : "";
};
// ---------------------------------------------------------------------------
// Job title and company (current)
// ---------------------------------------------------------------------------
const parseCurrentTitle = (map, workHistory, rawContent) => {
    // 1. Labeled field
    const header = map.get("__header__") ?? "";
    const labelMatch = header.match(/(?:current title|job title|designation|position|role)\s*[:\-]\s*([A-Za-z][A-Za-z /\-]{3,80})/i);
    if (labelMatch?.[1])
        return labelMatch[1].trim();
    // 2. From work history extraction
    if (workHistory.title)
        return workHistory.title;
    // 3. Inline pattern in header or summary
    const searchIn = header + "\n" + getSection(map, "summary");
    const roleMatch = searchIn.match(/(?:i(?:'m| am) (?:a |an )?|working as (?:a |an )?|currently (?:a |an )?|serve(?:d|s)? as (?:a |an )?)([A-Za-z][A-Za-z /\-]{3,60}?)(?:\s+at\s|\s+with\s|\s+@\s|[,.\n]|$)/i);
    if (roleMatch?.[1] && JOB_TITLE_WORD_RE.test(roleMatch[1]))
        return roleMatch[1].trim();
    // 4. Second non-contact line in header that contains a title keyword
    const headerLines = header.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of headerLines.slice(0, 12)) {
        if (/[0-9@+]/.test(line) && !/[A-Za-z]{4,}/.test(line))
            continue;
        if (/^(Skills|Experience|Education|Summary|Profile|Contact|Objective)/i.test(line))
            continue;
        const wc = line.split(/\s+/).length;
        if (wc >= 1 && wc <= 8 && line.length < 80 && JOB_TITLE_WORD_RE.test(line))
            return line;
    }
    void rawContent;
    return "";
};
const parseCurrentCompany = (map, workHistory, rawContent) => {
    // 1. Labeled field
    const header = map.get("__header__") ?? "";
    const labelMatch = header.match(/(?:current company|current employer|company|employer|organization)\s*[:\-]\s*([A-Z][A-Za-z0-9 &.,'\-]{1,80})/i);
    if (labelMatch?.[1]) {
        const c = labelMatch[1].trim();
        if (!/^(the|a |an |my |our )/i.test(c))
            return c;
    }
    // 2. From work history extraction
    if (workHistory.company)
        return workHistory.company;
    // 3. "at/with/for [Company]" anywhere in header or summary
    const searchIn = header + "\n" + getSection(map, "summary");
    const atMatch = searchIn.match(/(?:\bat\b|\bwith\b)\s+([A-Z][A-Za-z0-9 &.,'\-]{1,60}?)(?:\s+(?:Inc|Ltd|LLC|Corp|Limited|Technologies|Tech|Solutions|Systems|Services|Global|Group)\.?)?(?=[,.\n]|$|\s+(?:as|where|since|from|and)\b)/);
    if (atMatch?.[1]) {
        const c = atMatch[1].trim();
        if (!/^(the|a |an |my |our |present|least|most)/i.test(c))
            return c;
    }
    // 4. Corporate suffix
    const corpMatch = rawContent.match(/([A-Z][A-Za-z0-9 &'\-]{1,40}?)\s+(?:Inc|Ltd|LLC|Corp|Limited|Technologies|Tech|Solutions|Systems|Services)\.?(?=[^A-Za-z]|$)/);
    if (corpMatch?.[1])
        return corpMatch[1].trim();
    return "";
};
// ---------------------------------------------------------------------------
// Job description helpers
// ---------------------------------------------------------------------------
const parseJobTitle = (map, rawContent) => {
    // Labeled field
    const labelMatch = rawContent.match(/(?:job title|position title|role|designation)\s*[:\-]\s*([A-Za-z0-9 &\-\/+]{3,100})/i);
    if (labelMatch)
        return labelMatch[1].trim();
    // Header section first line (JDs often start with the title)
    const headerLines = (map.get("__header__") ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    if (headerLines.length > 0 && headerLines[0].length < 100)
        return headerLines[0];
    return "";
};
const parseBudget = (rawContent) => {
    const match = rawContent.match(/(?:budget|salary|compensation|ctc|package|remuneration)\s*[:\-]?\s*([^\n]{3,80})/i);
    if (!match)
        return { budget_text: "", salary_min: undefined, salary_max: undefined };
    const budgetText = match[1].trim();
    const numRe = /([\d,]+(?:\.\d+)?)/g;
    const nums = [];
    let nm;
    while ((nm = numRe.exec(budgetText)) !== null) {
        const v = Number(nm[1].replace(/,/g, ""));
        if (v > 0)
            nums.push(v);
    }
    return {
        budget_text: budgetText,
        salary_min: nums[0],
        salary_max: nums[1] ?? nums[0],
    };
};
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
const parseResumeText = (content) => {
    console.log("[Parse] Resume parsing started");
    const normalized = cleanText(content);
    const map = buildSectionMap(normalized);
    const workHistory = parseWorkHistory(map, normalized);
    const result = {
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
    console.log("[Parse] Resume parsed:", JSON.stringify({ name: result.name, email: result.email, skills_count: result.skills?.length }));
    return result;
};
exports.parseResumeText = parseResumeText;
const parseVendorText = (content) => {
    console.log("[Parse] Vendor parsing started");
    const normalized = cleanText(content);
    const map = buildSectionMap(normalized);
    const resume = (0, exports.parseResumeText)(normalized);
    const companySection = resume.current_company || "";
    const contactName = resume.name ||
        (map.get("__header__") ?? "")
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l &&
            !/[0-9@]/.test(l) &&
            !/^(Skills|Experience|Education|Summary|Profile|Contact|Company)/i.test(l))[0] ||
        "";
    const geoBlock = getSection(map, "contact") || "";
    const geographies = geoBlock
        ? geoBlock
            .split(/[\n,•\-\*|;]+/)
            .map((t) => t.trim())
            .filter((t) => t.length > 1 && t.length < 60)
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
exports.parseVendorText = parseVendorText;
const parseJobDescriptionText = (content) => {
    console.log("[Parse] JD parsing started");
    const normalized = cleanText(content);
    const map = buildSectionMap(normalized);
    const skills = parseSkills(map, normalized);
    const exp = parseExperienceYears(map, normalized);
    const budget = parseBudget(normalized);
    const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs|year)\b/i);
    const title = parseJobTitle(map, normalized);
    if (!title) {
        console.log("[Parse] JD: title missing — attaching raw fallback");
        const empty = { title: "", location: "", required_skills: [], description: normalized.slice(0, 3000) };
        return { ...empty, parsed: false, raw_text: normalized };
    }
    const result = {
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
    console.log("[Parse] JD parsed:", JSON.stringify({ title: result.title, skills_count: result.required_skills?.length }));
    return result;
};
exports.parseJobDescriptionText = parseJobDescriptionText;
