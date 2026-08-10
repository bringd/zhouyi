import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RandomizerState } from "./shared";

interface Props {
  state: RandomizerState;
  durationMs: number;
}

const HEAVENLY = "甲乙丙丁戊己庚辛壬癸".split("");
const EARTHLY = "子丑寅卯辰巳午未申酉戌亥".split("");
const TRIGRAMS = ["⚊", "⚋"];

export function RandomizerStemBranch({ state, durationMs }: Props) {
  const [char, setChar] = useState<string>("");

  useEffect(() => {
    if (state.kind !== "randomizing") return;
    const start = performance.now();
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const elapsed = performance.now() - start;
      if (elapsed >= durationMs) return;
      const pool = [...HEAVENLY, ...EARTHLY, ...TRIGRAMS];
      setChar(pool[Math.floor(Math.random() * pool.length)]);
      setTimeout(tick, 50);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [state.kind, durationMs]);

  if (state.kind !== "randomizing") return null;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-rice-dark/85 rounded-sm">
      <AnimatePresence mode="wait">
        <motion.div
          key={char || "init"}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.05 }}
          className="font-display text-4xl text-ink"
        >
          {char}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
