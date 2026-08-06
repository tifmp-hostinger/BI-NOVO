import { MultiSelect } from '@/components/ui/MultiSelect';
import type { ConversaoFilters, FilterOptions } from '../types';
import { ANOS } from '../constants';

type Props = {
  options: FilterOptions;
  filters: ConversaoFilters;
  onCodperletChange: (v: string[]) => void;
  onAnoChange: (v: number[]) => void;
  onMesChange: (v: number[]) => void;
  onDataInicioChange: (v: string | null) => void;
  onDataFimChange: (v: string | null) => void;
};

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

export function ConversaoFilterBar({
  options,
  filters,
  onCodperletChange,
  onAnoChange,
  onMesChange,
  onDataInicioChange,
  onDataFimChange,
}: Props) {
  return (
    <div className="relative z-20 rounded-md border border-line bg-white p-4 shadow-card animate-fade-in">
      <div className="flex flex-wrap items-center gap-4">
        <MultiSelect
          label="Periodo Letivo"
          options={options.codperletOptions}
          selected={filters.codperlet}
          onChange={(next) => onCodperletChange(next.map(String))}
          widthClass="min-w-[150px]"
        />

        <div className="flex flex-col gap-1">
          <span className="text-2xs font-semibold uppercase tracking-widest text-ink-3">
            Ano
          </span>
          <div className="flex items-center gap-1" role="group" aria-label="Filtro de ano">
            {ANOS.map((ano) => (
              <button
                key={ano}
                type="button"
                aria-pressed={filters.ano.includes(ano)}
                onClick={() => onAnoChange(toggle(filters.ano, ano))}
                className={`rounded-pill px-3 py-1.5 text-2xs font-semibold transition ${
                  filters.ano.includes(ano)
                    ? 'bg-fmp text-white'
                    : 'bg-paper text-ink-2 hover:bg-line'
                }`}
              >
                {ano}
              </button>
            ))}
          </div>
        </div>

        <MultiSelect
          label="Mes"
          options={options.mesOptions.map((m) => m.nome)}
          selected={filters.mes
            .map((n) => options.mesOptions.find((m) => m.numero === n)?.nome)
            .filter((n): n is string => !!n)}
          onChange={(next) => {
            const nomes = new Set(next.map(String));
            onMesChange(
              options.mesOptions.filter((m) => nomes.has(m.nome)).map((m) => m.numero),
            );
          }}
          widthClass="min-w-[150px]"
        />

        <div className="flex flex-col gap-1">
          <label
            htmlFor="filtro-data-inicio"
            className="text-2xs font-semibold uppercase tracking-widest text-ink-3"
          >
            Data Inicio
          </label>
          <input
            id="filtro-data-inicio"
            type="date"
            className="rounded-sm border border-line bg-paper px-3 py-2 text-xs text-ink focus:border-fmp focus:outline-none"
            value={filters.dataInicio ?? ''}
            onChange={(e) => onDataInicioChange(e.target.value || null)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="filtro-data-fim"
            className="text-2xs font-semibold uppercase tracking-widest text-ink-3"
          >
            Data Fim
          </label>
          <input
            id="filtro-data-fim"
            type="date"
            className="rounded-sm border border-line bg-paper px-3 py-2 text-xs text-ink focus:border-fmp focus:outline-none"
            value={filters.dataFim ?? ''}
            onChange={(e) => onDataFimChange(e.target.value || null)}
          />
        </div>

        {(filters.codperlet.length > 0 ||
          filters.ano.length > 0 ||
          filters.mes.length > 0 ||
          filters.dataInicio ||
          filters.dataFim) && (
          <button
            type="button"
            onClick={() => {
              onCodperletChange([]);
              onAnoChange([]);
              onMesChange([]);
              onDataInicioChange(null);
              onDataFimChange(null);
            }}
            className="mt-5 rounded-pill bg-paper px-3 py-2 text-2xs font-semibold text-ink-2 transition hover:bg-line"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
