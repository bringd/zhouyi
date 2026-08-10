import { motion } from "framer-motion";
import type { RandomizerState } from "./shared";

interface Props {
  state: RandomizerState;
  durationMs: number;
}

export function RandomizerScroll({ state }: Props) {
  if (state.kind !== "randomizing") return null;

  return (
    <motion.div
      key="scroll"
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -80, opacity: 0 }}
      transition={{ duration: 1.4, ease: "easeInOut" }}
      className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-b from-june-bronze/35 to-june-clay/45 rounded-sm font-display tracking-widest text-base text-ink"
    >
      卷轴取数…
    </motion.div>
  );
}
