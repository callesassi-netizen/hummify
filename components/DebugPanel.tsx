"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { MelodyContour } from "@/lib/types";
import { midiToHz } from "@/lib/audio/pitchDetection";

interface Props {
  contour: MelodyContour;
}

/**
 * Inspector panel — shown beneath the results so we can see exactly what
 * the pitch pipeline captured. Critical for tuning the matcher: when a
 * match feels wrong we can compare the user's actual contour against the
 * reference's contour in `lib/data/songs.ts`.
 *
 * Collapsed by default. The label/value pairs are intentionally terse —
 * this is a developer surface, not user-facing copy.
 */
const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

function midiToName(midi: number): string {
  const n = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${n}${octave}`;
}

function formatInterval(n: number): string {
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `${n}`;
}

export function DebugPanel({ contour }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div className="glass rounded-2xl p-4 sm:p-5 text-[12.5px] font-mono leading-relaxed">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-white/70 hover:text-white/90 transition-colors"
      >
        <span className="uppercase tracking-[0.18em] text-[10px]">
          Diagnostik · vad vi hörde
        </span>
        <motion.span animate={{ rotate: open ? 0 : -90 }}>
          <ChevronDown className="w-4 h-4" />
        </motion.span>
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 space-y-3 overflow-hidden"
        >
          <Row label="Voiced frames">
            {contour.totalFrames > 0 ? (
              <>
                {Math.round(contour.averageClarity * 100)}% klarhet ·{" "}
                {contour.voicedDuration.toFixed(2)}s ·{" "}
                {contour.totalFrames} frames totalt
              </>
            ) : (
              "—"
            )}
          </Row>

          <Row label="Detekterade toner">
            <span className="text-white/90 break-words">
              {contour.notes.map(midiToName).join(" → ") || "—"}
            </span>
          </Row>

          <Row label="MIDI">
            <span className="text-white/55 break-words">
              [{contour.notes.join(", ")}]
            </span>
          </Row>

          <Row label="Intervaller">
            <span className="text-white/90 break-words">
              {contour.intervals.map(formatInterval).join(" ") || "—"}
            </span>
          </Row>

          <Row label="Parsons">
            <span className="text-fuchsia-300 tracking-widest">
              {contour.parsons || "—"}
            </span>
          </Row>

          <Row label="Frekvensspann">
            {contour.notes.length > 0 ? (
              <>
                {midiToHz(Math.min(...contour.notes)).toFixed(0)} –{" "}
                {midiToHz(Math.max(...contour.notes)).toFixed(0)} Hz
              </>
            ) : (
              "—"
            )}
          </Row>
        </motion.div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 items-start">
      <span className="text-white/45 uppercase tracking-wider text-[10px] mt-0.5">
        {label}
      </span>
      <span className="text-white/80">{children}</span>
    </div>
  );
}
