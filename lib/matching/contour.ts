/**
 * Low-level contour comparison utilities used by the matcher.
 *
 * Scoring philosophy (v3):
 *
 * 1. **Coverage = matchedLength / min(|U|, |R|)** — gives substring matches
 *    full credit. A short hum that perfectly aligns with part of a long
 *    chorus is a strong signal, not a weak one.
 *
 * 2. **Absolute length credit** — short windows (< 6 intervals) are
 *    multiplicatively discounted so 2- and 3-note coincidences can't
 *    masquerade as full melody matches.
 *
 * 3. **Chance-corrected Parsons** — random sequences hit ~33% direction
 *    agreement by chance (3 directions: u/d/r). We subtract that baseline
 *    so only *above-chance* agreement contributes to the score.
 *
 * 4. **Intervals weighted heavier than directions** — direction patterns
 *    repeat across many songs ("rising-falling-rising" is generic);
 *    actual semitone deltas are far more discriminative.
 *
 * 5. **2D sliding** — both sequences slide over each other, so we absorb
 *    warm-up notes at the start of a hum and refs that don't begin with
 *    the catchiest phrase.
 *
 * TODO (future): banded DTW, so users who skip or insert a single note
 * mid-phrase still align tightly.
 */

import { toParsons } from "@/lib/audio/melodyExtraction";

export interface AlignmentResult {
  userOffset: number;
  refOffset: number;
  matchedLength: number;
  /** Raw fraction of Parsons agreement (0..1). */
  parsonsScore: number;
  /** Interval similarity 0..1 (1 = identical intervals). */
  intervalScore: number;
  /** Saturated fraction of the *shorter* sequence that was matched. */
  coverage: number;
  /** Final 0..1 combined score. */
  combinedScore: number;
}

const EMPTY: AlignmentResult = {
  userOffset: 0,
  refOffset: 0,
  matchedLength: 0,
  parsonsScore: 0,
  intervalScore: 0,
  coverage: 0,
  combinedScore: 0,
};

/** Below 4 intervals we won't even attempt scoring — too noisy. */
const ABSOLUTE_FLOOR = 4;
/** Windows of this length (or longer) get full length-credit. */
const FULL_CREDIT_LENGTH = 6;
/** Parsons agreement expected from a random sequence (3 directions). */
const PARSONS_CHANCE_LEVEL = 1 / 3;

function diffSeq(notes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < notes.length; i++) out.push(notes[i] - notes[i - 1]);
  return out;
}

export function bestAlignment(
  userNotes: number[],
  refNotes: number[],
): AlignmentResult {
  const userP = toParsons(userNotes);
  const refP  = toParsons(refNotes);
  const userI = diffSeq(userNotes);
  const refI  = diffSeq(refNotes);

  if (userI.length === 0 || refI.length === 0) return EMPTY;

  // Floor for the matched window. Never less than ABSOLUTE_FLOOR, but if
  // one of the sequences is tiny we accept that as the natural ceiling.
  const shorter = Math.min(userI.length, refI.length);
  const effectiveMin = Math.min(ABSOLUTE_FLOOR, shorter);

  let best = EMPTY;

  for (let uOff = 0; uOff <= userI.length - effectiveMin; uOff++) {
    for (let rOff = 0; rOff <= refI.length - effectiveMin; rOff++) {
      const len = Math.min(userI.length - uOff, refI.length - rOff);
      if (len < effectiveMin) continue;

      let pMatch = 0;
      let iDiffSum = 0;
      for (let i = 0; i < len; i++) {
        if (userP[uOff + i] === refP[rOff + i]) pMatch++;
        iDiffSum += Math.abs(userI[uOff + i] - refI[rOff + i]);
      }
      const pScore = pMatch / len;
      const meanIDiff = iDiffSum / len;

      // Chance-correct the Parsons score. 33% agreement is random noise,
      // 100% is perfect. Linearly remap to 0..1 above chance.
      const pAboveChance = Math.max(
        0,
        (pScore - PARSONS_CHANCE_LEVEL) / (1 - PARSONS_CHANCE_LEVEL),
      );

      // Interval similarity. Mean abs diff of 0 → 1.0, 2 semitones → 0.57,
      // 4 → 0.32, 6 → 0.18. Humans routinely compress intervals when
      // humming (a major third becomes a whole step, etc.), so we keep
      // the falloff fairly forgiving — random noise still scores ~0.15.
      const iScore = Math.exp(-meanIDiff / 3.5);

      // Coverage of the *shorter* sequence — substring-friendly.
      const coverage = len / shorter;

      // Multiplicative penalty for very short absolute windows.
      // <ABSOLUTE_FLOOR is already excluded by the loop guard; this just
      // smoothly ramps short matches from 0.55 up to 1.0 at FULL_CREDIT_LENGTH.
      const lengthCredit = Math.min(1, len / FULL_CREDIT_LENGTH);
      const lengthFactor = 0.55 + 0.45 * lengthCredit;

      // Final blend. Intervals get slightly more weight than directions
      // (they're harder to fake by chance). Coverage participates lightly
      // additively *and* as the overall scaler.
      const blend =
        0.45 * pAboveChance + 0.50 * iScore + 0.05 * coverage;
      const combined = blend * coverage * lengthFactor;

      if (combined > best.combinedScore) {
        best = {
          userOffset: uOff,
          refOffset: rOff,
          matchedLength: len,
          parsonsScore: pScore,
          intervalScore: iScore,
          coverage,
          combinedScore: combined,
        };
      }
    }
  }

  return best;
}
