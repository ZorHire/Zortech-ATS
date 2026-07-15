const NAUKRI_BASE = "https://www.naukri.com/jobapi/v4";
const NAUKRI_RESDEX_BASE = "https://resdex.naukri.com/api/v1";

function getNaukriHeaders() {
  return {
    "appid": "109",
    "SystemId": "Naukri",
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.NAUKRI_API_KEY || ""}`,
  };
}

export async function searchNaukriResumes(opts: {
  keywords: string;
  location?: string;
  minExperience?: number;
  maxExperience?: number;
  page?: number;
  pageSize?: number;
}): Promise<{
  total: number;
  candidates: Array<{
    id: string;
    name: string;
    currentDesignation: string;
    totalExperience: number;
    currentSalary: string;
    location: string;
    skills: string[];
    lastActive: string;
    resumeAge: string;
  }>;
}> {
  const key = process.env.NAUKRI_API_KEY;
  if (!key) throw new Error("NAUKRI_API_KEY not configured");

  const params = new URLSearchParams({
    keyword: opts.keywords,
    ...(opts.location && { location: opts.location }),
    ...(opts.minExperience !== undefined && { minExp: String(opts.minExperience) }),
    ...(opts.maxExperience !== undefined && { maxExp: String(opts.maxExperience) }),
    noOfResults: String(opts.pageSize || 20),
    offset: String(((opts.page || 1) - 1) * (opts.pageSize || 20)),
  });

  const resp = await fetch(`${NAUKRI_RESDEX_BASE}/resume/search?${params}`, {
    headers: getNaukriHeaders(),
  });

  if (!resp.ok) {
    const err = await resp.json() as any;
    throw new Error(err?.message || "Naukri resume search failed");
  }

  const data = await resp.json() as any;

  return {
    total: data.total || 0,
    candidates: (data.results || []).map((r: any) => ({
      id: r.candidateId || r.id,
      name: r.name || r.candidateName,
      currentDesignation: r.currentDesignation || "",
      totalExperience: r.totalExperience || 0,
      currentSalary: r.currentSalary || "",
      location: r.location || r.currentLocation || "",
      skills: r.skills || r.keySkills || [],
      lastActive: r.lastActive || "",
      resumeAge: r.resumeAge || "",
    })),
  };
}

export async function getNaukriResumeDetails(candidateId: string): Promise<{
  id: string;
  name: string;
  email: string;
  phone: string;
  education: Array<{ degree: string; institution: string; year: number }>;
  experience: Array<{ company: string; designation: string; from: string; to: string; description: string }>;
  skills: string[];
}> {
  const key = process.env.NAUKRI_API_KEY;
  if (!key) throw new Error("NAUKRI_API_KEY not configured");

  const resp = await fetch(`${NAUKRI_RESDEX_BASE}/resume/${candidateId}`, {
    headers: getNaukriHeaders(),
  });

  if (!resp.ok) throw new Error("Failed to fetch Naukri resume details");

  const data = await resp.json() as any;
  const r = data.result || data;

  return {
    id: candidateId,
    name: r.name || "",
    email: r.email || "",
    phone: r.phone || r.mobile || "",
    education: (r.education || []).map((e: any) => ({
      degree: e.degree || e.qualification,
      institution: e.institution || e.university,
      year: e.yearOfPassing || e.year,
    })),
    experience: (r.workExperience || r.experience || []).map((ex: any) => ({
      company: ex.company || ex.organization,
      designation: ex.designation || ex.title,
      from: ex.fromDate || ex.from,
      to: ex.toDate || ex.to || "Present",
      description: ex.description || "",
    })),
    skills: r.skills || r.keySkills || [],
  };
}

export async function postJobToNaukri(opts: {
  title: string;
  description: string;
  location: string;
  minExperience: number;
  maxExperience: number;
  minSalary?: number;
  maxSalary?: number;
  skills: string[];
  applyUrl: string;
}): Promise<string> {
  const key = process.env.NAUKRI_API_KEY;
  if (!key) throw new Error("NAUKRI_API_KEY not configured");

  const resp = await fetch(`${NAUKRI_BASE}/jobs`, {
    method: "POST",
    headers: getNaukriHeaders(),
    body: JSON.stringify({
      title: opts.title,
      jobDescription: opts.description,
      location: [opts.location],
      experience: { min: opts.minExperience, max: opts.maxExperience },
      salary: { min: opts.minSalary, max: opts.maxSalary, currency: "INR" },
      skills: opts.skills,
      applyRedirectUrl: opts.applyUrl,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json() as any;
    throw new Error(err?.message || "Naukri job post failed");
  }

  const data = await resp.json() as any;
  return data.jobId || data.id;
}
