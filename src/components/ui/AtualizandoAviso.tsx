import { RefreshCw } from 'lucide-react';

/**
 * Sinal discreto de que a tela está mostrando o dado guardado enquanto uma
 * versão mais nova é baixada por trás.
 *
 * Deliberadamente discreto: o dado exibido é válido e utilizável, então
 * bloquear a tela ou disparar um alerta seria pior que o problema. O usuário
 * só precisa saber que o número pode mudar em instantes.
 */
export function AtualizandoAviso({ visivel }: { visivel: boolean }) {
  if (!visivel) return null;
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1 text-2xs text-ink-3"
      title="Os dados em tela vieram do cache local e estão sendo atualizados a partir do banco."
    >
      <RefreshCw className="h-3 w-3 animate-spin" />
      Atualizando…
    </span>
  );
}
