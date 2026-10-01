'use client';

interface QuantityStepperProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label: string;
}

/** Tombol minus nonaktif di 1, plus nonaktif di batas stok. */
export function QuantityStepper({ value, max, onChange, disabled, label }: QuantityStepperProps) {
  const button =
    'inline-flex size-11 items-center justify-center rounded-full text-lg font-bold text-ink hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center rounded-full border-[1.5px] border-line-input bg-surface"
    >
      <button
        type="button"
        className={button}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= 1}
        aria-label="Kurangi jumlah"
      >
        −
      </button>
      <span aria-live="polite" className="min-w-8 text-center font-semibold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        className={button}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label="Tambah jumlah"
      >
        +
      </button>
    </div>
  );
}
