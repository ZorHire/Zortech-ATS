// pdf-parse v2 uses a class-based API: new PDFParse({data: buffer}).getText()
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (opts: { data: Buffer }) => { getText: () => Promise<{ text: string }> };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth") as {
  extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
};

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

const normalizeText = (value: string) =>
  value
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();

const readFileText = async (file: Express.Multer.File): Promise<string> => {
  // file.buffer is populated by multer memoryStorage
  const buffer: Buffer = file.buffer;
  const extension = file.originalname
    ? file.originalname.split(".").pop()?.toLowerCase() ?? ""
    : "";

  if (extension === "pdf" || file.mimetype === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text || "";
  }

  if (
    extension === "docx" ||
    file.mimetype.includes("officedocument.wordprocessingml.document")
  ) {
    const data = await mammoth.extractRawText({ buffer });
    return data.value || "";
  }

  if (
    extension === "doc" ||
    file.mimetype === "application/msword"
  ) {
    // mammoth has limited support for old binary .doc; attempt it but surface
    // a clear warning rather than silently returning empty text
    try {
      const data = await mammoth.extractRawText({ buffer });
      if (data.value && data.value.trim().length > 20) return data.value;
    } catch {
      // fall through
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
    if (/^[A-Za-z ]{1,30}:/.test(line) && sectionLines.length > 0) {
      break;
    }
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
    if (/^(Skills|Experience|Education|Summary|Profile|Contact)/i.test(line))
      continue;
    if (line.split(" ").length <= 5) {
      return line;
    }
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
    return { min: Number(parseFloat(rangeMatch[1])), max: Number(parseFloat(rangeMatch[2])) };
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
  "javascript","typescript","python","java","c++","c#","c","go","golang","rust","ruby","php","swift","kotlin","scala","r","matlab","perl","bash","shell",
  // Frontend
  "react","vue","angular","next.js","nextjs","nuxt","svelte","html","css","sass","less","tailwind","bootstrap","jquery","redux","mobx","zustand","graphql","rest","websocket",
  // Backend
  "node","node.js","nodejs","express","fastapi","django","flask","spring","laravel","rails","nestjs","fastify","hapi","koa",
  // Databases
  "sql","mysql","postgresql","postgres","mongodb","redis","elasticsearch","cassandra","dynamodb","sqlite","oracle","mssql","firestore","supabase",
  // Cloud & DevOps
  "aws","azure","gcp","docker","kubernetes","terraform","ansible","jenkins","ci/cd","github actions","gitlab ci","linux","nginx","apache",
  // Data & ML
  "machine learning","deep learning","tensorflow","pytorch","keras","pandas","numpy","scikit-learn","spark","hadoop","tableau","power bi","data analysis","nlp",
  // Mobile
  "react native","flutter","ios","android","xamarin",
  // Tools
  "git","jira","figma","postman","webpack","vite","babel","eslint",
];

const parseSkills = (content: string) => {
  // First try to find a skills section
  const section =
    findSectionText(
      content,
      /(?:skills|technical skills|key skills|core competencies|core skills|technologies)[:\s]*/i,
    );

  if (section && section.length > 10) {
    const items = splitListText(section);
    const filtered = items.filter((skill) => skill.length > 1 && skill.length < 60);
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

// Parse a number string that may use Indian (1,00,000) or Western (100,000) comma formatting
const parseNumericString = (s: string): number => {
  // Remove all commas then parse — handles both 1,00,000 and 1,000,000
  return Number(s.replace(/,/g, ""));
};

const parseBudget = (content: string) => {
  const match = content.match(/(?:budget|salary|compensation|ctc)[:\s]*([^\n]+)/i);
  if (!match)
    return { budget_text: "", salary_min: undefined, salary_max: undefined };

  const budgetText = match[1].trim();
  // Match full numbers including commas (Indian/Western format), then optional range
  const valueMatch = budgetText.match(
    /([\d,]+)\s*(?:-\s*([\d,]+))?/,
  );
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
  if (!file) return "";
  const text = await readFileText(file);
  return normalizeText(text);
};

export const parseResumeText = (content: string): ParsedResumeData => {
  const normalized = normalizeText(content);
  return {
    name: parseName(normalized),
    email: parseEmail(normalized),
    phone: parsePhone(normalized),
    skills: parseSkills(normalized),
    experience_years: parseExperience(normalized).min,
    current_title:
      findSectionText(
        normalized,
        /(?:current title|title|designation)[:\s]*/i,
      ) || "",
    current_company:
      findSectionText(
        normalized,
        /(?:current company|company|organization|employer)[:\s]*/i,
      ) || "",
    current_location: parseLocation(normalized),
    summary:
      findSectionText(
        normalized,
        /(?:summary|profile|about me|professional summary)[:\s]*/i,
      ) || "",
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
