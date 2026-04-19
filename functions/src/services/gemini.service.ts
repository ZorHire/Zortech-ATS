import axios from "axios";
import env from "../config/env";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const callGemini = async (prompt: string): Promise<string> => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const response = await axios.post(
    `${GEMINI_URL}?key=${apiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    },
    { timeout: 20000 },
  );

  const text: string | undefined =
    response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");
  return text;
};

const safeJson = (raw: string): any => {
  try {
    // Strip markdown code fences if present
    const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
};

const asString = (v: unknown): string =>
  v && typeof v === "string" ? v.trim() : "";

const asNumber = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

const asArray = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  return v.filter((s) => typeof s === "string" && s.trim()).map((s: string) => s.trim());
};

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

export interface GeminiResumeResult {
  name: string;
  email: string;
  phone: string;
  skills: string[];
  experience_years?: number;
  current_title: string;
  current_company: string;
  current_location: string;
  summary: string;
}

export const parseResumeWithGemini = async (
  text: string,
): Promise<GeminiResumeResult> => {
  const prompt = `Parse the following resume and return ONLY a JSON object with these exact fields. Use empty string for missing text fields, empty array for missing arrays, and omit numeric fields if not found.

{
  "name": "candidate full name",
  "email": "email address",
  "phone": "phone number with country code if present",
  "skills": ["technical skill 1", "technical skill 2"],
  "experience_years": 5,
  "current_title": "most recent job title",
  "current_company": "most recent employer",
  "current_location": "city, country",
  "summary": "professional summary (max 300 words)"
}

RESUME:
${text.slice(0, 9000)}`;

  const raw = await callGemini(prompt);
  const parsed = safeJson(raw);
  if (!parsed) throw new Error("Gemini returned unparseable JSON for resume");

  return {
    name: asString(parsed.name),
    email: asString(parsed.email),
    phone: asString(parsed.phone),
    skills: asArray(parsed.skills),
    experience_years: asNumber(parsed.experience_years),
    current_title: asString(parsed.current_title),
    current_company: asString(parsed.current_company),
    current_location: asString(parsed.current_location),
    summary: asString(parsed.summary),
  };
};

// ---------------------------------------------------------------------------
// Job Description
// ---------------------------------------------------------------------------

export interface GeminiJobResult {
  title: string;
  location: string;
  required_skills: string[];
  experience_min?: number;
  experience_max?: number;
  salary_min?: number;
  salary_max?: number;
  budget_text: string;
  description: string;
}

export const parseJobDescriptionWithGemini = async (
  text: string,
): Promise<GeminiJobResult> => {
  const prompt = `Parse the following job description and return ONLY a JSON object with these exact fields. Use empty string/array for missing text fields. For salary numbers use raw integers (no currency symbols).

{
  "title": "job title",
  "location": "work location or Remote",
  "required_skills": ["skill 1", "skill 2"],
  "experience_min": 2,
  "experience_max": 5,
  "salary_min": 800000,
  "salary_max": 1200000,
  "budget_text": "raw compensation text from document",
  "description": "complete job description (max 800 words)"
}

JOB DESCRIPTION:
${text.slice(0, 9000)}`;

  const raw = await callGemini(prompt);
  const parsed = safeJson(raw);
  if (!parsed) throw new Error("Gemini returned unparseable JSON for JD");

  return {
    title: asString(parsed.title),
    location: asString(parsed.location),
    required_skills: asArray(parsed.required_skills),
    experience_min: asNumber(parsed.experience_min),
    experience_max: asNumber(parsed.experience_max),
    salary_min: asNumber(parsed.salary_min),
    salary_max: asNumber(parsed.salary_max),
    budget_text: asString(parsed.budget_text),
    description: asString(parsed.description),
  };
};

// ---------------------------------------------------------------------------
// Vendor
// ---------------------------------------------------------------------------

export interface GeminiVendorResult {
  company_name: string;
  email: string;
  phone: string;
  skills: string[];
  location: string;
  summary: string;
}

export const parseVendorWithGemini = async (
  text: string,
): Promise<GeminiVendorResult> => {
  const prompt = `Parse the following vendor or company profile and return ONLY a JSON object with these exact fields. Use empty string for missing text fields and empty array for missing arrays.

{
  "company_name": "name of the vendor or company",
  "email": "primary contact email",
  "phone": "primary contact phone",
  "skills": ["service or technology 1", "service or technology 2"],
  "location": "company headquarters or city",
  "summary": "company profile summary (max 300 words)"
}

VENDOR PROFILE:
${text.slice(0, 9000)}`;

  const raw = await callGemini(prompt);
  const parsed = safeJson(raw);
  if (!parsed) throw new Error("Gemini returned unparseable JSON for vendor");

  return {
    company_name: asString(parsed.company_name),
    email: asString(parsed.email),
    phone: asString(parsed.phone),
    skills: asArray(parsed.skills),
    location: asString(parsed.location),
    summary: asString(parsed.summary),
  };
};
