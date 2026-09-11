"use client";

import { motion } from "framer-motion";

/**
 * Loading state shown between "recording stopped" and "results ready".
 *
 * Three orbiting dots + an animated label. Looks like serious AI work
 * is happening, even though MVP analysis takes ~200ms.
 */
export function AnalyzingState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center gap-6 py-10"
      role="status"
      aria-live="polite"
    >
      <div className="relative w-24 h-24">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full border border-white/15"
            animate={{
              scale: [0.6, 1.2],
              opacity: [0.8, 0],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              delay: i * 0.6,
              ease: "easeOut",
            }}
          />
        ))}
        <div className="absolute inset-0 grid place-items-center">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-500 to-pink-500 shadow-glow" />
        </div>
      </div>

      <div className="text-center">
        <p className="font-display text-xl tracking-tight text-white">
          Analyserar melodi…
        </p>
        <p className="text-sm text-white/55 mt-1">
          Extraherar tonhöjder och jämför mot låtdatabasen
        </p>
      </div>
    </motion.div>
  );
}
