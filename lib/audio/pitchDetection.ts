import { PitchDetector } from "pitchy";

/**
 * Pitch detection wrapper around the `pitchy` library (McLeod Pitch Method).
 *
 * MPM is a strong default for monophonic vocal humming:
 *  - more robust than basic autocorrelation against octave errors,
 *  - faster than FFT-based approaches at small windows,
 *  - returns a clarity value we can threshold to ignore unvoiced frames.
 *
 * TODO (future): swap in a CREPE/SPICE WASM model for higher accuracy on
 * noisy or breathy recordings. Keep this module's signature stable so the
 * call sites in melodyExtraction.ts don't need to change.
 */

/** Window size in samples. 2048 ≈ 42ms at 48kHz — good speech/voice tradeoff. */
export const PITCH_WINDOW = 2048;

/** Below this clarity we treat a frame as unvoiced. */
export const CLARITY_THRESHOLD = 0.85;

/** Voice-relevant frequency band (Hz). Filters out subharmonic glitches. */
export const MIN_HZ = 70;   // ≈ low male hum
export const MAX_HZ = 1100; // ≈ whistle high

/** Hz → MIDI (rounded to nearest semitone). */
export function hzToMidi(hz: number): number {
  return Math.round(69 + 12 * Math.log2(hz / 440));
}

/** MIDI → Hz (for visual reference / tests). */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface PitchSample {
  frequency: number | null;
  clarity: number;
  midi: number | null;
}

/**
 * Create a reusable detector for a fixed sample rate.
 * Allocates once; call `.detect()` per frame.
 */
export function createPitchDetector(sampleRate: number) {
  const detector = PitchDetector.forFloat32Array(PITCH_WINDOW);
  detector.minVolumeDecibels = -40; // ignore near-silence

  return {
    /** Run pitch detection on one window of audio samples. */
    detect(buffer: Float32Array): PitchSample {
      // pitchy returns [pitch in Hz, clarity 0..1]
      const [pitch, clarity] = detector.findPitch(buffer, sampleRate);
      const voiced =
        clarity >= CLARITY_THRESHOLD &&
        pitch >= MIN_HZ &&
        pitch <= MAX_HZ &&
        Number.isFinite(pitch);

      return voiced
        ? { frequency: pitch, clarity, midi: hzToMidi(pitch) }
        : { frequency: null, clarity, midi: null };
    },
    /** Window size the caller must pass in. */
    windowSize: PITCH_WINDOW,
  };
}
