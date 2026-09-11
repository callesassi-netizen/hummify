"use client";

/**
 * MelodyPlayer
 * ------------
 * Synthesizes a MIDI sequence using a triangle-wave oscillator with a
 * short attack/release envelope. Sounds clean, simple, and "musical
 * enough" without pulling in a sample library.
 *
 * Used to let the user *hear what the reference melody sounds like*
 * before humming, so they can aim correctly. This is the single biggest
 * UX lever for matching accuracy in an MVP — most failures are users
 * humming a different intervallic shape than what we encoded.
 *
 * Lifecycle:
 *   - AudioContext is created lazily on first play() (user gesture).
 *   - One Player instance owns one AudioContext; reuse across plays.
 *   - dispose() closes the context. Call on component unmount.
 *
 * TODO (future): swap triangle for a small sampled piano set or a
 * SoundFont for richer playback. Same call signature.
 */
export class MelodyPlayer {
  private ctx: AudioContext | null = null;
  /** Active oscillator nodes — kept so stop() can cancel scheduled notes. */
  private active: { osc: OscillatorNode; gain: GainNode }[] = [];

  /** True between play() and its natural end (or stop()). */
  get isPlaying(): boolean {
    return this.active.length > 0;
  }

  /**
   * Play a sequence of MIDI notes back-to-back. Resolves once playback
   * finishes naturally (not when stop() is called).
   *
   * @param midiNotes  MIDI note numbers in playback order.
   * @param opts.durations  Per-note duration in *beats* (1 = quarter,
   *                        0.5 = eighth, 2 = half). Same length as
   *                        midiNotes. Defaults to all 1s.
   * @param opts.bpm        Tempo in beats per minute. Default 100.
   * @param opts.gap        Gap between notes as a fraction of each
   *                        note's duration. Default 0.08 (8%).
   * @param opts.gain       Peak per-note gain. Default 0.18.
   */
  async play(
    midiNotes: number[],
    opts: {
      durations?: number[];
      bpm?: number;
      gap?: number;
      gain?: number;
    } = {},
  ): Promise<void> {
    const {
      durations,
      bpm = 100,
      gap = 0.08,
      gain: peakGain = 0.18,
    } = opts;

    this.stop();
    if (midiNotes.length === 0) return;

    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();

    const ctx = this.ctx;
    const lead = 0.05; // small lead-in so the first note isn't clipped
    const beatSec = 60 / bpm;

    // Master gain so we can fade everything out cleanly on stop().
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    let cursor = ctx.currentTime + lead;
    let totalSec = lead;

    midiNotes.forEach((midi, i) => {
      const beats = durations?.[i] ?? 1;
      const slotSec = beats * beatSec;
      const noteSec = slotSec * (1 - gap);
      const freq = 440 * Math.pow(2, (midi - 69) / 12);

      const noteStart = cursor;
      const noteEnd   = noteStart + noteSec;

      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;

      // Envelope scales slightly with note length so short notes don't
      // get cut off by the release tail.
      const attack  = Math.min(0.02, noteSec * 0.15);
      const release = Math.min(0.10, noteSec * 0.35);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, noteStart);
      gainNode.gain.linearRampToValueAtTime(peakGain, noteStart + attack);
      gainNode.gain.setValueAtTime(peakGain, Math.max(noteStart + attack, noteEnd - release));
      gainNode.gain.linearRampToValueAtTime(0, noteEnd);

      osc.connect(gainNode).connect(master);
      osc.start(noteStart);
      osc.stop(noteEnd + 0.02);

      this.active.push({ osc, gain: gainNode });

      cursor   += slotSec;
      totalSec += slotSec;
    });

    await new Promise<void>((resolve) => setTimeout(resolve, totalSec * 1000));
    // Clear refs once playback is done — nodes auto-disconnect on stop.
    this.active = [];
  }

  /** Stop immediately. Safe to call even if nothing is playing. */
  stop(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const { osc, gain } of this.active) {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.linearRampToValueAtTime(0, now + 0.05);
        osc.stop(now + 0.06);
      } catch {
        // Already-stopped nodes throw — ignore.
      }
    }
    this.active = [];
  }

  /** Close the context. Use on unmount. */
  dispose(): void {
    this.stop();
    if (this.ctx && this.ctx.state !== "closed") {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
  }
}
