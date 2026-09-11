/**
 * Core domain types for Hummify.
 *
 * Kept deliberately small and framework-agnostic so the matching engine
 * can later be moved to a server / edge function / external API without
 * pulling React along with it.
 */

/** Streaming links — all optional, only shown if present. */
export interface StreamingLinks {
  spotify?: string;
  appleMusic?: string;
  youtube?: string;
}

/**
 * A song in our reference database.
 *
 * `melody` is the canonical hook (typically the chorus) encoded as MIDI
 * note numbers. Rests are encoded as `null` so we can preserve rhythmic
 * shape without polluting pitch contour math.
 *
 * `durations` runs parallel to `melody` and gives the length of each
 * note in *beats* (1 = quarter, 0.5 = eighth, 2 = half, etc). Optional —
 * if missing, the player falls back to all quarter notes.
 *
 * `bpm` controls playback tempo. Default 100 BPM if omitted.
 */
export interface Song {
  id: string;
  title: string;
  artist: string;
  /** Which part of the song this melody represents — shown to the user. */
  section: "chorus" | "verse" | "intro" | "hook";
  /** Canonical melody as MIDI notes. `null` = rest. */
  melody: (number | null)[];
  /** Per-note duration in beats. Same length as `melody`. */
  durations?: number[];
  /** Playback tempo in beats per minute. */
  bpm?: number;
  links?: StreamingLinks;
}

/**
 * A single pitch sample extracted from the user's recording.
 * `null` frequency = silence / unvoiced frame.
 */
export interface PitchFrame {
  /** Time in seconds since recording start. */
  time: number;
  /** Detected frequency in Hz, or null if no clear pitch. */
  frequency: number | null;
  /** Clarity / confidence from pitch detector (0..1). */
  clarity: number;
  /** MIDI note number (rounded), or null if no pitch. */
  midi: number | null;
}

/**
 * Result of analyzing a recording — the melody contour we feed the matcher.
 */
export interface MelodyContour {
  /** Pitched (voiced) frames only, after smoothing. */
  notes: number[];                 // MIDI notes
  /** Parsons-style direction sequence: 'u' up, 'd' down, 'r' repeat. */
  parsons: string;
  /** Interval sequence in semitones between consecutive notes. */
  intervals: number[];
  /** Average clarity across voiced frames (0..1). */
  averageClarity: number;
  /** Total voiced duration in seconds. */
  voicedDuration: number;
  /** Raw frame count for debugging. */
  totalFrames: number;
}

/** A single suggestion shown to the user. */
export interface MatchResult {
  song: Song;
  /** 0..1 — higher is better. */
  confidence: number;
  /** Short human-readable motivation in Swedish. */
  reason: string;
}

/** Phases of the main screen state machine. */
export type AppPhase =
  | "idle"
  | "recording"
  | "analyzing"
  | "results"
  | "error";

/** Error categories surfaced to the UI. */
export type AppErrorKind =
  | "mic-denied"
  | "too-short"
  | "no-pitch"
  | "analysis-failed"
  | "unsupported";

export interface AppError {
  kind: AppErrorKind;
  message: string;
}
