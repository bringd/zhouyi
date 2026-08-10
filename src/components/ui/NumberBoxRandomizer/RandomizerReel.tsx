import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { RandomizerState } from "./shared";

interface Props {
  state: RandomizerState;
  durationMs: number;
}

export function RandomizerReel({ state, durationMs }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (state.kind !== "randomizing") return;
    const start = performance.now();
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      const elapsed = performance.now() - start;
      if (elapsed >= durationMs) return;
      setTick((t) => t + 1);
      const interval =
        elapsed < 800 ? 50 : Math.min(50 + (elapsed - 800) / 12, 200);
      setTimeout(loop, interval);
    };
    loop();
    return () => {
      cancelled = true;
    };
  }, [state.kind, durationMs]);

  if (state.kind !== "randomizing") return null;
  const a = 100 + ((tick * 37) % 900);

  return (
    <motion.div
      key="reel"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-none absolute inset-0 flex items-center justify-center bg-rice-dark/85 rounded-sm font-display tracking-widest text-3xl text-ink tabular-nums"
    >
      {String(a).padStart(3, "0")}
    </motion.div>
  );
}
