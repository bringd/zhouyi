import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { NumberBox } from "@/components/ui/NumberBox";
import { cn } from "@/utils/cn";
import { RandomizerReel } from "./RandomizerReel";
import { RandomizerScroll } from "./RandomizerScroll";
import { RandomizerStemBranch } from "./RandomizerStemBranch";
import { useRandomizerCycle, type RandomizerState } from "./shared";

export type RandomVariant = "reel" | "scroll" | "stem-branch";

export interface NumberBoxWithRandomizerProps {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  description?: string;
  variant?: RandomVariant;
  onRandomStart?: () => void;
  onRandomEnd?: (finalValue: number) => void;
  className?: string;
}

const VARIANT_DURATIONS: Record<RandomVariant, number> = {
  reel: 1400,
  scroll: 1600,
  "stem-branch": 1700,
};

export function NumberBoxWithRandomizer({
  value,
  onChange,
  label,
  description,
  variant = "reel",
  onRandomStart,
  onRandomEnd,
  className,
}: NumberBoxWithRandomizerProps) {
  const [inputDisabled, setInputDisabled] = useState(false);

  const { state, trigger } = useRandomizerCycle({
    durationMs: VARIANT_DURATIONS[variant],
    shouldAnimate: true,
    onDone: (finalValue) => {
      setInputDisabled(false);
      onChange(finalValue);
      onRandomEnd?.(finalValue);
    },
  });

  const isAnimating = state.kind === "randomizing";

  const handleRandomClick = () => {
    if (isAnimating) return;
    setInputDisabled(true);
    onRandomStart?.();
    trigger();
  };

  const variantState: RandomizerState = state;
  const VariantComponent =
    variant === "reel"
      ? RandomizerReel
      : variant === "scroll"
        ? RandomizerScroll
        : RandomizerStemBranch;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative inline-block">
        <NumberBox
          value={value}
          onChange={onChange}
          label={label}
          description={description}
          disabled={inputDisabled}
        />
        {isAnimating && (
          <VariantComponent
            state={variantState}
            durationMs={VARIANT_DURATIONS[variant]}
          />
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleRandomClick}
        disabled={isAnimating}
        aria-label="随机生成灵数"
        className="text-june-bronze hover:text-june-red font-display tracking-widest"
      >
        {isAnimating ? "取数中…" : "天降灵数"}
      </Button>
    </div>
  );
}
