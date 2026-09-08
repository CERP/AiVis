import { apiClient } from "@/lib/api/client";

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  email: string;
  full_name: string | null;
}

export function signup(payload: {
  email: string;
  password: string;
  full_name?: string;
  organization_name: string;
}) {
  return apiClient.post<TokenResponse>("/api/auth/signup", payload);
}

export function login(payload: { email: string; password: string }) {
  return apiClient.post<TokenResponse>("/api/auth/login", payload);
}

export function me() {
  return apiClient.get<UserResponse>("/api/auth/me");
}

export function updateProfile(full_name: string) {
  return apiClient.patch<UserResponse>("/api/auth/me", { full_name });
}

export function changePassword(payload: { current_password: string; new_password: string }) {
  return apiClient.post<void>("/api/auth/password", payload);
}
