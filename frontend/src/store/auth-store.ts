import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
}

/**
 * Token lives in localStorage (via zustand persist) for API calls, and is mirrored into a
 * plain (non-httpOnly) cookie so middleware.ts can gate routes without a server round-trip.
 * This only proves a token is *present*, not that it's valid/unexpired -- real authorization
 * still happens server-side on every API call. Upgrading to an httpOnly session cookie set by
 * the backend is a reasonable follow-up once this needs to be hardened past MVP.
 */
const AUTH_COOKIE_NAME = "aivis_auth_present";

function syncAuthCookie(token: string | null) {
  if (typeof document === "undefined") return;
  if (token) {
    document.cookie = `${AUTH_COOKIE_NAME}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  } else {
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => {
        syncAuthCookie(token);
        set({ token });
      },
      logout: () => {
        syncAuthCookie(null);
        set({ token: null });
      },
    }),
    { name: "aivis-auth" }
  )
);
