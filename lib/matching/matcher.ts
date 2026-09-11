import type { MatchResult, MelodyContour, Song } from "@/lib/types";
import { SONGS } from "@/lib/data/songs";
import { bestAlignment, type AlignmentResult } from "./contour";

/**
 * Top-level matching engine.
 *
 * Boundary: keep this file *pure* and free of React / DOM. The page calls
 * `findMatches(contour)` and renders whatever comes back. Swapping in a
 * server-side or ML-based matcher later means re-implementing this file
 * with the same signature.
 *
 * Strategy:
 *   1. For each song in the mock DB, compute the best alignment.
 *   2. Apply a small clarity bonus — if the user's pitch tracking was
 *      crisp, we trust contour matches more.
 *   3. Filter out implausibly low scores (< 0.25) — better to show nothing
 *      than nonsense.
 *   4. Return the top 3.
 *
 * TODO (future): augment with audio fingerprinting on the *original* track
 * for cases where the user is singing along with a backing track. A
 * separate "hum vs. play" classifier could route to either engine.
 */

export interface MatcherOptions {
  /** Cap on returned suggestions (default 3, min 1, max 5). */
  topK?: number;
  /** Threshold below which we don't even bother returning a song. */
  minConfidence?: number;
}

const DEFAULT_OPTS: Required<MatcherOptions> = {
  topK: 3,
  minConfidence: 0.25,
};

export function findMatches(
  contour: MelodyContour,
  opts: MatcherOptions = {},
): MatchResult[] {
  const { topK, minConfidence } = { ...DEFAULT_OPTS, ...opts };

  const scored = SONGS.map((song) => {
    // Rests (null) are dropped before contour comparison — the contour
    // matcher operates on the note sequence, not on rhythm.
    const refNotes = song.melody.filter((n): n is number => n !== null);
    const alignment = bestAlignment(contour.notes, refNotes);
    // Crisp pitch tracking → up to +10% boost; mushy hum → up to -10%.
    const clarityFactor = 0.9 + 0.2 * contour.averageClarity;
    const confidence = Math.min(1, alignment.combinedScore * clarityFactor);
    return { song, alignment, confidence };
  });

  scored.sort((a, b) => b.confidence - a.confidence);

  const filtered = scored.filter((s) => s.confidence >= minConfidence);
  const top = (filtered.length > 0 ? filtered : scored).slice(
    0,
    Math.max(1, Math.min(5, topK)),
  );

  return top.map(({ song, alignment, confidence }) => ({
    song,
    confidence,
    reason: buildReason(song, alignment, confidence),
  }));
}

function buildReason(
  song: Song,
  alignment: AlignmentResult,
  confidence: number,
): string {
  const sectionSv: Record<Song["section"], string> = {
    chorus: "refrängen",
    verse: "versen",
    intro: "intro:t",
    hook: "huvudhooken",
  };
  const where = sectionSv[song.section];
  const dirPct = Math.round(alignment.parsonsScore * 100);
  const covPct = Math.round(alignment.coverage * 100);

  if (confidence >= 0.7) {
    return `Stark matchning mot ${where} — ${dirPct}% av tonriktningarna stämmer över ${covPct}% av melodin.`;
  }
  if (confidence >= 0.45) {
    return `Melodin liknar ${where}, men tonintervallerna avviker något (${dirPct}% riktningsmatch).`;
  }
  if (confidence >= 0.25) {
    return `Möjlig matchning — endast ${covPct}% av melodin har liknande form.`;
  }
  return `Svag matchning mot ${where}. Försök gärna nynna fler toner i en jämn tonart.`;
}
