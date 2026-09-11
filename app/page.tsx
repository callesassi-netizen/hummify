"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { RecordButton } from "@/components/RecordButton";
import { Visualizer } from "@/components/Visualizer";
import { AnalyzingState } from "@/components/AnalyzingState";
import { ResultsList } from "@/components/ResultsList";
import { ErrorState } from "@/components/ErrorState";
import { DebugPanel } from "@/components/DebugPanel";
import { MelodyHints } from "@/components/MelodyHints";

import { AudioRecorder, type LiveTick, type RecorderError } from "@/lib/audio/recorder";
import { extractMelody, MIN_VOICED_FRAMES } from "@/lib/audio/melodyExtraction";
import { findMatches } from "@/lib/matching/matcher";
import type { AppError, AppPhase, MatchResult, MelodyContour } from "@/lib/types";

/** Auto-stop after this many seconds — enforced by the page, not the recorder. */
const MAX_RECORDING_SECONDS = 15;
/** Below this, the recording is too short to be useful. */
const MIN_RECORDING_SECONDS = 1.5;

export default function HomePage() {
  const [phase, setPhase] = useState<AppPhase>("idle");
  const [error, setError] = useState<AppError | null>(null);
  const [results, setResults] = useState<MatchResult[]>([]);
  /** Kept for the debug panel — last contour we extracted, regardless of outcome. */
  const [lastContour, setLastContour] = useState<MelodyContour | null>(null);
  const [tick, setTick] = useState<LiveTick>({
    rms: 0,
    frequency: null,
    clarity: 0,
    elapsed: 0,
  });

  // Recorder kept in a ref — it's not React state and should survive renders.
  const recorderRef = useRef<AudioRecorder | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirror of tick.elapsed in a ref so callbacks don't capture stale values
  // (specifically the auto-stop setTimeout, which fires 15s after start).
  const elapsedRef = useRef(0);

  // Lazy-init on first interaction (required for iOS AudioContext).
  const getRecorder = useCallback(() => {
    if (!recorderRef.current) recorderRef.current = new AudioRecorder();
    return recorderRef.current;
  }, []);

  // Tear-down on unmount.
  useEffect(() => {
    return () => {
      recorderRef.current?.dispose();
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, []);

  const stopRecording = useCallback(async () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (!recorder) return;

    setPhase("analyzing");
    const frames = await recorder.stop();
    const elapsedAtStop = elapsedRef.current;

    // Guardrail: too short / no voiced frames → tell the user.
    if (elapsedAtStop < MIN_RECORDING_SECONDS) {
      setError({
        kind: "too-short",
        message: "Inspelningen var för kort. Nynna i minst ett par sekunder.",
      });
      setPhase("error");
      return;
    }

    const voiced = frames.filter((f) => f.midi !== null).length;
    if (voiced < MIN_VOICED_FRAMES) {
      setError({
        kind: "no-pitch",
        message:
          "Vi kunde inte uppfatta tonhöjden tydligt. Försök igen i en lite tystare miljö och nynna med tydlig ton.",
      });
      setPhase("error");
      return;
    }

    // The actual analysis. Wrapped in try/catch so any unexpected math
    // explosion still surfaces a friendly error.
    try {
      const contour = extractMelody(frames);
      if (!contour) {
        setError({
          kind: "no-pitch",
          message:
            "För få tydliga toner att jämföra. Försök nynna en längre melodifras.",
        });
        setPhase("error");
        return;
      }
      setLastContour(contour);

      // Synthetic "thinking" delay — feels more like real analysis than
      // instantaneous results, and gives the loading animation a beat to
      // shine. Real ML inference will replace this naturally.
      await new Promise((r) => setTimeout(r, 650));

      const matches = findMatches(contour, { topK: 3 });
      setResults(matches);
      setPhase("results");
    } catch (e) {
      setError({
        kind: "analysis-failed",
        message:
          "Något gick fel när vi försökte analysera melodin. Försök igen.",
      });
      setPhase("error");
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setResults([]);
    setTick({ rms: 0, frequency: null, clarity: 0, elapsed: 0 });
    elapsedRef.current = 0;

    const recorder = getRecorder();
    try {
      await recorder.start({
        onTick: (t) => {
          elapsedRef.current = t.elapsed;
          setTick(t);
        },
        onError: (err: RecorderError) => {
          setError({ kind: err.kind, message: err.message });
          setPhase("error");
        },
      });
      setPhase("recording");

      // Hard auto-stop. Capture the current recorder to avoid stale closures.
      stopTimerRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (e) {
      // recorder.start already invoked onError — nothing more to do.
    }
  }, [getRecorder, stopRecording]);

  const reset = useCallback(() => {
    setError(null);
    setResults([]);
    setPhase("idle");
    setTick({ rms: 0, frequency: null, clarity: 0, elapsed: 0 });
    elapsedRef.current = 0;
  }, []);

  const handlePress = useCallback(() => {
    if (phase === "recording") {
      stopRecording();
    } else if (phase === "idle" || phase === "error" || phase === "results") {
      startRecording();
    }
  }, [phase, startRecording, stopRecording]);

  // Helper text under the visualizer.
  const helper = useMemo(() => {
    if (phase === "recording") {
      const remaining = Math.max(0, MAX_RECORDING_SECONDS - tick.elapsed);
      return `Spelar in… ${remaining.toFixed(1)}s kvar`;
    }
    if (phase === "idle") return "Tryck och nynna refrängen i ca 8–15 sekunder";
    return "";
  }, [phase, tick.elapsed]);

  const analyser = recorderRef.current?.getAnalyser() ?? null;
  const showButton = phase === "idle" || phase === "recording";

  return (
    <main className="relative min-h-screen flex flex-col">
      {/* Top brand bar */}
      <header className="px-6 pt-8 sm:pt-10 flex items-center justify-between max-w-3xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 shadow-glow">
            <Sparkles className="w-5 h-5 text-white" />
          </span>
          <span className="font-display text-lg tracking-tight">Hummify</span>
        </div>
        <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">
          MVP · Beta
        </span>
      </header>

      {/* Center stage */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-3xl w-full mx-auto">
        <AnimatePresence mode="wait">
          {showButton && (
            <motion.div
              key="record"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0  }}
              exit={{    opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center gap-8 w-full"
            >
              <div className="text-center max-w-md">
                <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
                  Nynna en melodi
                  <br />
                  <span className="text-gradient">vi gissar låten.</span>
                </h1>
                <p className="text-white/55 mt-3 text-base sm:text-lg">
                  Sjung, vissla eller nynna refrängen. Hummify lyssnar på tonhöjden
                  och föreslår vilken låt det kan vara.
                </p>
              </div>

              <RecordButton
                state={phase === "recording" ? "recording" : "idle"}
                level={tick.rms}
                onPress={handlePress}
              />

              <div className="w-full max-w-md">
                <Visualizer analyser={analyser} active={phase === "recording"} />
                <p className="text-center text-sm text-white/55 mt-2 tabular-nums min-h-[1.25rem]">
                  {helper}
                </p>
              </div>

              {phase === "idle" && <MelodyHints />}
            </motion.div>
          )}

          {phase === "analyzing" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{    opacity: 0 }}
              className="w-full flex justify-center"
            >
              <AnalyzingState />
            </motion.div>
          )}

          {phase === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{    opacity: 0, y: -8 }}
              className="w-full max-w-xl flex flex-col gap-4"
            >
              <ResultsList results={results} onTryAgain={reset} />
              {lastContour && <DebugPanel contour={lastContour} />}
            </motion.div>
          )}

          {phase === "error" && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{    opacity: 0 }}
              className="w-full max-w-xl flex flex-col gap-4 items-center"
            >
              <ErrorState error={error} onTryAgain={reset} />
              {lastContour && <DebugPanel contour={lastContour} />}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Footer hint */}
      <footer className="px-6 pb-8 text-center text-xs text-white/35">
        Tryck på mikrofonknappen och nynna. Auto-stopp efter {MAX_RECORDING_SECONDS}s.
      </footer>
    </main>
  );
}
