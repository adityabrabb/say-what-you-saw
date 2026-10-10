import type { Metadata } from "next";
import { Cormorant_Garamond, Courier_Prime, Special_Elite } from "next/font/google";
import SoundToggle from "@/components/SoundToggle";
import "./globals.css";

// Noir evidence-file type: Courier Prime for every label and number, Special Elite for typed notes,
// stamps and statements, Cormorant Garamond for the film's big titles.
const mono = Courier_Prime({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-body" });
const typed = Special_Elite({ weight: "400", subsets: ["latin"], variable: "--font-type" });
const serif = Cormorant_Garamond({ weight: ["500", "600", "700"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-serif" });

const SITE = "https://say-what-you-saw.vercel.app";
const TITLE = "Say What You Saw";
const DESC = "A short film you star in, directed by your voice. Describe a scene from memory, direct yourself on camera, and find out you were never the witness.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, url: SITE, siteName: TITLE, type: "website", images: [{ url: "/og.png", width: 1200, height: 630, alt: "Say What You Saw: the title card" }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/og.png"] },
};

export const viewport = { themeColor: "#0b0b0c" };

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
