import { apiClient } from "@/lib/api/client";

export interface ThemeTokens {
  name: string;
  description: string;
  palette_type: "categorical" | "sequential" | "diverging";
  background: string;
  foreground: string;
  grid: string;
  border: string;
  categorical_colors: string[];
  sequential_range: [string, string];
  diverging_range: [string, string, string];
  positive_color: string;
  negative_color: string;
  headline_font: string;
  body_font: string;
}

export interface ThemeRecommendationsResponse {
  top: ThemeTokens[];
  rest: ThemeTokens[];
}

export function listThemes() {
  return apiClient.get<ThemeTokens[]>("/api/themes");
}

export function getThemeRecommendations() {
  return apiClient.get<ThemeRecommendationsResponse>("/api/themes/recommendations");
}
