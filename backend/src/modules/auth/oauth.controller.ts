import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import pool from "../../db";
import env from "../../config/env";
import redis from "../../lib/redis";
import {
  createOAuthState,
  getGoogleAuthorizationUrl,
  exchangeGoogleCode,
  getMicrosoftAuthorizationUrl,
  exchangeMicrosoftCode,
} from "./oauth.service";

const OAUTH_STATE_TTL = 600;
const OAUTH_CODE_TTL = 60;

function frontendOAuthError(res: Response, message: string) {
  const url = new URL(`${env.FRONTEND_URL}/login`);

  url.searchParams.set("oauth_error", message);

  return res.redirect(url.toString());
}

export const googleStart = async (req: Request, res: Response) => {
  try {
    const state = createOAuthState();

    await redis.setex(`oauth_state:google:${state}`, OAUTH_STATE_TTL, "1");

    return res.redirect(getGoogleAuthorizationUrl(state));
  } catch (error) {
    console.error("Google OAuth start error:", error);

    return frontendOAuthError(res, "Google login is not configured");
  }
};

export const googleCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (typeof code !== "string" || typeof state !== "string") {
      return frontendOAuthError(res, "Invalid Google OAuth response");
    }

    const stateKey = `oauth_state:google:${state}`;

    const validState = await redis.get(stateKey);

    await redis.del(stateKey);

    if (!validState) {
      return frontendOAuthError(
        res,
        "OAuth session expired. Please try again.",
      );
    }

    const identity = await exchangeGoogleCode(code);

    return completeOAuthLogin(res, identity);
  } catch (error) {
    console.error("Google OAuth callback error:", error);

    return frontendOAuthError(res, "Google authentication failed");
  }
};

export const microsoftStart = async (req: Request, res: Response) => {
  try {
    const state = createOAuthState();

    await redis.setex(`oauth_state:microsoft:${state}`, OAUTH_STATE_TTL, "1");

    return res.redirect(getMicrosoftAuthorizationUrl(state));
  } catch (error) {
    console.error("Microsoft OAuth start error:", error);

    return frontendOAuthError(res, "Microsoft login is not configured");
  }
};

export const microsoftCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (typeof code !== "string" || typeof state !== "string") {
      return frontendOAuthError(res, "Invalid Microsoft OAuth response");
    }

    const stateKey = `oauth_state:microsoft:${state}`;

    const validState = await redis.get(stateKey);

    await redis.del(stateKey);

    if (!validState) {
      return frontendOAuthError(
        res,
        "OAuth session expired. Please try again.",
      );
    }

    const identity = await exchangeMicrosoftCode(code);

    return completeOAuthLogin(res, identity);
  } catch (error) {
    console.error("Microsoft OAuth callback error:", error);

    return frontendOAuthError(res, "Microsoft authentication failed");
  }
};

