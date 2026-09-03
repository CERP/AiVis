import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Aivis — Data Visualization Studio",
  description: "AI-assisted data visualization and analytics studio.",
};

// Runs before hydration to avoid a flash of the wrong theme -- reads the same
// zustand-persist localStorage key theme-store.ts writes to, without needing zustand loaded
// yet. Wrapped in try/catch since localStorage can throw (private browsing, disabled storage).
const THEME_INIT_SCRIPT = `
try {
  var raw = localStorage.getItem("aivis-theme");
  var theme = raw ? JSON.parse(raw).state.theme : "light";
  if (theme === "dark") document.documentElement.classList.add("dark");
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-token)] focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-foreground"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
