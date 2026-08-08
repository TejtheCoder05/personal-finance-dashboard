"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  ApiError,
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from "@/lib/api";
import type { AuthUser } from "@/types/finance";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  sessionError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function safeAuthMessage(error: unknown, action: "login" | "register" | "logout") {
  if (error instanceof ApiError) {
    if (action === "register" && error.status === 409) {
      return "An account with this email already exists.";
    }
    if (action === "login" && error.status === 401) {
      return "Incorrect email or password.";
    }
  }
  if (action === "logout") {
    return "Could not log out. Please try again.";
  }
  return action === "register"
    ? "Could not create your account. Check your details and try again."
    : "Could not log in. Please try again.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const currentUser = await getCurrentUser();
        if (active) {
          setUser(currentUser);
        }
      } catch (error) {
        if (active && (!(error instanceof ApiError) || error.status !== 401)) {
          setSessionError("Account status could not be loaded.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      sessionError,
      login: async (email, password) => {
        try {
          await loginUser(email, password);
          setUser(await getCurrentUser());
          setSessionError(null);
        } catch (error) {
          throw new Error(safeAuthMessage(error, "login"));
        }
      },
      register: async (email, password) => {
        try {
          await registerUser(email, password);
          await loginUser(email, password);
          setUser(await getCurrentUser());
          setSessionError(null);
        } catch (error) {
          throw new Error(safeAuthMessage(error, "register"));
        }
      },
      logout: async () => {
        try {
          await logoutUser();
          setUser(null);
          setSessionError(null);
        } catch (error) {
          throw new Error(safeAuthMessage(error, "logout"));
        }
      },
    }),
    [loading, sessionError, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
