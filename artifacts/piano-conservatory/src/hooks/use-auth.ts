import { useState, useEffect, useCallback, createContext, useContext } from "react";

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  avatarIndex: number;
  customAvatarUrl?: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string, avatarIndex: number) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (patch: { displayName?: string; avatarIndex?: number; customAvatarUrl?: string | null }) => Promise<void>;
}

export type AuthContext = AuthState & AuthActions;

export const AuthCtx = createContext<AuthContext>({
  user: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  refresh: async () => {},
  updateProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthCtx);
}

function syncProfileToStorage(user: AuthUser) {
  localStorage.setItem("piano-conservatory-profile", JSON.stringify({
    displayName: user.displayName,
    avatarIndex: user.avatarIndex,
    customAvatarUrl: user.customAvatarUrl,
  }));
}

export function useAuthState(): AuthContext {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setState({ user: data.user, loading: false });
        syncProfileToStorage(data.user);
      } else {
        setState({ user: null, loading: false });
      }
    } catch {
      setState({ user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    setState({ user: data.user, loading: false });
    syncProfileToStorage(data.user);
  }, []);

  const signup = useCallback(async (
    email: string,
    password: string,
    displayName: string,
    avatarIndex: number
  ) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, displayName, avatarIndex }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Signup failed");
    setState({ user: data.user, loading: false });
    syncProfileToStorage(data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setState({ user: null, loading: false });
  }, []);

  const updateProfile = useCallback(async (patch: { displayName?: string; avatarIndex?: number; customAvatarUrl?: string | null }) => {
    const res = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update profile");
    setState(prev => ({ ...prev, user: data.user }));
    syncProfileToStorage(data.user);
  }, []);

  return { ...state, login, signup, logout, refresh, updateProfile };
}
