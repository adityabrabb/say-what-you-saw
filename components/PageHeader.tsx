"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { sfx } from "@/lib/sound";

export default function PageHeader({ title, subtitle, colour }: { title: string; subtitle: string; colour: "pink" | "cyan" }) {
  return (
    <header className="page-header">
      <Link href="/" className="back" onClick={() => sfx.back()} onMouseEnter={() => sfx.hover()}>
        ◄ HOME
      </Link>
      <motion.h1
        className={`page-title ${colour}`}
        initial={{ opacity: 0, y: -20, letterSpacing: "0.4em" }}
        animate={{ opacity: 1, y: 0, letterSpacing: "0.08em" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {title}
      </motion.h1>
      <p className="page-sub">{subtitle}</p>
    </header>
  );
}
