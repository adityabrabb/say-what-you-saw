import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Say What You Saw",
  description: "Dictate an explanation, get an animated explainer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
