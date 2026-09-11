"use client";

import { useEffect, useRef } from "react";

interface Props {
  /** Live analyser node from the recorder. Null when idle. */
  analyser: AnalyserNode | null;
  /** Whether the recorder is actively running. */
  active: boolean;
}

/**
 * Frequency-bar visualizer.
 *
 * Renders a horizontal mirrored bar spectrum below the record button.
 * When `analyser` is null or `active` is false, the canvas fades down
 * to a flat resting line — gives the page something pretty even before
 * the user starts recording.
 *
 * Drawing happens on a private rAF loop independent of React state.
 */
export function Visualizer({ analyser, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High-DPI handling — measure on every frame so the bars look crisp
    // on phones that change orientation.
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Persistent buffers — sized to whatever the analyser uses.
    let freqBuf = new Uint8Array(0);
    const BAR_COUNT = 56;
    let restingPhase = 0;

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);

      let levels: number[];

      if (analyser && active) {
        if (freqBuf.length !== analyser.frequencyBinCount) {
          freqBuf = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(freqBuf);

        // Down-sample frequency bins into BAR_COUNT bars,
        // using log spacing so vocals (mid range) get more bars.
        levels = new Array(BAR_COUNT);
        for (let i = 0; i < BAR_COUNT; i++) {
          const tLo = i / BAR_COUNT;
          const tHi = (i + 1) / BAR_COUNT;
          const lo = Math.floor(Math.pow(tLo, 2) * freqBuf.length);
          const hi = Math.max(lo + 1, Math.floor(Math.pow(tHi, 2) * freqBuf.length));
          let sum = 0;
          for (let k = lo; k < hi; k++) sum += freqBuf[k];
          levels[i] = sum / (hi - lo) / 255; // 0..1
        }
      } else {
        // Resting wave — soft sinusoidal idle animation so the page is alive.
        restingPhase += 0.02;
        levels = new Array(BAR_COUNT);
        for (let i = 0; i < BAR_COUNT; i++) {
          const t = i / BAR_COUNT;
          levels[i] =
            0.08 +
            0.05 * Math.sin(restingPhase + t * Math.PI * 2) +
            0.04 * Math.sin(restingPhase * 1.7 + t * Math.PI * 4);
        }
      }

      const gap = 3;
      const totalGap = gap * (BAR_COUNT - 1);
      const barW = Math.max(2, (width - totalGap) / BAR_COUNT);
      const midY = height / 2;
      const maxH = height * 0.85;

      // Vertical gradient that matches the brand palette
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0,   "rgba(196, 181, 253, 0.95)"); // violet-300
      grad.addColorStop(0.5, "rgba(236, 72, 153, 0.95)");  // pink-500
      grad.addColorStop(1,   "rgba(59, 130, 246, 0.95)");  // blue-500
      ctx.fillStyle = grad;

      for (let i = 0; i < BAR_COUNT; i++) {
        const v = Math.min(1, levels[i] * 1.4);
        const h = Math.max(3, v * maxH);
        const x = i * (barW + gap);
        const y = midY - h / 2;
        roundedRect(ctx, x, y, barW, h, Math.min(barW / 2, 4));
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [analyser, active]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-24 sm:h-28"
      aria-hidden
    />
  );
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}
