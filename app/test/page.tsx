"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { SONGS } from "@/lib/data/songs";
import { findMatches } from "@/lib/matching/matcher";
import { toParsons } from "@/lib/audio/melodyExtraction";
import type { MelodyContour } from "@/lib/types";

/**
 * Self-test page. Feeds each song's *own* canonical melody back through
 * `findMatches` and reports whether the matcher correctly identifies it.
 *
 * This is the bench we should have built first. If a song fails to
 * self-identify even with a perfect reference, the algorithm is broken.
 * If it passes perfect but fails noisy, we know how much imperfection it
 * can absorb.
 *
 * Three noise scenarios:
 *   - perfect    : exact reference, no transposition, no perturbation.
 *   - transposed : full melody shifted up/down a random semitone count.
 *   - hummed     : transposed + 30% of notes perturbed ±1 semitone.
 *   - sloppy     : transposed + 50% of notes perturbed ±2 semitones,
 *                  some notes dropped to simulate a partial hum.
 *
 * Not user-facing. Reach it at /test.
 */

type Scenario = "perfect" | "transposed" | "hummed" | "sloppy";

const SCENARIOS: { id: Scenario; label: string; description: string }[] = [
  { id: "perfect",    label: "Perfekt",    description: "Exakt referens — sanity check" },
  { id: "transposed", label: "Transponerad", description: "Slumpvis tonart, exakta intervaller" },
  { id: "hummed",     label: "Hummad",     description: "Transposition + ±1 semiton brus på 30%" },
  { id: "sloppy",     label: "Slarvigt",   description: "±2 semitoner brus på 50% + bortklippta noter" },
];

function buildContour(notes: number[]): MelodyContour {
  return {
    notes,
    parsons: toParsons(notes),
    intervals: notes.slice(1).map((n, i) => n - notes[i]),
    averageClarity: 0.95,
    voicedDuration: notes.length * 0.4,
    totalFrames: notes.length * 60,
  };
}

