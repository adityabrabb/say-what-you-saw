import type { Metadata } from "next";
import { Chakra_Petch, Cormorant_Garamond, Press_Start_2P } from "next/font/google";
import Starfield from "@/components/Starfield";
import SoundToggle from "@/components/SoundToggle";
import "./globals.css";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel" });
const serif = Cormorant_Garamond({ weight: ["500", "600", "700"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-serif" });
const body = Chakra_Petch({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Say What You Saw",
  description: "A short film you star in, directed by your voice: witness a scene, say what you saw, then direct your own shot.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pixel.variable} ${body.variable} ${serif.variable}`}>
      <body>
        <Starfield />
        <div className="grid-floor" aria-hidden />
        <div className="crt" aria-hidden />
        <SoundToggle />
        {children}
      </body>
    </html>
  );
}
