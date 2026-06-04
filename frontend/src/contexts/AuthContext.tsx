import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Profile } from "../types";
import api from "../lib/api";

export interface SubscriptionState {
  active: boolean;
  isPlatformOwner?: boolean;
  reason?: string;
}

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  subscription: SubscriptionState | null;
  loading: boolean;
  signIn: (email: string, password: string, role: string) => Promise<{ error: any | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role?: string,
  ) => Promise<{ error: any | null }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = () => {
    setUser(null);
    setProfile(null);
    setSubscription(null);
  };

  const fetchMe = async () => {
    // No token in storage → no session to restore; skip the API call entirely
    if (!localStorage.getItem("jwt")) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get("/auth/me");
      const { subscription: sub, ...userData } = data;
      setProfile(userData as Profile);
      setUser(userData);
      setSubscription(sub ?? null);
    } catch (error: any) {
      // 401 means token expired — expected, not an error worth logging.
      if (error?.status !== 401) console.error("Fetch me error:", error);
      localStorage.removeItem("jwt");
      clearSession();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();

    // Handle mid-session 401s from any API call (e.g. token expiry while navigating).
    // api.ts dispatches this event instead of doing window.location.href to avoid
    // hard page reloads that would re-trigger fetchMe and create an infinite loop.
    const onUnauthorized = () => clearSession();
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string, role: string) => {
    try {
      const data = await api.post("/auth/login", { email, password, role });
      if (data.token) localStorage.setItem("jwt", data.token);
      setProfile(data.user);
      setUser(data.user);
      setSubscription(data.subscription ?? null);
      return { error: null };
    } catch (error: any) {
      console.error("Sign in error:", error);
      const errorMessage =
        error?.message || "Login failed. Please check your credentials.";
      return { error: { message: errorMessage } };
    }
  };

  // Self-registration is disabled; companies are onboarded by ZorTech admins
  const signUp = async (
    _email: string,
    _password: string,
    _fullName: string,
    _role = "recruiter",
  ) => {
    return { error: { message: "Self-registration is not available. Contact your administrator." } };
  };

  const signOut = () => {
    localStorage.removeItem("jwt");
    api.post("/auth/logout", {}).catch(() => {});
    clearSession();
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, subscription, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
