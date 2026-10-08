"use client";

import Link from "next/link";
import { sfx } from "@/lib/sound";

export default function PageHeader({ title, subtitle, colour }: { title: string; subtitle: string; colour: "pink" | "cyan" }) {
  return (
    <header className="page-header">
      <Link href="/" className="back" onClick={() => sfx.back()} onMouseEnter={() => sfx.hover()}>
        ◄ HOME
      </Link>
      <h1 className={`page-title ${colour}`}>{title}</h1>
      <p className="page-sub">{subtitle}</p>
    </header>
  );
}
