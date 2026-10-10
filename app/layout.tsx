import type { Metadata } from "next";
import { Cormorant_Garamond, Courier_Prime, Special_Elite } from "next/font/google";
import SoundToggle from "@/components/SoundToggle";
import "./globals.css";

// Noir evidence-file type: Courier Prime for every label and number, Special Elite for typed notes,
// stamps and statements, Cormorant Garamond for the film's big titles.
const mono = Courier_Prime({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-body" });
const typed = Special_Elite({ weight: "400", subsets: ["latin"], variable: "--font-type" });
const serif = Cormorant_Garamond({ weight: ["500", "600", "700"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Say What You Saw",
  description: "A short film you star in, directed by your voice: witness a scene, say what you saw, then direct your own shot.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} ${typed.variable} ${serif.variable}`}>
      <body>
        <SoundToggle />
        {children}
      </body>
    </html>
  );
}
