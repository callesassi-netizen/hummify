"use client";

import type { PitchFrame } from "@/lib/types";
import { createPitchDetector, PITCH_WINDOW } from "./pitchDetection";

/**
 * AudioRecorder
 * -------------
 * Captures microphone audio and produces pitch frames in real time.
 *
 * Why not MediaRecorder + post-processing?
 *  - We don't need the encoded audio for anything (no playback, no upload).
 *  - Running pitch detection live keeps everything in Float32 land,
 *    avoids decoding compressed Opus/WebM, and lets the visualizer share
 *    the same AnalyserNode the detector reads from.
 *
 * The recorder owns:
 *  - AudioContext + getUserMedia stream
 *  - AnalyserNode (also exposed for the <Visualizer/> component)
 *  - The rAF loop that pulls samples and runs pitch detection
 *
 * The recorder does NOT own:
 *  - Any React state. Callers wire events into their own state.
 *
 * TODO (future): move pitch detection into an AudioWorklet so the main
 * thread is unblocked and we can run heavier models (CREPE / SPICE).
 */
export interface RecorderEvents {
  /** Called ~60×/s with the live RMS and current pitch (for the visualizer). */
  onTick?: (tick: LiveTick) => void;
  /** Called once when the mic is live and recording has truly begun. */
  onStart?: () => void;
  /** Called if anything goes wrong mid-stream. */
  onError?: (err: RecorderError) => void;
}

export interface LiveTick {
  /** Loudness 0..1, smoothed. */
  rms: number;
  /** Current detected frequency in Hz, or null. */
  frequency: number | null;
  /** Detector clarity 0..1. */
  clarity: number;
  /** Seconds since start. */
  elapsed: number;
}

export type RecorderError =
  | { kind: "mic-denied"; message: string }
  | { kind: "unsupported"; message: string }
  | { kind: "analysis-failed"; message: string };

export class AudioRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private rafId: number | null = null;
  private startedAt = 0;
  private frames: PitchFrame[] = [];
  private buffer = new Float32Array(PITCH_WINDOW);
  private events: RecorderEvents = {};
  private running = false;

  /** Public read-only view of the analyser for the visualizer. */
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /** True while the rAF loop is active. */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Begin recording. Resolves once the mic is live and the loop is running.
   * Rejects with a RecorderError so callers can surface a friendly message.
   */
  async start(events: RecorderEvents = {}): Promise<void> {
    this.events = events;

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const err: RecorderError = {
        kind: "unsupported",
        message: "Din webbläsare stöder tyvärr inte mikrofoninspelning.",
      };
      this.events.onError?.(err);
      throw err;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, // we want the raw voice, not VoIP-cleaned
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
    } catch (e) {
      const err: RecorderError = {
        kind: "mic-denied",
        message: "Mikrofonbehörighet nekades. Tillåt mikrofon i webbläsaren och försök igen.",
      };
      this.events.onError?.(err);
      throw err;
    }

    // Lazy-load AudioContext (constructor must run after a user gesture on iOS).
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new Ctx();

    // After an `await` the user-activation is no longer "active" in Chrome's
    // autoplay policy, so the context can be created in `suspended` state
    // even though the user *did* click. Explicit resume is harmless and
    // covers iOS/Safari + Chromium autoplay edge cases.
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        // If resume fails the loop below still pulls zeros; we surface
        // that as "no pitch" further up the chain.
      }
    }

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = PITCH_WINDOW;
    this.analyser.smoothingTimeConstant = 0.4;
    this.source.connect(this.analyser);
    // NOTE: we intentionally don't connect analyser → destination,
    // otherwise the user would hear themselves with latency.

    const detector = createPitchDetector(this.ctx.sampleRate);
    this.frames = [];
    this.startedAt = performance.now();
    this.running = true;
    this.events.onStart?.();

    const loop = () => {
      if (!this.running || !this.analyser || !this.ctx) return;

      this.analyser.getFloatTimeDomainData(this.buffer);

      // RMS for the visualizer (0..1ish).
      let sumSq = 0;
      for (let i = 0; i < this.buffer.length; i++) {
        const s = this.buffer[i];
        sumSq += s * s;
      }
      const rms = Math.min(1, Math.sqrt(sumSq / this.buffer.length) * 3);

      // Pitch detection on the same window.
      const sample = detector.detect(this.buffer);
      const elapsed = (performance.now() - this.startedAt) / 1000;

      this.frames.push({
        time: elapsed,
        frequency: sample.frequency,
        clarity: sample.clarity,
        midi: sample.midi,
      });

      this.events.onTick?.({
        rms,
        frequency: sample.frequency,
        clarity: sample.clarity,
        elapsed,
      });

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  /**
   * Stop recording and return the accumulated pitch frames.
   * Safe to call multiple times; subsequent calls return an empty array.
   */
  async stop(): Promise<PitchFrame[]> {
    if (!this.running) return [];
    this.running = false;

    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.cleanupAudioGraph();
    return this.frames;
  }

  /** Force-tear-down. Use on unmount. */
  dispose(): void {
    this.running = false;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.cleanupAudioGraph();
    this.frames = [];
  }

  private cleanupAudioGraph() {
    try {
      this.source?.disconnect();
    } catch {}
    try {
      this.analyser?.disconnect();
    } catch {}
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.ctx && this.ctx.state !== "closed") {
      this.ctx.close().catch(() => {});
    }
    this.source = null;
    this.analyser = null;
    this.stream = null;
    this.ctx = null;
  }
}
