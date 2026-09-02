import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aivis — Editorial Data Visualization Studio",
  description: "AI-native editorial data visualization studio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
