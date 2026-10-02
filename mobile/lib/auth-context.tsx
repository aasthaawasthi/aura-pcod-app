import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi, getToken, setToken, clearToken, profileApi, Profile } from "./api";

type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  profile: Profile | null;
  requestOtp: (phone: string) => Promise<{ devOtp?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
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

  // Sends (or resends) an OTP to a phone number. Doesn't touch auth state -
  // the phone isn't logged in until the code is verified.
  const requestOtp = async (phone: string) => {
    const data = await authApi.requestOtp(phone);
    return { devOtp: data.devOtp };
  };

  // Verifying the OTP both logs in an existing account and registers a new
  // one - there's no separate sign-up step for phone+OTP.
  const verifyOtp = async (phone: string, otp: string) => {
    const data = await authApi.verifyOtp(phone, otp);
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
      value={{ isLoading, isAuthenticated, profile, requestOtp, verifyOtp, signOut, refreshProfile }}
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
