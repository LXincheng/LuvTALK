import { apiClient } from "./apiClient";

export interface AuthProfile {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

export interface AuthResponse {
  tokens: {
    accessToken: string;
  };
  profile: AuthProfile;
}

export const authService = {
  loginWithGoogle: (payload: { code: string; redirectUri: string }) =>
    apiClient.post<AuthResponse, { code: string; redirectUri: string }>(
      "/auth/google",
      payload,
    ),
  fetchProfile: () => apiClient.get<AuthProfile>("/auth/me"),
};

