import type { Metadata } from "next";
import { Chakra_Petch, Press_Start_2P } from "next/font/google";
import Starfield from "@/components/Starfield";
import SoundToggle from "@/components/SoundToggle";
import "./globals.css";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel" });
const body = Chakra_Petch({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Say What You Saw",
  description: "Dictate an explanation, get an animated explainer. Or test your memory in Recall.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pixel.variable} ${body.variable}`}>
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