function rand(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function generateNotes(originalMelody: (number | null)[], scenario: Scenario): number[] {
  const clean = originalMelody.filter((n): n is number => n !== null);

  if (scenario === "perfect") return clean;

  // Random transposition between -7 and +7 semitones (within an octave).
  const transposeBy = rand(-7, 7);
  let notes = clean.map((n) => n + transposeBy);

  if (scenario === "transposed") return notes;

  // Perturb a percentage of notes by ±1 or ±2 semitones.
  const perturbPct = scenario === "hummed" ? 0.30 : 0.50;
  const maxShift   = scenario === "hummed" ? 1    : 2;
  notes = notes.map((n) => (Math.random() < perturbPct ? n + rand(-maxShift, maxShift) : n));

  // Sloppy: also drop ~15% of notes to simulate a partial hum.
  if (scenario === "sloppy") {
    notes = notes.filter(() => Math.random() > 0.15);
  }

  return notes;
}

interface Row {
  expected: string;
  expectedArtist: string;
  expectedId: string;
  contourNotes: number[];
  top1: { id: string; title: string; confidence: number } | null;
  top2: { id: string; title: string; confidence: number } | null;
  top3: { id: string; title: string; confidence: number } | null;
  rank: number; // 1 = top1, 2 = top2, 3 = top3, 0 = not in top3
}

function runScenario(scenario: Scenario, seed: number): Row[] {
  // Re-seed via Math.random isn't truly reproducible but is good enough
  // for spotting patterns when the user toggles re-run.
  void seed;

  return SONGS.map((song) => {
    const notes = generateNotes(song.melody, scenario);
    const matches = notes.length >= 4 ? findMatches(buildContour(notes), { topK: 3, minConfidence: 0 }) : [];

    const rankIdx = matches.findIndex((m) => m.song.id === song.id);

    return {
      expected: song.title,
      expectedArtist: song.artist,
      expectedId: song.id,
      contourNotes: notes,
      top1: matches[0] ? { id: matches[0].song.id, title: matches[0].song.title, confidence: matches[0].confidence } : null,
      top2: matches[1] ? { id: matches[1].song.id, title: matches[1].song.title, confidence: matches[1].confidence } : null,
      top3: matches[2] ? { id: matches[2].song.id, title: matches[2].song.title, confidence: matches[2].confidence } : null,
      rank: rankIdx === -1 ? 0 : rankIdx + 1,
    };
  });
}

export default function TestPage() {
  const [scenario, setScenario] = useState<Scenario>("perfect");
  const [seed, setSeed] = useState(0);
  const rows = useMemo(() => runScenario(scenario, seed), [scenario, seed]);

  const passes  = rows.filter((r) => r.rank === 1).length;
  const top3    = rows.filter((r) => r.rank >= 1 && r.rank <= 3).length;
  const total   = rows.length;

  return (
    <main className="min-h-screen px-5 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Tillbaka
        </Link>
        <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">
          Internt · Algoritmtest
        </span>
      </div>

      <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
        Matchningstest
      </h1>
      <p className="text-white/55 mt-2 max-w-xl">
        Matar varje låts egen referens (med valbart brus) tillbaka in i
        algoritmen. Visar var den hittar rätt och var den kollapsar.
      </p>

      {/* Scenario picker */}
      <div className="mt-6 grid sm:grid-cols-4 gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => setScenario(s.id)}
            className={clsx(
              "text-left p-3 rounded-2xl border transition-colors",
              scenario === s.id
                ? "bg-white/10 border-white/20 text-white"
                : "bg-white/[0.03] border-white/5 text-white/70 hover:text-white",
            )}
          >
            <div className="text-sm font-medium">{s.label}</div>
            <div className="text-xs text-white/50 mt-0.5">{s.description}</div>
          </button>
        ))}
      </div>

      {/* Summary + reroll */}
      <div className="mt-6 flex items-center justify-between glass rounded-2xl p-4">
        <div className="text-sm">
          <span className="text-white/55">Rätt #1:</span>{" "}
          <span className="font-mono text-emerald-300">{passes}</span>
          <span className="text-white/40"> / {total}</span>
          <span className="text-white/30 mx-3">·</span>
          <span className="text-white/55">I topp 3:</span>{" "}
          <span className="font-mono text-amber-300">{top3}</span>
          <span className="text-white/40"> / {total}</span>
        </div>
        <button
          onClick={() => setSeed(seed + 1)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/80"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Slumpa om
        </button>
      </div>

      {/* Table */}
      <div className="mt-4 glass rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1.4fr_2fr_2fr_2fr_60px] text-[11px] uppercase tracking-[0.18em] text-white/45 px-4 py-3 border-b border-white/5">
          <div>Förväntad</div>
          <div>#1</div>
          <div>#2</div>
          <div>#3</div>
          <div className="text-right">Status</div>
        </div>
        {rows.map((r) => (
          <div
            key={r.expectedId}
            className={clsx(
              "grid grid-cols-[1.4fr_2fr_2fr_2fr_60px] px-4 py-3 text-sm border-b border-white/5 last:border-b-0 items-center",
              r.rank === 1 && "bg-emerald-500/[0.04]",
              r.rank === 0 && "bg-rose-500/[0.05]",
            )}
          >
            <div>
              <div className="text-white">{r.expected}</div>
              <div className="text-xs text-white/40">{r.expectedArtist}</div>
            </div>
            <Cell match={r.top1} expectedId={r.expectedId} />
            <Cell match={r.top2} expectedId={r.expectedId} />
            <Cell match={r.top3} expectedId={r.expectedId} />
            <StatusBadge rank={r.rank} />
          </div>
        ))}
      </div>

      <p className="text-xs text-white/35 mt-6">
        Grön bakgrund = rätt låt rankas #1. Röd bakgrund = inte ens i topp 3.
        "Slumpa om" genererar nya transpositioner och nya brus-positioner.
      </p>
    </main>
  );
}

function Cell({
  match,
  expectedId,
}: {
  match: { id: string; title: string; confidence: number } | null;
  expectedId: string;
}) {
  if (!match) return <div className="text-white/30">—</div>;
  const isCorrect = match.id === expectedId;
  return (
    <div className="min-w-0 pr-3">
      <div
        className={clsx(
          "truncate text-sm",
          isCorrect ? "text-emerald-300" : "text-white/85",
        )}
        title={match.title}
      >
        {match.title}
      </div>
      <div className="text-xs text-white/45 tabular-nums">
        {Math.round(match.confidence * 100)}%
      </div>
    </div>
  );
}

function StatusBadge({ rank }: { rank: number }) {
  const styles =
    rank === 1
      ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30"
      : rank === 2 || rank === 3
      ? "bg-amber-400/15 text-amber-300 ring-amber-400/30"
      : "bg-rose-500/15 text-rose-300 ring-rose-500/30";
  const label = rank === 0 ? "—" : `#${rank}`;
  return (
    <div className="flex justify-end">
      <span
        className={clsx(
          "px-2 py-0.5 rounded-full text-xs tabular-nums ring-1",
          styles,
        )}
      >
        {label}
      </span>
    </div>
  );
}
