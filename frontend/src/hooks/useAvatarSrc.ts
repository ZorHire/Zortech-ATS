import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/v1";

// One fetch per stored avatar path for the whole session.
const cache = new Map<string, Promise<string | null>>();

function load(userId: string, avatarUrl: string): Promise<string | null> {
  const key = `${userId}|${avatarUrl}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      try {
        const token = localStorage.getItem("jwt");
        const resp = await fetch(`${API}/profile/avatar/${encodeURIComponent(userId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!resp.ok) return null;
        return URL.createObjectURL(await resp.blob());
      } catch {
        return null;
      }
    })();
    cache.set(key, p);
    // Let a failed load be retried later (e.g. after the server comes back).
    p.then((v) => v === null && cache.delete(key));
  }
  return p;
}

/**
 * Image src for a user's avatar. Uploaded avatars ("/uploads/...") are only
 * served through the authenticated, tenant-checked API, so a plain <img src>
 * can't load them: fetch with the token and use a blob URL instead.
 * Returns null while loading or when there is no avatar (show initials).
 */
export function useAvatarSrc(userId: string | undefined, avatarUrl: string | null | undefined): string | null {
  const isExternal = !!avatarUrl && /^(https?:|data:|blob:)/.test(avatarUrl);
  const [src, setSrc] = useState<string | null>(isExternal ? avatarUrl! : null);

  useEffect(() => {
    if (!avatarUrl || !userId) {
      setSrc(null);
      return;
    }
    if (isExternal) {
      setSrc(avatarUrl);
      return;
    }
    let alive = true;
    load(userId, avatarUrl).then((v) => alive && setSrc(v));
    return () => {
      alive = false;
    };
  }, [userId, avatarUrl, isExternal]);

  return src;
}