async function completeOAuthLogin(
  res: Response,
  identity: {
    email: string;
    fullName: string;
    avatarUrl?: string | null;
  },
) {
  const userResult = await pool.query(
    `SELECT *
     FROM users
     WHERE LOWER(email) = LOWER($1)
       AND is_active = true`,
    [identity.email],
  );

  if (userResult.rows.length === 0) {
    return frontendOAuthError(
      res,
      "No ZorHire account exists for this email. Please contact your administrator.",
    );
  }

  const user = userResult.rows[0];

  const [membershipResult, profileResult] = await Promise.all([
    pool.query(
      `SELECT
           m.tenant_id,
           m.role,
           t.name AS tenant_name
         FROM tenant_memberships m
         JOIN tenants t
           ON m.tenant_id = t.id
         WHERE m.user_id = $1
           AND m.is_active = true`,
      [user.id],
    ),

    pool.query(
      `SELECT *
         FROM profiles
         WHERE id = $1`,
      [user.id],
    ),
  ]);

  const membership = membershipResult.rows[0];

  const profile = profileResult.rows[0];

  if (!membership) {
    return frontendOAuthError(
      res,
      "Your account has no active tenant membership.",
    );
  }

  const tenantResult = await pool.query(
    `SELECT
       t.is_platform_owner,
       (
         SELECT status
         FROM subscriptions
         WHERE tenant_id = t.id
           AND status IN ('active', 'trial')
         ORDER BY created_at DESC
         LIMIT 1
       ) AS sub_status
     FROM tenants t
     WHERE t.id = $1`,
    [membership.tenant_id],
  );

  const tenant = tenantResult.rows[0];

  const isPlatformOwner = !!tenant?.is_platform_owner;

  const subStatus = tenant?.sub_status ?? null;

  const subscription = {
    active: isPlatformOwner || subStatus === "active" || subStatus === "trial",

    isPlatformOwner,

    reason: subStatus ?? (isPlatformOwner ? "platform_owner" : "none"),
  };

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: membership.role,
      tenant_id: membership.tenant_id,
      must_change_password: user.must_change_password,
    },
    env.JWT_SECRET,
    {
      expiresIn: "24h",
      jwtid: crypto.randomUUID(),
    },
  );

  /*
   * Never put the JWT directly in the redirect URL.
   *
   * Store it temporarily in Redis and send the frontend
   * a one-time exchange code instead.
   */
  const exchangeCode = crypto.randomBytes(32).toString("hex");

  await redis.setex(`oauth_exchange:${exchangeCode}`, OAUTH_CODE_TTL, token);

  const redirectUrl = new URL(`${env.FRONTEND_URL}/oauth/callback`);

  redirectUrl.searchParams.set("code", exchangeCode);

  return res.redirect(redirectUrl.toString());
}

export const exchangeOAuthCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (typeof code !== "string" || !code) {
      return res.status(400).json({
        message: "OAuth exchange code is required",
      });
    }

    const key = `oauth_exchange:${code}`;

    const token = await redis.get(key);

    if (!token) {
      return res.status(401).json({
        message: "OAuth session expired. Please sign in again.",
      });
    }

    // One-time use
    await redis.del(key);

    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
    };

    const [userResult, profileResult, membershipResult] = await Promise.all([
      pool.query(
        "SELECT email, must_change_password FROM users WHERE id = $1 AND is_active = true",
        [decoded.id],
      ),

      pool.query("SELECT * FROM profiles WHERE id = $1", [decoded.id]),

      pool.query(
        `SELECT
             m.tenant_id,
             m.role,
             t.name AS tenant_name
           FROM tenant_memberships m
           JOIN tenants t
             ON m.tenant_id = t.id
           WHERE m.user_id = $1
             AND m.is_active = true`,
        [decoded.id],
      ),
    ]);

    const user = userResult.rows[0];

    const profile = profileResult.rows[0];

    const membership = membershipResult.rows[0];

    const tenantResult = await pool.query(
      `SELECT
           t.is_platform_owner,
           (
             SELECT status
             FROM subscriptions
             WHERE tenant_id = t.id
               AND status IN ('active', 'trial')
             ORDER BY created_at DESC
             LIMIT 1
           ) AS sub_status
         FROM tenants t
         WHERE t.id = $1`,
      [membership.tenant_id],
    );

    const tenant = tenantResult.rows[0];

    const isPlatformOwner = !!tenant?.is_platform_owner;

    const subStatus = tenant?.sub_status ?? null;

    return res.json({
      token,

      user: {
        id: decoded.id,
        email: user.email,
        full_name: profile?.full_name,
        role: membership.role,
        tenant_id: membership.tenant_id,
        tenant_name: membership.tenant_name,
        must_change_password: user.must_change_password,
        avatar_url: profile?.avatar_url,
      },

      subscription: {
        active:
          isPlatformOwner || subStatus === "active" || subStatus === "trial",

        isPlatformOwner,

        reason: subStatus ?? (isPlatformOwner ? "platform_owner" : "none"),
      },
    });
  } catch (error) {
    console.error("OAuth exchange error:", error);

    return res.status(401).json({
      message: "Invalid or expired OAuth session.",
    });
  }
};
