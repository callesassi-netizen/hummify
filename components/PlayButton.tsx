"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Play, Square } from "lucide-react";
import clsx from "clsx";
import { MelodyPlayer } from "@/lib/audio/melodyPlayer";
import { getPreviewUrl } from "@/lib/audio/songPreview";

interface Props {
  /** MIDI notes to fall back to synth playback. */
  notes: number[];
  /** Per-note duration in beats (1 = quarter). */
  durations?: number[];
  /** Tempo in BPM for synth fallback. */
  bpm?: number;
  /** If provided & artist != "Traditional", we try iTunes preview first. */
  artist?: string;
  /** Used together with `artist` for iTunes lookup. */
  songTitle?: string;
  /** Label shown next to the icon. */
  label?: string;
  /** Visual variant. */
  variant?: "pill" | "chip";
  /** Optional tooltip / aria text. */
  title?: string;
}

type PlayState = "idle" | "loading" | "playing";

/**
 * Smart play button:
 *   1. If `artist` + `songTitle` are provided and the artist isn't
 *      "Traditional", fetch a 30s iTunes preview clip and play it.
 *   2. Otherwise (or if iTunes has no hit / fails), synthesize the
 *      MIDI sequence locally with the MelodyPlayer.
 *
 * Owns its own MelodyPlayer + HTMLAudioElement so multiple buttons on
 * the same page don't fight over a global audio resource.
 */
export function PlayButton({
  notes,
  durations,
  bpm,
  artist,
  songTitle,
  label = "Lyssna",
  variant = "pill",
  title,
}: Props) {
  const [state, setState] = useState<PlayState>("idle");
  const synthRef = useRef<MelodyPlayer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      synthRef.current?.dispose();
      synthRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  const stopAll = useCallback(() => {
    synthRef.current?.stop();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setState("idle");
  }, []);

  const playSynth = useCallback(async () => {
    if (!synthRef.current) synthRef.current = new MelodyPlayer();
    setState("playing");
    try {
      await synthRef.current.play(notes, { durations, bpm });
    } finally {
      setState("idle");
    }
  }, [notes, durations, bpm]);

  const playPreview = useCallback(async (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) audioRef.current = null;
        setState("idle");
        resolve(true);
      };
      audio.onerror = () => {
        if (audioRef.current === audio) audioRef.current = null;
        resolve(false);
      };
      audio.play().then(
        () => setState("playing"),
        () => {
          if (audioRef.current === audio) audioRef.current = null;
          resolve(false);
        },
      );
    });
  }, []);

  const handleClick = useCallback(async () => {
    if (state !== "idle") {
      stopAll();
      return;
    }

    // Try iTunes preview first when we have artist + title.
    if (artist && songTitle && artist.toLowerCase() !== "traditional") {
      setState("loading");
      const url = await getPreviewUrl(artist, songTitle);
      if (url) {
        const ok = await playPreview(url);
        if (ok) return;
        // Fall through to synth if preview failed to play.
      }
    }

    // Synth fallback.
    await playSynth();
  }, [state, artist, songTitle, stopAll, playPreview, playSynth]);

  const base = "inline-flex items-center gap-1.5 transition-colors";
  const styles =
    variant === "pill"
      ? "px-3.5 py-1.5 rounded-full text-sm bg-white/[0.04] hover:bg-white/10 border border-white/10 text-white/85 hover:text-white"
      : "px-3 py-1.5 rounded-full text-[13px] bg-white/[0.04] hover:bg-white/10 border border-white/10 text-white/80 hover:text-white";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={clsx(base, styles)}
      title={title}
      aria-pressed={state === "playing"}
      disabled={false}
    >
      {state === "loading" ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : state === "playing" ? (
        <Square className="w-3.5 h-3.5" fill="currentColor" />
      ) : (
        <Play className="w-3.5 h-3.5" fill="currentColor" />
      )}
      {state === "playing" ? "Stoppa" : state === "loading" ? "Hämtar…" : label}
    </button>
  );
}
