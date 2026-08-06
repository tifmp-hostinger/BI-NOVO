/**
 * Card de uma ação do plano.
 *
 * Mostra TRÊS coisas e nada mais: o que fazer, quem faz, até quando. Todo o
 * resto — números, comparação, origem — fica atrás do `por quê?`, fechado por
 * padrão, e abre com texto ANTES de número. Tabela de indicador como primeira
 * coisa é o que faz gestor fechar a tela (§7.3 do SPECS).
 */

import { useState } from 'react';
import { ChevronDown, Clock, MessageCircle, Send, AlertTriangle } from 'lucide-react';
import { formataEsforco, formataIndicador, type DashboardSnapshot } from '@/lib/snapshotTypes';
import type { AcaoProposta } from '@/services/planoService';
import type { FalaAcao } from '@/hooks/usePlanoAgente';

type Props = {
  acao: AcaoProposta;
  snapshot: DashboardSnapshot | null;
  falas: FalaAcao[];
  ocupado: boolean;
  onContextualizar: (texto: string) => void;
};

/** Iniciais do responsável para o avatar ("Camila Menezes" → CM). */
function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

const SUGESTOES = [
  'Isso não se aplica aqui, e explico por quê',
  'Já tentamos isso antes',
  'O responsável está errado',
];

export function AcaoCard({ acao, snapshot, falas, ocupado, onContextualizar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [conversando, setConversando] = useState(false);
  const [texto, setTexto] = useState('');

  const indicador = snapshot?.indicadores.find((i) => i.chave === acao.evidencia?.indicador);
  const incerto = indicador?.amostraPequena === true;
  const esforco = formataEsforco(acao.esforco_horas);

  const enviar = (valor: string) => {
    const limpo = valor.trim();
    if (!limpo || ocupado) return;
    onContextualizar(limpo);
    setTexto('');
  };

  return (
    <article
      className={`overflow-hidden rounded-md border shadow-card transition-shadow hover:shadow-card-hover ${
        incerto ? 'border-warning/40 bg-warning-light' : 'border-line bg-white'
      }`}
    >
      <div className="p-5">
        {/* Topo: título + o botão de ensinar contexto */}
        <div className="flex items-start gap-4">
          <h3 className="flex-1 text-base font-semibold leading-snug text-ink">{acao.titulo}</h3>
          <button
            type="button"
            onClick={() => setConversando((v) => !v)}
            aria-expanded={conversando}
            className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-semibold transition ${
              conversando
                ? 'border-ink bg-ink text-cream'
                : 'border-line bg-paper text-ink-2 hover:border-fmp hover:bg-white hover:text-fmp'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {conversando ? 'Fechar conversa' : 'Dar contexto'}
            {falas.length > 0 && !conversando && (
              <span className="rounded-pill bg-success px-1.5 text-2xs font-bold text-white">
                {falas.length / 2}
              </span>
            )}
          </button>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-ink-2">{acao.descricao}</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {acao.responsavel_nome && (
            <span className="inline-flex items-center gap-2 rounded-pill border border-line bg-paper py-1 pl-1 pr-3 text-sm text-ink-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-2xs font-semibold text-white">
                {iniciais(acao.responsavel_nome)}
              </span>
              {acao.responsavel_nome}
            </span>
          )}
          {esforco && <span className="text-sm text-ink-3">{esforco}</span>}
          {incerto && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              ainda não dá para decidir
            </span>
          )}

          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-fmp-dark transition hover:text-fmp"
          >
            por quê?
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${aberto ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Por quê? — texto primeiro, número depois. */}
      {aberto && (
        <div className="border-t border-line bg-paper p-5 animate-fade-in">
          {indicador ? (
            <>
              <p className="text-sm leading-relaxed text-ink-2">
                {indicador.glossario ??
                  `Esta ação saiu do indicador "${indicador.rotulo}" no recorte ${snapshot?.recorte.descricao}.`}
              </p>
              <div className="mt-4 inline-flex flex-col rounded-md border border-fmp/25 bg-fmp-muted px-4 py-3">
                <span className="text-2xs font-semibold uppercase tracking-widest text-ink-3">
                  {indicador.rotulo}
                </span>
                <span
                  className="mt-1 text-xl text-fmp-dark"
                  style={{ fontFamily: '"Noto Serif", Georgia, serif', fontStyle: 'italic', fontWeight: 600 }}
                >
                  {formataIndicador(indicador.valor, indicador.unidade)}
                </span>
              </div>
              {incerto && (
                <p className="mt-3 text-sm text-warning">
                  O próprio painel avisa que este recorte tem poucas pessoas para sustentar
                  conclusão. Vale medir melhor antes de mexer.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm leading-relaxed text-ink-2">
              Esta ação nasceu de algo que a equipe ensinou, não de um número do painel.
            </p>
          )}
        </div>
      )}

      {/* Conversa sobre esta ação — é assim que a equipe ensina o contexto. */}
      {conversando && (
        <div className="border-t border-line bg-base p-5 animate-fade-in">
          <p className="text-2xs font-semibold uppercase tracking-widest text-ink-3">
            Conversa sobre esta ação
          </p>

          {falas.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              {falas.map((f, i) => (
                <p
                  key={i}
                  className={`max-w-[88%] rounded-md px-4 py-3 text-sm leading-relaxed ${
                    f.de === 'eu'
                      ? 'self-end bg-ink text-cream'
                      : 'self-start border border-line bg-white text-ink-2'
                  }`}
                >
                  {f.texto}
                </p>
              ))}
            </div>
          )}

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              enviar(texto);
            }}
          >
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={ocupado}
              placeholder="Explique como funciona aqui — ela guarda para os próximos planos"
              className="flex-1 rounded-pill border border-line bg-white px-4 py-2.5 text-sm outline-none transition focus:border-fmp focus:ring-2 focus:ring-fmp/30"
            />
            <button
              type="submit"
              disabled={ocupado || !texto.trim()}
              aria-label="Enviar"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-fmp text-white transition hover:bg-fmp-dark disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          {falas.length === 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={ocupado}
                  onClick={() => enviar(s)}
                  className="rounded-pill border border-line bg-white px-3 py-1.5 text-xs text-ink-2 transition hover:border-fmp hover:text-fmp disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {ocupado && (
            <p role="status" className="mt-3 flex items-center gap-2 text-xs text-ink-3">
              <Clock className="h-3.5 w-3.5 animate-pulse" />
              Pensando…
            </p>
          )}
        </div>
      )}
    </article>
  );
}
