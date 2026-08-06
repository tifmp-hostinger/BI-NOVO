import { MultiSelect, SelectedChips } from '@/components/ui/MultiSelect';
import type { FilterOptions } from '../types';

type Props = {
  options: FilterOptions | null;
  codperlet: string[];
  ano: number[];
  tipocurso: string[];
  bolsaPadronizada: string[];
  onCodperletChange: (v: string[]) => void;
  onAnoChange: (v: number[]) => void;
  onTipocursoChange: (v: string[]) => void;
  onBolsaPadronizadaChange: (v: string[]) => void;
};

export function BolsasFilterBar({
  options,
  codperlet,
  ano,
  tipocurso,
  bolsaPadronizada,
  onCodperletChange,
  onAnoChange,
  onTipocursoChange,
  onBolsaPadronizadaChange,
}: Props) {
  const chips: { label: string; value: string | number }[] = [
    ...codperlet.map((v) => ({ label: 'Período', value: v })),
    ...ano.map((v) => ({ label: 'Ano', value: v })),
    ...tipocurso.map((v) => ({ label: 'Nível', value: v })),
    ...bolsaPadronizada.map((v) => ({ label: 'Benefício', value: v })),
  ];

  const handleRemove = (val: string | number) => {
    if (codperlet.includes(val as string)) onCodperletChange(codperlet.filter((v) => v !== val));
    else if (ano.includes(val as number)) onAnoChange(ano.filter((v) => v !== val));
    else if (tipocurso.includes(val as string)) onTipocursoChange(tipocurso.filter((v) => v !== val));
    else if (bolsaPadronizada.includes(val as string)) onBolsaPadronizadaChange(bolsaPadronizada.filter((v) => v !== val));
  };

  const handleClearAll = () => {
    onCodperletChange([]);
    onAnoChange([]);
    onTipocursoChange([]);
    onBolsaPadronizadaChange([]);
  };

  return (
    <section className="relative z-20 flex flex-col gap-3 rounded-md border border-line bg-white p-4 shadow-card animate-fade-in">
      <div className="flex flex-wrap items-end gap-3">
        <MultiSelect
          label="Período"
          options={options?.codperletOptions ?? []}
          selected={codperlet}
          onChange={(v) => onCodperletChange(v.filter((x): x is string => typeof x === 'string'))}
        />
        <MultiSelect
          label="Ano"
          options={options?.anoOptions ?? []}
          selected={ano}
          onChange={(v) => onAnoChange(v.filter((x): x is number => typeof x === 'number'))}
        />
        <MultiSelect
          label="Nível"
          options={options?.tipocursoOptions ?? []}
          selected={tipocurso}
          onChange={(v) => onTipocursoChange(v.filter((x): x is string => typeof x === 'string'))}
        />
        <MultiSelect
          label="Benefício"
          options={options?.bolsaPadronizadaOptions ?? []}
          selected={bolsaPadronizada}
          onChange={(v) => onBolsaPadronizadaChange(v.filter((x): x is string => typeof x === 'string'))}
          widthClass="min-w-[220px]"
        />
      </div>
      <SelectedChips items={chips} onRemove={handleRemove} onClear={handleClearAll} />
    </section>
  );
}
