"use client";

import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import type { MatchResult } from "@/lib/types";
import { ResultCard } from "./ResultCard";

interface Props {
  results: MatchResult[];
  onTryAgain: () => void;
}

/**
 * Stacked list of suggestions with a "try again" action at the bottom.
 */
export function ResultsList({ results, onTryAgain }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full flex flex-col gap-4"
      aria-live="polite"
    >
      <div className="text-center mb-2">
        <p className="text-xs uppercase tracking-[0.22em] text-white/45">
          Vi gissar
        </p>
        <h2 className="font-display text-3xl sm:text-4xl text-gradient tracking-tight mt-1">
          {results.length === 1 ? "1 förslag" : `${results.length} förslag`}
        </h2>
      </div>

      {results.map((r, i) => (
        <ResultCard key={r.song.id} result={r} rank={i} />
      ))}

      <button
        onClick={onTryAgain}
        className="mt-4 mx-auto inline-flex items-center gap-2 px-5 py-3 rounded-full
                   bg-white/5 hover:bg-white/10 border border-white/10
                   text-white/85 hover:text-white transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        Nynna igen
      </button>
    </motion.section>
  );
}
