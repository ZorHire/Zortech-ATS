import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import {
  extractFileText,
  parseJobDescriptionText,
  parseResumeText,
  parseVendorText,
} from "./parse.utils";

const defaultResumeResponse = {
  name: "",
  email: "",
  phone: "",
  skills: [] as string[],
  experience_years: undefined as number | undefined,
  current_title: "",
  current_company: "",
  current_location: "",
  summary: "",
};

const defaultJobResponse = {
  title: "",
  location: "",
  required_skills: [] as string[],
  experience_min: undefined as number | undefined,
  experience_max: undefined as number | undefined,
  budget_text: "",
  salary_min: undefined as number | undefined,
  salary_max: undefined as number | undefined,
  description: "",
};

export const parseResume = async (req: AuthRequest, res: Response) => {
  console.log("Resume route hit");
  console.log("Headers Content-Type:", req.headers["content-type"]);
  console.log("File detected:", !!req.file);
  console.log("User detected:", req.user?.id);

  try {
    const file = req.file;
    if (!file || !file.buffer) {
      console.error("File not received properly:", {
        hasFile: !!file,
        hasBuffer: !!file?.buffer,
        size: file?.size,
      });
      return res.status(400).json({ message: "File not received properly" });
    }
    console.log("File specifics:", {
      name: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    const content = await extractFileText(file);
    console.log("Extracted text:", content.slice(0, 500));

    if (!content || content.trim().length < 20) {
      console.warn("Empty or invalid parsed content");
      return res.status(200).json(defaultResumeResponse);
    }

    const parsed = parseResumeText(content);

    const fallbackName =
      parsed.name ||
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .find(
          (line) =>
            !/[0-9@]/.test(line) &&
            !/^(Skills|Experience|Education|Summary|Profile|Contact)/i.test(line),
        ) ||
      "";

    const fallbackEmail =
      parsed.email ||
      content.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] ||
      "";

    const phoneMatch = content.match(/\+?\d[\d\s\-().]{7,}\d/);
    const fallbackPhone =
      parsed.phone ||
      (phoneMatch ? phoneMatch[0].replace(/[\s().-]/g, "") : "");

    const skillsList = ["react", "node", "python", "java", "sql"];
    const fallbackSkills =
      parsed.skills && parsed.skills.length > 0
        ? parsed.skills
        : skillsList.filter((skill) => content.toLowerCase().includes(skill));

    return res.json({
      name: fallbackName,
      email: fallbackEmail,
      phone: fallbackPhone,
      skills: fallbackSkills,
      experience_years: parsed.experience_years,
      current_title: parsed.current_title || "",
      current_company: parsed.current_company || "",
      current_location: parsed.current_location || "",
      summary: parsed.summary || "",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Parse error";
    console.error("Resume parse error:", msg);
    if (msg.toLowerCase().includes("doc") || msg.toLowerCase().includes("unsupported")) {
      return res.status(400).json({ message: msg });
    }
    return res.status(200).json({ ...defaultResumeResponse });
  }
};

export const parseJobDescription = async (req: AuthRequest, res: Response) => {
  console.log("JD route hit");
  console.log("Headers Content-Type:", req.headers["content-type"]);
  console.log("File detected:", !!req.file);
  console.log("User detected:", req.user?.id);

  try {
    const file = req.file;
    if (!file || !file.buffer) {
      console.error("JD file not received properly:", {
        hasFile: !!file,
        hasBuffer: !!file?.buffer,
        size: file?.size,
      });
      return res.status(400).json({ message: "File not received properly" });
    }

    const content = await extractFileText(file);

    if (!content || content.trim().length < 20) {
      console.warn("Empty or invalid parsed content");
      return res.status(200).json(defaultJobResponse);
    }

    const parsed = parseJobDescriptionText(content);

    return res.json({
      title: parsed.title || "",
      location: parsed.location || "",
      required_skills: parsed.required_skills || [],
      experience_min: parsed.experience_min,
      experience_max: parsed.experience_max,
      budget_text: parsed.budget_text || "",
      salary_min: parsed.salary_min,
      salary_max: parsed.salary_max,
      description: parsed.description || "",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Parse error";
    console.error("JD parse error:", msg);
    if (msg.toLowerCase().includes("doc") || msg.toLowerCase().includes("unsupported")) {
      return res.status(400).json({ message: msg });
    }
    return res.status(200).json({ ...defaultJobResponse });
  }
};

const defaultVendorResponse = {
  company_name: "",
  email: "",
  phone: "",
  skills: [] as string[],
  location: "",
  summary: "",
};

export const parseVendor = async (req: AuthRequest, res: Response) => {
  console.log("Vendor route hit");
  console.log("Headers Content-Type:", req.headers["content-type"]);
  console.log("File detected:", !!req.file);

  try {
    const file = req.file;
    if (!file || !file.buffer) {
      console.error("Vendor file not received properly:", {
        hasFile: !!file,
        hasBuffer: !!file?.buffer,
        size: file?.size,
      });
      return res.status(400).json({ message: "File not received properly" });
    }

    const content = await extractFileText(file);

    if (!content || content.trim().length < 20) {
      console.warn("Empty or invalid parsed content");
      return res.status(200).json(defaultVendorResponse);
    }

    const parsed = parseVendorText(content);

    return res.json({
      company_name: parsed.company_name || "",
      email: parsed.email || "",
      phone: parsed.phone || "",
      skills: parsed.skills || [],
      location: parsed.location || "",
      summary: parsed.summary || "",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Parse error";
    console.error("Vendor parse error:", msg);
    if (msg.toLowerCase().includes("doc") || msg.toLowerCase().includes("unsupported")) {
      return res.status(400).json({ message: msg });
    }
    return res.status(200).json({ ...defaultVendorResponse });
  }
};
