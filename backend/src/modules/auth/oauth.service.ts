import axios from "axios";
import crypto from "crypto";
import { ConfidentialClientApplication } from "@azure/msal-node";
import env from "../../config/env";

export type OAuthIdentity = {
  provider: "google" | "microsoft";
  providerId: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  emailVerified: boolean;
};

function requireConfig(value: string, name: string): string {
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export function createOAuthState(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getGoogleAuthorizationUrl(state: string): string {
  const clientId = requireConfig(
    env.GOOGLE_OAUTH_CLIENT_ID,
    "GOOGLE_OAUTH_CLIENT_ID",
  );

  const redirectUri = requireConfig(
    env.GOOGLE_OAUTH_REDIRECT_URI,
    "GOOGLE_OAUTH_REDIRECT_URI",
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<OAuthIdentity> {
  const clientId = requireConfig(
    env.GOOGLE_OAUTH_CLIENT_ID,
    "GOOGLE_OAUTH_CLIENT_ID",
  );

  const clientSecret = requireConfig(
    env.GOOGLE_OAUTH_CLIENT_SECRET,
    "GOOGLE_OAUTH_CLIENT_SECRET",
  );

  const redirectUri = requireConfig(
    env.GOOGLE_OAUTH_REDIRECT_URI,
    "GOOGLE_OAUTH_REDIRECT_URI",
  );

  const tokenResponse = await axios.post(
    "https://oauth2.googleapis.com/token",
    new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  const accessToken = tokenResponse.data.access_token;

  if (!accessToken) {
    throw new Error("Google OAuth did not return an access token");
  }

  const userResponse = await axios.get(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const profile = userResponse.data;

  if (!profile.email || !profile.email_verified) {
    throw new Error("Google account email is not verified");
  }

  return {
    provider: "google",
    providerId: profile.sub,
    email: profile.email.toLowerCase(),
    fullName: profile.name || profile.email,
    avatarUrl: profile.picture || null,
    emailVerified: true,
  };
}

export function getMicrosoftAuthorizationUrl(state: string): string {
  const clientId = requireConfig(
    env.MICROSOFT_OAUTH_CLIENT_ID,
    "MICROSOFT_OAUTH_CLIENT_ID",
  );

  const tenantId = env.MICROSOFT_OAUTH_CLIENT_ID || "common";

  const redirectUri = requireConfig(
    env.MICROSOFT_OAUTH_REDIRECT_URI,
    "MICROSOFT_OAUTH_REDIRECT_URI",
  );

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: "openid profile email User.Read",
    state,
  });

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeMicrosoftCode(
  code: string,
): Promise<OAuthIdentity> {
  const clientId = requireConfig(
    env.MICROSOFT_OAUTH_CLIENT_ID,
    "MICROSOFT_OAUTH_CLIENT_ID",
  );

  const clientSecret = requireConfig(
    env.MICROSOFT_OAUTH_CLIENT_SECRET,
    "MICROSOFT_OAUTH_CLIENT_SECRET",
  );

  const tenantId = env.MICROSOFT_OAUTH_CLIENT_ID || "common";

  const redirectUri = requireConfig(
    env.MICROSOFT_OAUTH_REDIRECT_URI,
    "MICROSOFT_OAUTH_REDIRECT_URI",
  );

  const msal = new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  });

  const result = await msal.acquireTokenByCode({
    code,
    scopes: ["openid", "profile", "email", "User.Read"],
    redirectUri,
  });

  if (!result?.accessToken) {
    throw new Error("Microsoft OAuth did not return an access token");
  }

  const userResponse = await axios.get("https://graph.microsoft.com/v1.0/me", {
    headers: {
      Authorization: `Bearer ${result.accessToken}`,
    },
  });

  const profile = userResponse.data;

  const email = profile.mail || profile.userPrincipalName || "";

  if (!email) {
    throw new Error("Microsoft account did not provide an email");
  }

  return {
    provider: "microsoft",
    providerId: profile.id,
    email: email.toLowerCase(),
    fullName: profile.displayName || email,
    avatarUrl: null,
    emailVerified: true,
  };
}
