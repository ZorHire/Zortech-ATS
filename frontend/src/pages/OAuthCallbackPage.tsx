import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { setCredentials, setSessionStatus } from "../store/slices/authSlice";
import type { AuthUser } from "../store/slices/authSlice";
import { setSubscription } from "../store/slices/subscriptionSlice";
import { AlertTriangle } from "lucide-react";
import { Button, Spinner } from "../components/ui";

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [error, setError] = useState("");
  // The exchange code is single-use; React StrictMode runs effects twice in dev.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = searchParams.get("code");
    const oauthError = searchParams.get("oauth_error");

    if (oauthError) {
      setError(`The sign-in provider reported a problem (${oauthError}). Please try again or use your email and password.`);
      return;
    }

    if (!code) {
      setError("OAuth login failed. Please try again.");
      return;
    }

    const exchange = async () => {
      try {
        // VITE_API_URL already ends in /v1.
        const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/v1").replace(/\/$/, "");

        const response = await fetch(`${apiBase}/auth/oauth/exchange`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        });

        // A proxy error page is HTML, not JSON; don't show "Unexpected token <".
        const data = await response.json().catch(() => ({}) as { message?: string });

        if (!response.ok) {
          throw new Error(
            response.status >= 500
              ? "The ZorHire server is having trouble right now. Please try again shortly."
              : data.message || "This sign-in link has expired. Please try again.",
          );
        }

        localStorage.setItem("jwt", data.token);

        dispatch(
          setCredentials({
            user: data.user as AuthUser,
            accessToken: data.token,
          }),
        );

        dispatch(
          setSubscription(
            data.subscription
              ? {
                  active: data.subscription.active,
                  isPlatformOwner: data.subscription.isPlatformOwner ?? false,
                  reason: data.subscription.reason ?? null,
                }
              : null,
          ),
        );

        dispatch(setSessionStatus("active"));

        navigate("/", {
          replace: true,
        });
      } catch (err: any) {
        setError(
          err instanceof TypeError
            ? "Can't reach the ZorHire server right now. Please try again in a few minutes."
            : err?.message || "Sign-in failed. Please try again.",
        );
      }
    };

    exchange();
  }, [searchParams, navigate, dispatch]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10 sm:px-6">
        <div className="zh-card w-full max-w-md p-6 text-center sm:p-8" role="alert">
          <img src="/brand/zortech-logo.png" alt="ZorTech" className="mx-auto mb-6 h-6 w-auto" />
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
            <AlertTriangle size={22} aria-hidden="true" />
          </div>
          <h1 className="mb-3 text-xl font-semibold text-navy-800">Sign in failed</h1>

          <p className="mb-6 text-sm text-muted">{error}</p>

          <Button
            size="lg"
            fullWidth
            onClick={() =>
              navigate("/login", {
                replace: true,
              })
            }
          >
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="flex flex-col items-center gap-4 text-center" role="status">
        <img src="/brand/zortech-icon.svg" alt="" className="h-12 w-12" />
        <Spinner size={28} tone="brand" />
        <p className="text-sm text-muted">Signing you in securely...</p>
      </div>
    </div>
  );
}
