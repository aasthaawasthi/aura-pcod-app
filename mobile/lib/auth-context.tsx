import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi, getToken, setToken, clearToken, profileApi, Profile } from "./api";

type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  profile: Profile | null;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await profileApi.get();
      setProfile(p);
    } catch {
      // ignore - handled by screens that need it
    }
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          await authApi.me();
          setIsAuthenticated(true);
          await refreshProfile();
        } catch {
          await clearToken();
          setIsAuthenticated(false);
        }
      }
      setIsLoading(false);
    })();
  }, [refreshProfile]);

  const signUp = async (email: string, password: string, name?: string) => {
    const data = await authApi.register(email, password, name);
    await setToken(data.token);
    setIsAuthenticated(true);
    await refreshProfile();
  };

  const signIn = async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    await setToken(data.token);
    setIsAuthenticated(true);
    await refreshProfile();
  };

  const signOut = async () => {
    await clearToken();
    setIsAuthenticated(false);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ isLoading, isAuthenticated, profile, signUp, signIn, signOut, refreshProfile }}
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
