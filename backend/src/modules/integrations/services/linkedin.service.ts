const LINKEDIN_BASE = "https://api.linkedin.com/v2";

function getHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

export function getLinkedInAuthUrl(tenantId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID || "",
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI || "http://localhost:5000/v1/integrations/auth/linkedin/callback",
    state: tenantId,
    scope: "r_liteprofile w_member_social rw_organization_admin",
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

export async function exchangeLinkedInCode(code: string): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI || "http://localhost:5000/v1/integrations/auth/linkedin/callback",
    client_id: process.env.LINKEDIN_CLIENT_ID || "",
    client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
  });

  const resp = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) throw new Error("LinkedIn token exchange failed");
  return resp.json() as any;
}

export async function postJobToLinkedIn(opts: {
  accessToken: string;
  organizationId: string;
  title: string;
  description: string;
  location: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
  workplaceType: "ON_SITE" | "REMOTE" | "HYBRID";
  externalApplyUrl: string;
}): Promise<string> {
  const body = {
    companyApplyUrl: opts.externalApplyUrl,
    description: { text: opts.description },
    employmentType: opts.employmentType,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    jobPostingOperationType: "CREATE",
    listedAt: Date.now(),
    location: opts.location,
    title: opts.title,
    company: `urn:li:organization:${opts.organizationId}`,
    workRemoteAllowed: opts.workplaceType === "REMOTE",
    workplaceTypes: [`urn:li:workplaceType:${opts.workplaceType}`],
  };

  const resp = await fetch(`${LINKEDIN_BASE}/simpleJobPostings`, {
    method: "POST",
    headers: getHeaders(opts.accessToken),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const err = await resp.json() as any;
    throw new Error(err?.message || "LinkedIn job post failed");
  }

  const location = resp.headers.get("x-linkedin-id") || "";
  return location;
}

export async function closeLinkedInJobPosting(accessToken: string, jobId: string): Promise<void> {
  await fetch(`${LINKEDIN_BASE}/simpleJobPostings/${jobId}`, {
    method: "DELETE",
    headers: getHeaders(accessToken),
    signal: AbortSignal.timeout(10_000),
  });
}
