import { AlertTriangle, RefreshCw } from 'lucide-react';

type Props = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = 'Nao foi possivel carregar',
  message = 'Ocorreu um problema ao buscar os dados. Tente novamente em instantes.',
  onRetry,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-fmp/30 bg-fmp-muted p-8 text-center animate-fade-in">
      <div className="rounded-full bg-white p-3 shadow-card">
        <AlertTriangle className="h-6 w-6 text-fmp" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-fmp-dark">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-ink-3">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-pill bg-fmp px-4 py-1.5 text-xs font-medium text-white transition-all hover:bg-fmp-dark"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </button>
      )}
    </div>
  );
}
