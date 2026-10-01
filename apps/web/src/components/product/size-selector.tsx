'use client';

import type { ProductVariantView } from '@sportswear/shared';

interface SizeSelectorProps {
  variants: ProductVariantView[];
  selectedId: string | null;
  onSelect: (variantId: string) => void;
  labelId: string;
}

/** Ukuran stok 0 tetap tampil tapi tidak bisa dipilih (F-04). */
export function SizeSelector({ variants, selectedId, onSelect, labelId }: SizeSelectorProps) {
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
      {variants.map((variant) => {
        const soldOut = variant.stock === 0;
        const selected = variant.id === selectedId;
        return (
          <button
            key={variant.id}
            type="button"
            aria-pressed={selected}
            aria-disabled={soldOut}
            aria-label={soldOut ? `${variant.size}, stok habis` : variant.size}
            onClick={() => {
              if (!soldOut) onSelect(variant.id);
            }}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border-[1.5px] px-3 text-[15px] font-semibold transition-colors ${
              soldOut
                ? 'cursor-not-allowed border-line bg-muted text-ink-2 line-through'
                : selected
                  ? 'border-action bg-action text-white'
                  : 'border-line-input bg-surface text-ink hover:bg-muted'
            }`}
          >
            {variant.size}
          </button>
        );
      })}
    </div>
  );
}
