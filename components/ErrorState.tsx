"use client";

import { motion } from "framer-motion";
import { AlertCircle, RotateCcw } from "lucide-react";
import type { AppError } from "@/lib/types";

interface Props {
  error: AppError;
  onTryAgain: () => void;
}

/**
 * Friendly error surface. Error copy lives in `page.tsx` so all user-facing
 * messages stay in one file (easier to translate / copy-tune).
 */
export function ErrorState({ error, onTryAgain }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass rounded-3xl p-6 sm:p-8 max-w-md w-full text-center"
      role="alert"
    >
      <div className="mx-auto w-14 h-14 grid place-items-center rounded-2xl bg-rose-500/15 text-rose-300 mb-4">
        <AlertCircle className="w-7 h-7" />
      </div>
      <h3 className="font-display text-xl text-white">Något gick inte som tänkt</h3>
      <p className="text-white/70 mt-2">{error.message}</p>

      <button
        onClick={onTryAgain}
        className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-full
                   bg-white/10 hover:bg-white/15 border border-white/10
                   text-white transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        Försök igen
      </button>
    </motion.div>
  );
}
