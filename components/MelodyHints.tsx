"use client";

import { motion } from "framer-motion";
import { SONGS, getPlayableMelody } from "@/lib/data/songs";
import { PlayButton } from "./PlayButton";

/**
 * "Lyssna på exempel"-sektion shown on the idle screen.
 *
 * Why: most matching failures in real-world use come from users humming
 * an *intervallically different* melody than what we encoded. Letting
 * the user hear the reference first means they can aim at the actual
 * encoded shape, dramatically improving #1-hit rate without touching
 * the matching algorithm.
 *
 * The featured songs below are the ones that self-test best AND are
 * universally recognizable. Order is intentional: Twinkle / Happy
 * Birthday first because they're nursery-rhyme-easy.
 */
const FEATURED_IDS = [
  "twinkle-twinkle",
  "happy-birthday",
  "frere-jacques",
  "ode-to-joy",
  "smoke-on-the-water",
  "seven-nation-army",
];

export function MelodyHints() {
  const featured = FEATURED_IDS
    .map((id) => SONGS.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="w-full max-w-md mx-auto mt-2"
    >
      <p className="text-center text-[11px] uppercase tracking-[0.22em] text-white/40 mb-3">
        Lyssna på exempel innan du nynnar
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {featured.map((song) => {
          const m = getPlayableMelody(song);
          return (
            <PlayButton
              key={song.id}
              notes={m.notes}
              durations={m.durations}
              bpm={m.bpm}
              artist={song.artist}
              songTitle={song.title}
              variant="chip"
              label={song.title}
              title={`${song.title} · ${song.artist}`}
            />
          );
        })}
      </div>
    </motion.div>
  );
}
