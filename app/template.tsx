"use client";

import { motion } from "motion/react";

// Every page zooms in out of the starfield, like a cabinet screen powering on.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, filter: "blur(8px) brightness(2)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px) brightness(1)", transitionEnd: { filter: "none" } }}
      transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      className="page"
    >
      {children}
    </motion.div>
  );
}
