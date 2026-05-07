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

  const fetchMe = async () => {
    try {
      const data = await api.get("/auth/me");
      const { subscription: sub, ...userData } = data;
      setProfile(userData as Profile);
      setUser(userData);
      setSubscription(sub ?? null);
    } catch (error) {
      console.error("Fetch me error:", error);
      signOut();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchMe();
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string, role: string) => {
    try {
      const data = await api.post("/auth/login", { email, password, role });
      localStorage.setItem("token", data.token);
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

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role = "recruiter",
  ) => {
    try {
      await api.post("/auth/register", {
        email,
        password,
        full_name: fullName,
        role,
      });
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signOut = () => {
    localStorage.removeItem("token");
    setUser(null);
    setProfile(null);
    setSubscription(null);
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
