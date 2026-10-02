/** Kelas tombol sesuai DESIGN.md (Buttons). Semua ukuran memenuhi target sentuh 44px. */
const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40';

const sizes = {
  sm: 'min-h-11 px-[18px] text-sm',
  md: 'min-h-12 px-7 text-[15px]',
  lg: 'min-h-[52px] px-9 text-base',
} as const;

const variants = {
  primary:
    'bg-action text-white hover:bg-action-hover active:bg-action-active disabled:hover:bg-action',
  secondary:
    'border-2 border-action text-action hover:bg-action-tint hover:text-action-hover disabled:hover:bg-transparent',
  ghost: 'text-ink-2 hover:bg-muted',
  destructive: 'bg-danger text-white hover:bg-danger-hover',
} as const;

export function buttonClass(
  variant: keyof typeof variants = 'primary',
  size: keyof typeof sizes = 'md',
  extra = '',
): string {
  return `${base} ${sizes[size]} ${variants[variant]} ${extra}`.trim();
}

/** Chip filter setinggi 44px agar memenuhi target sentuh. */
export function chipClass(selected: boolean): string {
  return `inline-flex min-h-11 shrink-0 items-center rounded-full whitespace-nowrap border-[1.5px] px-4 text-sm font-semibold transition-colors ${
    selected
      ? 'border-action bg-action text-white'
      : 'border-line-input bg-surface text-ink hover:bg-muted'
  }`;
}

export const inputClass =
  'h-12 w-full rounded-xl border-[1.5px] border-line-input bg-surface px-4 text-base text-ink placeholder:text-ink-3 outline-none focus:border-action focus:ring-[3px] focus:ring-brand/15 aria-invalid:border-danger aria-invalid:ring-danger/15';
