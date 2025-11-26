import { create } from "zustand";
import { authService, AuthProfile } from "../services/authService";
import { setApiAuthToken } from "../services/apiClient";

type AuthStatus = "unknown" | "authenticated" | "anonymous" | "loading";

interface AuthState {
  status: AuthStatus;
  profile?: AuthProfile;
  accessToken?: string;
  initialize: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => void;
}

const TOKEN_KEY = "luvtalk.accessToken";

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initCodeClient: (options: {
            client_id: string;
            callback: (response: { code: string }) => void;
            scope?: string;
            ux_mode?: "popup" | "redirect";
          }) => {
            requestCode: () => void;
          };
        };
      };
    };
  }
}

async function ensureGoogleClient(): Promise<void> {
  if (window.google?.accounts?.oauth2) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google SDK"));
    document.head.appendChild(script);
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "unknown",
  profile: undefined,
  accessToken: undefined,
  initialize: async () => {
    const token = window.localStorage.getItem(TOKEN_KEY) ?? undefined;
    if (!token) {
      set({ status: "anonymous", profile: undefined, accessToken: undefined });
      setApiAuthToken(undefined);
      return;
    }
    try {
      setApiAuthToken(token);
      const profile = await authService.fetchProfile();
      set({
        status: "authenticated",
        profile,
        accessToken: token,
      });
    } catch {
      window.localStorage.removeItem(TOKEN_KEY);
      setApiAuthToken(undefined);
      set({ status: "anonymous", profile: undefined, accessToken: undefined });
    }
  },
  login: async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri =
      import.meta.env.VITE_GOOGLE_REDIRECT_URI || window.location.origin;
    if (!clientId) {
      throw new Error("未配置 VITE_GOOGLE_CLIENT_ID");
    }
    await ensureGoogleClient();
    set({ status: "loading" });
    const code = await new Promise<string>((resolve, reject) => {
      const client = window.google?.accounts?.oauth2?.initCodeClient({
        client_id: clientId,
        scope: "profile email openid",
        ux_mode: "popup",
        callback: (response) => {
          if (response.code) {
            resolve(response.code);
          } else {
            reject(new Error("未获取到授权 code"));
          }
        },
      });
      if (!client) {
        reject(new Error("Google 登录组件不可用"));
        return;
      }
      client.requestCode();
    });

    const result = await authService.loginWithGoogle({
      code,
      redirectUri,
    });
    setApiAuthToken(result.tokens.accessToken);
    window.localStorage.setItem(TOKEN_KEY, result.tokens.accessToken);
    set({
      status: "authenticated",
      profile: result.profile,
      accessToken: result.tokens.accessToken,
    });
  },
  logout: () => {
    window.localStorage.removeItem(TOKEN_KEY);
    setApiAuthToken(undefined);
    set({
      status: "anonymous",
      profile: undefined,
      accessToken: undefined,
    });
  },
}));

