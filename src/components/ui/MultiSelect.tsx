import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

type Props = {
  label: string;
  options: (string | number)[];
  selected: (string | number)[];
  onChange: (next: (string | number)[]) => void;
  widthClass?: string;
};

const btnClass =
  'inline-flex items-center justify-between gap-1.5 rounded-md border border-line-2 bg-white px-3 py-1.5 text-2xs font-semibold text-ink-2 transition hover:border-fmp/50 focus:border-fmp focus:outline-none focus:ring-1 focus:ring-fmp/30 cursor-pointer';

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  widthClass = 'min-w-[160px]',
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const allSelected = selected.length === 0;
  const toggle = (val: string | number) => {
    if (selected.includes(val)) {
      onChange(selected.filter((s) => s !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const displayText = allSelected
    ? 'Todos'
    : selected.length === 1
      ? String(selected[0])
      : `${selected.length} selecionados`;

  return (
    <div ref={ref} className={`relative flex flex-col gap-1.5 ${widthClass}`}>
      <div className="flex items-center gap-2">
        <label className="text-2xs font-semibold uppercase tracking-widest text-ink-3 whitespace-nowrap">
          {label}
        </label>
      </div>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${displayText}`}
        onClick={() => setOpen((o) => !o)}
        className={`${btnClass} w-full`}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className={`h-3 w-3 flex-shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 max-h-64 min-w-full overflow-y-auto rounded-md border border-line bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => onChange([])}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-2xs font-semibold transition hover:bg-paper ${
              allSelected ? 'text-fmp' : 'text-ink-2'
            }`}
          >
            <span className="h-3.5 w-3.5 flex-shrink-0" />
            Todos
          </button>
          {options.map((opt) => {
            const isSel = selected.includes(opt);
            return (
              <button
                type="button"
                key={opt}
                onClick={() => toggle(opt)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-2xs font-semibold transition hover:bg-paper ${
                  isSel ? 'text-fmp' : 'text-ink-2'
                }`}
              >
                <span className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center">
                  {isSel && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate text-left">{opt}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SelectedChips({
  items,
  onRemove,
  onClear,
}: {
  items: { label: string; value: string | number }[];
  onRemove: (val: string | number) => void;
  onClear: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2">
      {items.map((item) => (
        <span
          key={`${item.label}-${item.value}`}
          className="inline-flex items-center gap-1 rounded-full bg-fmp-muted px-2.5 py-1 text-2xs font-semibold text-fmp"
        >
          <span className="text-ink-3">{item.label}:</span>
          {String(item.value)}
          <button
            type="button"
            aria-label={`Remover filtro ${item.label}: ${item.value}`}
            onClick={() => onRemove(item.value)}
            className="ml-0.5 rounded-full p-0.5 transition hover:bg-fmp/20"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-2xs font-semibold text-ink-3 transition hover:bg-sand/30"
      >
        Limpar tudo
      </button>
    </div>
  );
}
