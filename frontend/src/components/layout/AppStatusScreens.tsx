import { useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { useAppSelector } from "../../hooks/useAppSelector";
import { useMeQuery } from "../../store/api/authApi";
import { baseApi } from "../../store/api/baseApi";
import { clearCredentials } from "../../store/slices/authSlice";
import { selectServerUnreachable } from "../../store/slices/connectionSlice";

/** Shown while the saved session is being restored. */
export function FullPageLoader({ label = "Loading ZorHire…" }: { label?: string }) {
  return (
    <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <img src="/brand/zortech-icon.svg" alt="" className="w-12 h-12" />
        <div className="w-8 h-8 border-2 border-[#1A4277]/20 border-t-[#F7911E] rounded-full animate-spin" />
        <p className="text-sm text-[#5F6B76]">{label}</p>
      </div>
    </div>
  );
}

/**
 * Shown instead of logging the user out when the API is down while restoring
 * a session. The saved token is kept, so Retry resumes where they were.
 */
export function ServerUnreachableScreen() {
  const dispatch = useAppDispatch();
  const { refetch, isFetching } = useMeQuery();

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-[#E3E7EC] rounded-2xl p-8 text-center shadow-sm">
        <img src="/brand/zortech-logo.png" alt="ZorTech" className="h-8 mx-auto mb-6" />
        <div className="w-12 h-12 rounded-full bg-[#FFF4E6] text-[#B85F00] flex items-center justify-center mx-auto mb-4">
          <WifiOff className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold text-[#262626]">Can't reach ZorHire right now</h1>
        <p className="mt-2 text-sm text-[#5F6B76]">
          The ZorHire server isn't responding. You're still signed in, so nothing is lost. Please try again in a few minutes.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1A4277] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0F2A4F] disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            {isFetching ? "Trying again…" : "Try again"}
          </button>
          <button
            type="button"
            onClick={() => dispatch(clearCredentials())}
            className="rounded-lg px-4 py-2 text-sm text-[#5F6B76] hover:text-[#262626]"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/** Thin banner inside the app while API calls are failing because the server is unreachable. */
export function ServerUnreachableBanner() {
  const dispatch = useAppDispatch();
  const unreachable = useAppSelector(selectServerUnreachable);
  const [retrying, setRetrying] = useState(false);
  if (!unreachable) return null;

  const retry = () => {
    setRetrying(true);
    // Resetting the cache makes every mounted query refetch; the banner clears itself on the next success.
    dispatch(baseApi.util.resetApiState());
    setTimeout(() => setRetrying(false), 1500);
  };

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 bg-[#FFF4E6] border-b border-[#F7911E]/40 px-5 py-2 text-sm text-[#7A3E00]"
    >
      <span className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
        Can't reach the ZorHire server. Lists may be empty and changes may not save until it's back.
      </span>
      <button
        type="button"
        onClick={retry}
        disabled={retrying}
        className="shrink-0 rounded-md border border-[#F7911E]/50 bg-white px-3 py-1 text-xs font-semibold hover:bg-[#FFF9F1] disabled:opacity-60"
      >
        {retrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}
