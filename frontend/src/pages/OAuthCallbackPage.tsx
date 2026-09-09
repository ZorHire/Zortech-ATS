import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { setCredentials, setSessionStatus } from "../store/slices/authSlice";
import type { AuthUser } from "../store/slices/authSlice";
import { setSubscription } from "../store/slices/subscriptionSlice";

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const oauthError = searchParams.get("oauth_error");

    if (oauthError) {
      setError(oauthError);
      return;
    }

    if (!code) {
      setError("OAuth login failed. Please try again.");
      return;
    }

    const exchange = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || "";

        const response = await fetch(`${apiBase}/v1/auth/oauth/exchange`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "OAuth login failed");
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
        setError(err?.message || "OAuth login failed. Please try again.");
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
