import * as React from "react";
import { Input, type InputProps } from "./input";

export interface NumberInputProps extends Omit<InputProps, "value" | "onChange" | "type"> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Allow decimals. Off by default — most fields here are counts. */
  allowDecimal?: boolean;
}

/**
 * Numeric field that lets you empty it while typing.
 *
 * Clamping on every keystroke makes a field like "10" impossible to edit —
 * deleting the "0" snaps it straight back to the minimum. This keeps whatever
 * you type (including nothing at all) and only clamps when the field loses
 * focus or you press Enter.
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, min, max, allowDecimal = false, onBlur, onKeyDown, ...props }, ref) => {
    const [draft, setDraft] = React.useState<string | null>(null);

    const clamp = (n: number) => {
      if (min != null && n < min) return min;
      if (max != null && n > max) return max;
      return n;
    };

    const commit = () => {
      if (draft === null) return;
      const parsed = allowDecimal ? parseFloat(draft) : parseInt(draft, 10);
      onChange(isFinite(parsed) ? clamp(parsed) : clamp(min ?? 0));
      setDraft(null);
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="number"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        min={min}
        max={max}
        value={draft ?? String(value)}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          // Stay live while the text is already a usable number; an empty or
          // half-typed value just waits for blur.
          const parsed = allowDecimal ? parseFloat(text) : parseInt(text, 10);
          if (text !== "" && isFinite(parsed) && parsed === clamp(parsed)) {
            onChange(parsed);
          }
        }}
        onBlur={(e) => {
          commit();
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          onKeyDown?.(e);
        }}
      />
    );
  }
);
NumberInput.displayName = "NumberInput";
