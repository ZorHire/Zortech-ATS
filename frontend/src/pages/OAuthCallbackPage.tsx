import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { setCredentials, setSessionStatus } from "../store/slices/authSlice";
import type { AuthUser } from "../store/slices/authSlice";
import { setSubscription } from "../store/slices/subscriptionSlice";

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
      <div className="min-h-screen bg-[#f7efe4] flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-xl font-bold text-[#3a230f] mb-3">
            Sign in failed
          </h1>

          <p className="text-sm text-[#7d6651] mb-6">{error}</p>

          <button
            onClick={() =>
              navigate("/login", {
                replace: true,
              })
            }
            className="w-full bg-[#b67031] text-white py-3 rounded-xl font-bold"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7efe4] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#b67031]/30 border-t-[#b67031] rounded-full animate-spin mx-auto mb-4" />

        <p className="text-sm text-[#7d6651]">Signing you in securely...</p>
      </div>
    </div>
  );
}
