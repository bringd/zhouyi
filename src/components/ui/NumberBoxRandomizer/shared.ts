import { useEffect, useReducer, useRef } from "react";
import { useReducedMotion } from "framer-motion";

export function rollFinal(): number {
  return Math.floor(100 + Math.random() * 900);
}

export type RandomizerState =
  | { kind: "idle" }
  | { kind: "randomizing"; startMs: number }
  | { kind: "settling"; finalValue: number };

export type RandomizerAction =
  | { type: "START" }
  | { type: "END"; finalValue: number }
  | { type: "RESET" };

export function randomizerReducer(
  _state: RandomizerState,
  action: RandomizerAction,
): RandomizerState {
  switch (action.type) {
    case "START":
      return { kind: "randomizing", startMs: Date.now() };
    case "END":
      return { kind: "settling", finalValue: action.finalValue };
    case "RESET":
      return { kind: "idle" };
  }
}

interface UseRandomizerCycleOpts {
  durationMs: number;
  shouldAnimate: boolean;
  onDone: (finalValue: number) => void;
}

export function useRandomizerCycle(opts: UseRandomizerCycleOpts): {
  state: RandomizerState;
  trigger: () => void;
} {
  const [state, dispatch] = useReducer(randomizerReducer, { kind: "idle" });
  const reduced = useReducedMotion() ?? false;

  // Hold the latest onDone in a ref so the timer effect doesn't re-fire
  // on every parent re-render (caller typically passes an inline arrow,
  // which would otherwise be a fresh reference each render → cleanup +
  // re-arm → timer never reaches its delay).
  const onDoneRef = useRef(opts.onDone);
  useEffect(() => {
    onDoneRef.current = opts.onDone;
  }, [opts.onDone]);

  useEffect(() => {
    if (state.kind !== "randomizing") return;
    const finalValue = rollFinal();
    const delay = opts.shouldAnimate && !reduced ? opts.durationMs : 0;
    const t = setTimeout(() => {
      dispatch({ type: "END", finalValue });
      onDoneRef.current(finalValue);
    }, delay);
    return () => clearTimeout(t);
  }, [state.kind, opts.durationMs, opts.shouldAnimate, reduced]);

  const trigger = () => {
    if (state.kind === "randomizing") return;
    dispatch({ type: "START" });
  };

  return { state, trigger };
}
