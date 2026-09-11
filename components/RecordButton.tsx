"use client";

import { motion } from "framer-motion";
import { Mic, Square } from "lucide-react";
import clsx from "clsx";

interface Props {
  state: "idle" | "recording" | "disabled";
  /** RMS volume 0..1 — used to pulse the button while recording. */
  level?: number;
  onPress: () => void;
}

/**
 * The hero record button. Visuals only — owns no audio logic.
 *
 * Three rings:
 *   1. Idle: slow ambient pulse to invite a tap.
 *   2. Recording: rings expand proportionally to live RMS.
 *   3. Disabled: dimmed, no pulse.
 *
 * Size is fixed at 200px so the rings don't reflow page layout.
 */
export function RecordButton({ state, level = 0, onPress }: Props) {
  const isRecording = state === "recording";
  const isDisabled  = state === "disabled";

  // Driven pulse scale: 1.0 ↔ 1.18 depending on loudness while recording.
  const pulseScale = isRecording ? 1 + level * 0.18 : 1;

  return (
    <div className="relative grid place-items-center w-[260px] h-[260px] sm:w-[300px] sm:h-[300px]">
      {/* Ambient outer rings */}
      <motion.span
        aria-hidden
        className={clsx(
          "absolute inset-0 rounded-full blur-2xl",
          isRecording
            ? "bg-gradient-to-br from-neon-pink/40 via-neon-violet/40 to-neon-blue/40"
            : "bg-gradient-to-br from-neon-violet/30 via-fuchsia-500/20 to-neon-blue/30",
        )}
        animate={{
          scale: isRecording ? [1, 1.06, 1] : [1, 1.04, 1],
          opacity: isDisabled ? 0.15 : isRecording ? 0.85 : 0.55,
        }}
        transition={{
          duration: isRecording ? 1.4 : 3.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Crisp ring */}
      <motion.span
        aria-hidden
        className="absolute inset-6 rounded-full border border-white/10"
        animate={{ scale: pulseScale }}
        transition={{ type: "spring", stiffness: 140, damping: 18 }}
      />

      {/* The button itself */}
      <motion.button
        type="button"
        onClick={onPress}
        disabled={isDisabled}
        whileTap={{ scale: 0.96 }}
        animate={{ scale: pulseScale }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className={clsx(
          "relative grid place-items-center rounded-full",
          "w-[200px] h-[200px] sm:w-[220px] sm:h-[220px]",
          "shadow-glow ring-1 ring-white/20",
          "transition-colors duration-300",
          "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          isRecording && "from-rose-500 via-pink-500 to-fuchsia-500 shadow-glow-pink",
        )}
        aria-pressed={isRecording}
        aria-label={isRecording ? "Stoppa inspelning" : "Starta inspelning"}
      >
        {/* Inner glossy disc */}
        <span
          aria-hidden
          className="absolute inset-2 rounded-full bg-gradient-to-br from-white/15 via-white/5 to-transparent"
        />
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 25%, rgba(255,255,255,0.35) 0%, transparent 60%)",
          }}
        />

        {/* Icon */}
        <motion.span
          key={isRecording ? "stop" : "mic"}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative text-white drop-shadow"
        >
          {isRecording ? (
            <Square className="w-12 h-12" strokeWidth={2.5} fill="currentColor" />
          ) : (
            <Mic className="w-14 h-14" strokeWidth={2.2} />
          )}
        </motion.span>
      </motion.button>
    </div>
  );
}
