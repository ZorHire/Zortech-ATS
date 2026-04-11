"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJobDescriptionText = exports.parseResumeText = exports.extractFileText = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const mammoth_1 = __importDefault(require("mammoth"));
const normalizeText = (value) => value
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
const readFileText = async (file) => {
    const buffer = await fs_1.default.promises.readFile(file.path);
    const extension = path_1.default.extname(file.originalname).toLowerCase();
    if (extension === ".pdf" || file.mimetype === "application/pdf") {
        const data = await pdf_parse_1.default(buffer);
        return data.text || "";
    }
    if (extension === ".docx" ||
        file.mimetype.includes("officedocument.wordprocessingml.document")) {
        const data = await mammoth_1.default.extractRawText({ path: file.path });
        return data.value || "";
    }
    if (extension === ".txt" || file.mimetype.includes("text/plain")) {
        return buffer.toString("utf8");
    }
    throw new Error("Unsupported file type. Please upload PDF, DOCX, or TXT.");
};
const splitListText = (value) => value
    .split(/[\n,•\-\*]+/)
    .map((item) => item.trim())
    .filter(Boolean);
const findSectionText = (content, label) => {
    const match = content.match(label);
    if (!match || match.index === undefined)
        return "";
    const start = match.index + match[0].length;
    const remainder = content.slice(start).trim();
    const lines = remainder.split(/\r?\n/).map((line) => line.trim());
    const sectionLines = [];
    for (const line of lines) {
        if (!line) {
            if (sectionLines.length > 0)
                break;
            continue;
        }
        if (/^[A-Za-z ]{1,30}:/.test(line) && sectionLines.length > 0) {
            break;
        }
        sectionLines.push(line);
        if (sectionLines.length >= 8)
            break;
    }
    return sectionLines.join(" ");
};
const parseName = (content) => {
    const nameLabel = content.match(/(?:name|candidate name)[:\s]*([A-Za-z][A-Za-z ,.'-]{1,80})/i);
    if (nameLabel?.[1])
        return nameLabel[1].trim();
    const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    for (const line of lines.slice(0, 5)) {
        if (/[0-9@]/.test(line))
            continue;
        if (/^(Skills|Experience|Education|Summary|Profile|Contact)/i.test(line))
            continue;
        if (line.split(" ").length <= 5) {
            return line;
        }
    }
    return "";
};
const parseEmail = (content) => {
    const match = content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match?.[0] || "";
};
const parsePhone = (content) => {
    const match = content.match(/(\+?\d[\d\s\-().]{7,}\d)/);
    if (!match)
        return "";
    const cleaned = match[0].replace(/[\s().-]/g, "");
    return cleaned.length >= 9 ? cleaned : "";
};
const parseExperience = (content) => {
    const match = content.match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years|yrs|year)\b/i);
    if (match)
        return Number(parseFloat(match[1]));
    const underExp = content.match(/experience[:\s]*([0-9]+)/i);
    if (underExp)
        return Number(parseFloat(underExp[1]));
    return undefined;
};
const parseSkills = (content) => {
    const section = findSectionText(content, /(?:skills|technical skills|key skills|core skills)[:\s]*/i) || findSectionText(content, /(?:experience|responsibilities)[:\s]*/i);
    const items = splitListText(section);
    return items.filter((skill) => skill.length > 1);
};
const parseJobTitle = (content) => {
    const match = content.match(/(?:job title|position|role)[:\s]*([A-Za-z0-9 &\-\/+]{3,100})/i);
    if (match)
        return match[1].trim();
    const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    if (lines.length > 0 && lines[0].length < 80) {
        return lines[0];
    }
    return "";
};
const parseLocation = (content) => {
    const match = content.match(/location[:\s]*([A-Za-z0-9 ,\-]+)/i);
    if (match)
        return match[1].trim();
    const remoteMatch = content.match(/\b(remote|work from home|hybrid|onsite)\b/i);
    return remoteMatch ? remoteMatch[1] : "";
};
const parseBudget = (content) => {
    const match = content.match(/(?:budget|salary|compensation)[:\s]*([^\n]+)/i);
    if (!match)
        return { budget_text: "", salary_min: undefined, salary_max: undefined };
    const budgetText = match[1].trim();
    const valueMatch = budgetText.match(/(\d+(?:[.,]\d+)?)\s*(?:-\s*(\d+(?:[.,]\d+)?))?/);
    if (!valueMatch) {
        return {
            budget_text: budgetText,
            salary_min: undefined,
            salary_max: undefined,
        };
    }
    const min = Number(valueMatch[1].replace(/,/g, "."));
    const max = valueMatch[2]
        ? Number(valueMatch[2].replace(/,/g, "."))
        : undefined;
    return {
        budget_text: budgetText,
        salary_min: min || undefined,
        salary_max: max || min,
    };
};
const extractFileText = async (file) => {
    if (!file)
        return "";
    const text = await readFileText(file);
    return normalizeText(text);
};
exports.extractFileText = extractFileText;
const parseResumeText = (content) => {
    const normalized = normalizeText(content);
    return {
        name: parseName(normalized),
        email: parseEmail(normalized),
        phone: parsePhone(normalized),
        skills: parseSkills(normalized),
        experience_years: parseExperience(normalized),
        current_title: findSectionText(normalized, /(?:current title|title|designation)[:\s]*/i) || "",
        current_company: findSectionText(normalized, /(?:current company|company|organization|employer)[:\s]*/i) || "",
        current_location: parseLocation(normalized),
        summary: findSectionText(normalized, /(?:summary|profile|about me|professional summary)[:\s]*/i) || "",
    };
};
exports.parseResumeText = parseResumeText;
const parseJobDescriptionText = (content) => {
    const normalized = normalizeText(content);
    const skills = parseSkills(normalized);
    const experience = parseExperience(normalized);
    const budget = parseBudget(normalized);
    return {
        title: parseJobTitle(normalized),
        location: parseLocation(normalized),
        required_skills: skills,
        experience_min: experience,
        experience_max: experience,
        budget_text: budget.budget_text,
        salary_min: budget.salary_min,
        salary_max: budget.salary_max,
        description: normalized,
    };
};
exports.parseJobDescriptionText = parseJobDescriptionText;
