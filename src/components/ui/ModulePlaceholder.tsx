import { Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';

type Props = {
  title: string;
  description?: string;
};

export function ModulePlaceholder({ title, description }: Props) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center animate-fade-in">
      <div className="rounded-md border border-line bg-white p-4 shadow-card">
        <div className="rounded-sm bg-fmp-muted p-4">
          <Wrench className="h-8 w-8 text-fmp" strokeWidth={2} />
        </div>
      </div>
      <h2
        className="mt-6 text-xl text-ink"
        style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
      >
        {title}
      </h2>
      {description && <p className="mt-2 max-w-md text-sm text-ink-3">{description}</p>}
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-1.5 rounded-pill bg-fmp px-4 py-2 text-xs font-medium text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-fmp-dark no-underline"
      >
        Voltar para o inicio
      </Link>
    </div>
  );
}
