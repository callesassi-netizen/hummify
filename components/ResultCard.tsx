"use client";

import { motion } from "framer-motion";
import { ExternalLink, Music2 } from "lucide-react";
import type { MatchResult } from "@/lib/types";
import clsx from "clsx";
import { PlayButton } from "./PlayButton";
import { getPlayableMelody } from "@/lib/data/songs";

interface Props {
  result: MatchResult;
  rank: number;
}

const PROVIDER_LABEL = {
  spotify: "Spotify",
  appleMusic: "Apple Music",
  youtube: "YouTube",
} as const;

/**
 * Single suggestion card.
 *
 * Visual hierarchy:
 *   - Rank badge top-left (#1, #2, #3) — bigger and brighter for #1.
 *   - Title (display font) + artist (muted).
 *   - Confidence pill on the right, color-coded by score.
 *   - Reason line beneath the title.
 *   - Streaming link buttons at the bottom — only rendered if links exist.
 */
export function ResultCard({ result, rank }: Props) {
  const { song, confidence, reason } = result;
  const pct = Math.round(confidence * 100);

  const tier =
    confidence >= 0.75 ? "strong" : confidence >= 0.5 ? "medium" : "weak";

  return (
    <motion.article
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0,  scale: 1   }}
      transition={{ duration: 0.45, delay: rank * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
      className={clsx(
        "glass rounded-3xl p-5 sm:p-6 shadow-card",
        "relative overflow-hidden",
        rank === 0 && "ring-1 ring-fuchsia-400/30",
      )}
    >
      {/* Decorative glow for the top result */}
      {rank === 0 && (
        <div
          aria-hidden
          className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl bg-gradient-to-br from-fuchsia-500/30 to-violet-500/20 pointer-events-none"
        />
      )}

      <div className="flex items-start justify-between gap-4 relative">
        <div className="flex items-start gap-4 min-w-0">
          <div
            className={clsx(
              "shrink-0 grid place-items-center rounded-2xl",
              "w-12 h-12 sm:w-14 sm:h-14",
              rank === 0
                ? "bg-gradient-to-br from-fuchsia-500 to-violet-500 text-white"
                : "bg-white/5 text-white/80",
            )}
          >
            <Music2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-white/40 mb-1">
              #{rank + 1} förslag
            </p>
            <h3 className="font-display text-xl sm:text-2xl text-white tracking-tight truncate">
              {song.title}
            </h3>
            <p className="text-white/60 truncate">{song.artist}</p>
          </div>
        </div>

        <ConfidencePill pct={pct} tier={tier} />
      </div>

      <p className="mt-4 text-sm sm:text-[15px] text-white/75 leading-relaxed">
        {reason}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {(() => {
          const m = getPlayableMelody(song);
          return (
            <PlayButton
              notes={m.notes}
              durations={m.durations}
              bpm={m.bpm}
              artist={song.artist}
              songTitle={song.title}
              label="Lyssna på låten"
              title={`Spela upp ${song.title} av ${song.artist}`}
            />
          );
        })()}
        {song.links &&
          (["spotify", "appleMusic", "youtube"] as const).map((provider) => {
            const url = song.links?.[provider];
            if (!url) return null;
            return (
              <a
                key={provider}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx(
                  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full",
                  "text-sm text-white/85 hover:text-white",
                  "bg-white/[0.04] hover:bg-white/10 border border-white/10",
                  "transition-colors",
                )}
              >
                {PROVIDER_LABEL[provider]}
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            );
          })}
      </div>
    </motion.article>
  );
}

function ConfidencePill({
  pct,
  tier,
}: {
  pct: number;
  tier: "strong" | "medium" | "weak";
}) {
  const style = {
    strong: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30",
    medium: "bg-amber-400/15 text-amber-300 ring-amber-400/30",
    weak:   "bg-white/5 text-white/60 ring-white/10",
  }[tier];

  return (
    <div
      className={clsx(
        "shrink-0 px-3 py-1.5 rounded-full text-sm font-medium tabular-nums",
        "ring-1",
        style,
      )}
      aria-label={`Matchningsgrad ${pct} procent`}
    >
      {pct}%
    </div>
  );
}
