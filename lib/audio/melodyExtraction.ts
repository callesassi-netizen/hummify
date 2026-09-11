import type { MelodyContour, PitchFrame } from "@/lib/types";

/**
 * Turn raw pitch frames into a clean melody contour the matcher can compare.
 *
 * Pipeline:
 *  1. Drop unvoiced frames (no detected pitch).
 *  2. Median-smooth the MIDI sequence to kill octave-jump glitches.
 *  3. Run-length compress consecutive identical notes (rep-notes count as
 *     one melodic event — the user can hold a note as long as they want).
 *  4. Derive the Parsons code and the interval sequence.
 *
 * The matcher in `lib/matching/matcher.ts` only uses `parsons` and
 * `intervals` — `notes` is kept for debugging / future use.
 */

/** Minimum voiced frames required to attempt a match. */
export const MIN_VOICED_FRAMES = 30;

/** If the smoothed sequence has fewer notes than this, we won't bother. */
export const MIN_NOTES = 4;

/**
 * Window size for median smoothing (odd number).
 *
 * Bumped from 5 → 15 after observing real recordings: human voice drifts
 * naturally (e.g. 96Hz ↔ 100Hz when holding G2), which crosses MIDI
 * rounding boundaries and produces spurious note transitions during a
 * single sustained note. A window of 15 frames (~70–250ms depending on
 * the device's rAF rate) is wide enough to absorb that drift but still
 * narrower than a typical hummed note (~300ms+).
 */
const SMOOTHING_WINDOW = 15;

/**
 * After median smoothing, require any new note value to persist for at
 * least this many consecutive frames before it counts as a real note
 * transition. Shorter excursions are snapped back to the previous stable
 * value.
 *
 * Why: extended pitch drift (20–30 frames where the voice wanders a
 * semitone) survives median smoothing but is *not* a melodic transition.
 * This sticky filter is the difference between "we extracted 41 notes
 * from 8 seconds of humming" and "we extracted 8 distinct notes".
 */
const MIN_NOTE_FRAMES = 12;

/**
 * Median filter — robust to spike errors from octave-doubling.
 */
function medianSmooth(values: number[], window: number): number[] {
  if (values.length === 0) return [];
  const half = Math.floor(window / 2);
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(values.length, i + half + 1);
    const slice = values.slice(lo, hi).sort((a, b) => a - b);
    out.push(slice[Math.floor(slice.length / 2)]);
  }
  return out;
}

/** Collapse runs of identical notes into a single note. */
function runLengthCompress(notes: number[]): number[] {
  const out: number[] = [];
  for (const n of notes) {
    if (out[out.length - 1] !== n) out.push(n);
  }
  return out;
}

/**
 * Sticky-snap filter: a new value is adopted only if it persists for at
 * least `minRun` consecutive frames. Otherwise the previous stable value
 * is carried forward.
 *
 * Operates on the post-smoothing sequence. Removes "drift episodes" that
 * are too long for the median filter to swallow but too short to be real
 * note transitions.
 */
function stickyFilter(values: number[], minRun: number): number[] {
  if (values.length === 0) return [];
  const out = new Array<number>(values.length);
  let stable = values[0];
  let i = 0;
  while (i < values.length) {
    // Measure the current run.
    let j = i;
    while (j < values.length && values[j] === values[i]) j++;
    const runLength = j - i;

    // Adopt the new value only if it's already stable or persists long
    // enough. Otherwise stamp the run with the previous stable value.
    if (values[i] === stable || runLength >= minRun) {
      stable = values[i];
    }
    for (let k = i; k < j; k++) out[k] = stable;
    i = j;
  }
  return out;
}

/** Direction-only code: 'u' up, 'd' down, 'r' repeat. */
export function toParsons(notes: number[]): string {
  if (notes.length < 2) return "";
  let s = "";
  for (let i = 1; i < notes.length; i++) {
    const d = notes[i] - notes[i - 1];
    s += d > 0 ? "u" : d < 0 ? "d" : "r";
  }
  return s;
}

/** Semitone deltas between consecutive notes. */
export function toIntervals(notes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < notes.length; i++) out.push(notes[i] - notes[i - 1]);
  return out;
}

/**
 * Extract a clean contour from raw frames.
 * Returns `null` if the recording was too short or too unvoiced to be useful.
 */
export function extractMelody(frames: PitchFrame[]): MelodyContour | null {
  const voiced = frames.filter(
    (f): f is PitchFrame & { midi: number } => f.midi !== null,
  );

  if (voiced.length < MIN_VOICED_FRAMES) return null;

  const rawMidi = voiced.map((f) => f.midi);
  const smoothed = medianSmooth(rawMidi, SMOOTHING_WINDOW);
  // Sticky-snap eliminates 20–30 frame drift episodes that survived the
  // median filter. Pipeline order matters: median first (kills spikes),
  // then sticky (kills drifts), then RLC (collapses to note events).
  const settled = stickyFilter(smoothed, MIN_NOTE_FRAMES);
  const compressed = runLengthCompress(settled);

  if (compressed.length < MIN_NOTES) return null;

  const averageClarity =
    voiced.reduce((acc, f) => acc + f.clarity, 0) / voiced.length;
  const voicedDuration =
    voiced.length > 1
      ? voiced[voiced.length - 1].time - voiced[0].time
      : 0;

  return {
    notes: compressed,
    parsons: toParsons(compressed),
    intervals: toIntervals(compressed),
    averageClarity,
    voicedDuration,
    totalFrames: frames.length,
  };
}
