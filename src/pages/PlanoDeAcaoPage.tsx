/**
 * Plano de Ação — a LLM lê o painel e devolve o que fazer.
 *
 * Regra que governa esta tela: o público é gestor, não analista, e a curva de
 * aprendizagem alvo é ZERO. Ela é lida como um bilhete curto de um analista
 * competente, não como uma ferramenta de análise (§7 do SPECS).
 *
 * - Coluna única de leitura. NUNCA três painéis simultâneos.
 * - Abre com UMA frase. Ações agrupadas por QUANDO fazer, nunca por P1/P2/P3.
 * - Sigla, slug e nome de tabela não aparecem.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  Lock,
  Send,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSteps } from '@/components/ui/Skeletons';
import { AcaoCard } from '@/components/plano/AcaoCard';
import { usePlanoAgente } from '@/hooks/usePlanoAgente';
import { useAuth } from '@/contexts/AuthContext';
import { PAINEIS_LEGIVEIS } from '@/lib/snapshotRegistry';
import type { DashboardSnapshot } from '@/lib/snapshotTypes';
import type { AcaoProposta, JanelaAcao } from '@/services/planoService';

/** Prazo em vez de prioridade: é a única priorização que se lê sem manual. */
const JANELAS: { id: JanelaAcao; rotulo: string; destaque: boolean }[] = [
  { id: 'esta_semana', rotulo: 'Esta semana', destaque: true },
  { id: 'proximas_semanas', rotulo: 'Nas próximas semanas', destaque: false },
  { id: 'quando_der', rotulo: 'Quando der', destaque: false },
];

const AJUSTES_RAPIDOS = [
  'Deixa só as 3 mais urgentes',
  'Passa tudo para depois do dia 20',
  'Explica de novo, mais simples',
];

export function PlanoDeAcaoPage() {
  const location = useLocation();
  const { perfil } = useAuth();
  const agente = usePlanoAgente();
  const { gerar } = agente;

  const [carregandoPainel, setCarregandoPainel] = useState<string | null>(null);
  const [erroPainel, setErroPainel] = useState<string | null>(null);
  const [pedido, setPedido] = useState('');
  const [memoriaSalva, setMemoriaSalva] = useState(false);

  /** Chegou pelo botão "Gerar plano de ação" de dentro de um painel. */
  const snapshotRecebido = (location.state as { snapshot?: DashboardSnapshot } | null)?.snapshot;

  useEffect(() => {
    if (snapshotRecebido) void gerar(snapshotRecebido);
  }, [snapshotRecebido, gerar]);

  const escolherPainel = useCallback(
    async (slug: string) => {
      const painel = PAINEIS_LEGIVEIS.find((p) => p.slug === slug);
      if (!painel) return;
      setErroPainel(null);
      setCarregandoPainel(slug);
      try {
        const snapshot = await painel.montar();
        await gerar(snapshot);
      } catch {
        setErroPainel('Não foi possível ler esse painel agora. Tente de novo em instantes.');
      } finally {
        setCarregandoPainel(null);
      }
    },
    [gerar],
  );

  const porJanela = useMemo(() => {
    const mapa = new Map<JanelaAcao, AcaoProposta[]>();
    for (const acao of agente.plano?.acoes ?? []) {
      const j: JanelaAcao = JANELAS.some((x) => x.id === acao.janela)
        ? acao.janela
        : 'proximas_semanas';
      mapa.set(j, [...(mapa.get(j) ?? []), acao]);
    }
    return mapa;
  }, [agente.plano]);

  const totalAcoes = agente.plano?.acoes.length ?? 0;
  const responsaveis = new Set(
    (agente.plano?.acoes ?? []).map((a) => a.responsavel_nome).filter(Boolean),
  ).size;
  const ocupado = agente.conversando || agente.gerando;

  const enviarPedido = (texto: string) => {
    const limpo = texto.trim();
    if (!limpo || ocupado) return;
    void agente.perguntar(limpo);
    setPedido('');
  };

  const guardar = async () => {
    if (!agente.memoriaProposta || !perfil) return;
    try {
      await agente.salvarMemoria(agente.memoriaProposta, perfil.id);
      setMemoriaSalva(true);
    } catch {
      setErroPainel('Não foi possível guardar esse contexto.');
    }
  };

  // ---------------------------------------------------------------- início
  if (!agente.plano && !agente.gerando && !agente.erro) {
    return (
      <AppShell title="Plano de Ação" subtitle="A partir dos números dos seus painéis">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-fmp-muted text-fmp">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1
            className="mt-6 text-3xl leading-tight text-ink"
            style={{ fontFamily: '"Noto Serif", Georgia, serif', fontStyle: 'italic', fontWeight: 500 }}
          >
            Eu leio seus painéis e sugiro o que fazer.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-2">
            Escolha um painel. Em alguns segundos eu volto com o que chamou atenção nos números e
            uma lista de ações — cada uma com responsável, prazo e o motivo em português claro.
            <br />
            <br />
            Nada é enviado para ninguém sem você aprovar.
          </p>

          <div className="mt-10 text-left">
            <p className="mb-4 text-2xs font-semibold uppercase tracking-widest text-ink-3">
              De qual painel?
            </p>
            {PAINEIS_LEGIVEIS.map((p) => (
              <button
                key={p.slug}
                type="button"
                disabled={carregandoPainel !== null}
                onClick={() => void escolherPainel(p.slug)}
                className="mb-3 flex w-full items-center gap-4 rounded-md border border-line bg-white p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-fmp hover:shadow-card-hover disabled:opacity-60"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-paper text-ink-2">
                  <BrainCircuit className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-ink">{p.titulo}</span>
                  <span className="block text-sm text-ink-3">{p.sobre}</span>
                </span>
                <ArrowRight className="h-5 w-5 flex-shrink-0 text-ink-3" />
              </button>
            ))}
          </div>

          {carregandoPainel && (
            <div className="mt-6">
              <LoadingSteps mensagem="Lendo os números do painel…" />
            </div>
          )}
          {erroPainel && (
            <div className="mt-6">
              <ErrorState message={erroPainel} onRetry={() => setErroPainel(null)} />
            </div>
          )}

          <p className="mt-10 text-sm leading-relaxed text-ink-3">
            Também dá para começar de dentro de qualquer painel, no botão
            <strong className="text-ink-2"> “Gerar plano de ação”</strong> — assim eu já uso os
            filtros que você aplicou.
          </p>
        </div>
      </AppShell>
    );
  }

  // ---------------------------------------------------------------- plano
  return (
    <AppShell title="Plano de Ação" subtitle={agente.snapshot?.recorte.descricao}>
      <div className="mx-auto max-w-[760px] px-6 pb-24">
        <div className="flex items-center gap-3 py-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-2xs font-medium uppercase tracking-widest text-ink-3 transition hover:text-fmp no-underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Central de Dashboards
          </Link>
        </div>

        {agente.gerando && (
          <LoadingSteps mensagem="Lendo os números, comparando com o período anterior e montando o plano…" />
        )}

        {agente.erro && !agente.plano && (
          <ErrorState
            title="O assistente não respondeu"
            message={agente.erro}
            onRetry={() => agente.recomecar()}
          />
        )}

        {agente.plano && (
          <>
            {/* A frase de abertura: o único elemento acima da dobra que importa. */}
            <p
              className="text-2xl leading-snug text-ink"
              style={{ fontFamily: '"Noto Serif", Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}
            >
              {agente.plano.resumo}
            </p>
            <p className="mt-3 text-sm text-ink-3">
              {totalAcoes} {totalAcoes === 1 ? 'ação' : 'ações'}
              {responsaveis > 0 && ` · ${responsaveis} ${responsaveis === 1 ? 'pessoa' : 'pessoas'}`}
              {' · '}Leia, ajuste o que quiser e envie para a equipe.
            </p>

            {/* Ressalva honesta. Admitir incerteza é o que constrói confiança. */}
            {agente.plano.alerta && (
              <div className="mt-8 flex gap-3 rounded-md border border-warning/40 bg-warning-light p-4">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning" />
                <p className="text-sm leading-relaxed text-warning">{agente.plano.alerta}</p>
              </div>
            )}

            {/* O retorno visível de ensinar: sem isso ninguém ensina duas vezes. */}
            {agente.memoriasConsideradas.length > 0 && (
              <div className="mt-4 flex gap-3 rounded-md border border-success/30 bg-success-light p-4">
                <BrainCircuit className="h-4 w-4 flex-shrink-0 text-success" />
                <div className="text-sm leading-relaxed text-success">
                  <p className="font-semibold">Considerei o que vocês já me ensinaram:</p>
                  <ul className="mt-1 space-y-1">
                    {agente.memoriasConsideradas.map((m) => (
                      <li key={m.id}>— {m.conteudo}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Ações, agrupadas por quando fazer */}
            <div className="mt-10">
              {JANELAS.map((janela) => {
                const acoes = porJanela.get(janela.id) ?? [];
                if (acoes.length === 0) return null;
                return (
                  <section key={janela.id} className="mb-8">
                    <h2
                      className={`mb-3 flex items-center gap-3 text-2xs font-bold uppercase tracking-widest ${
                        janela.destaque ? 'text-fmp-dark' : 'text-ink-3'
                      }`}
                    >
                      {janela.rotulo}
                      <span className="h-px flex-1 bg-line" />
                    </h2>
                    <div className="space-y-3">
                      {acoes.map((acao) => (
                        <AcaoCard
                          key={acao.titulo}
                          acao={acao}
                          snapshot={agente.snapshot}
                          falas={agente.falas[acao.titulo] ?? []}
                          ocupado={ocupado}
                          onContextualizar={(texto) => void agente.contextualizar(acao.titulo, texto)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            {/* Proposta de memória: mostra o texto exato e o alcance ANTES de guardar. */}
            {agente.memoriaProposta && !memoriaSalva && (
              <div className="mt-6 rounded-md border border-success/30 bg-success-light p-5 animate-fade-in">
                <p className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-success">
                  <BrainCircuit className="h-3.5 w-3.5" />
                  Quer que eu guarde isso?
                </p>
                <p
                  className="mt-3 rounded-md border border-success/30 bg-white p-4 text-base leading-relaxed text-ink"
                  style={{ fontFamily: '"Noto Serif", Georgia, serif', fontStyle: 'italic' }}
                >
                  “{agente.memoriaProposta.conteudo}”
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    agente.memoriaProposta.produto,
                    agente.memoriaProposta.area,
                    agente.memoriaProposta.indicador,
                    agente.memoriaProposta.vigente_ate
                      ? `até ${agente.memoriaProposta.vigente_ate.split('-').reverse().join('/')}`
                      : null,
                  ]
                    .filter(Boolean)
                    .map((chip) => (
                      <span
                        key={chip as string}
                        className="rounded-pill border border-success/30 bg-white px-3 py-1 text-xs font-semibold text-success"
                      >
                        {chip}
                      </span>
                    ))}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-success">
                  Se você guardar, eu passo a considerar isso nos próximos planos — e digo, na
                  hora, que estou usando.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void guardar()}
                    className="inline-flex items-center gap-2 rounded-pill bg-success px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    <Check className="h-4 w-4" />
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={agente.descartarMemoria}
                    className="rounded-pill px-4 py-2.5 text-sm text-ink-3 underline underline-offset-4 transition hover:text-ink"
                  >
                    Só desta vez, não guarda
                  </button>
                </div>
              </div>
            )}

            {memoriaSalva && (
              <p
                role="status"
                className="mt-6 flex items-center gap-2 rounded-md border border-success/30 bg-success-light p-4 text-sm text-success"
              >
                <Check className="h-4 w-4" />
                Guardado. Vou considerar isso nos próximos planos deste recorte.
              </p>
            )}

            {/* Fechamento: UM botão primário visível por vez. */}
            <div className="mt-10 rounded-md border border-line bg-white p-6 shadow-card">
              <h3
                className="text-lg text-ink"
                style={{ fontFamily: '"Noto Serif", Georgia, serif', fontStyle: 'italic', fontWeight: 600 }}
              >
                Pronto para enviar?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                O envio para o Teams ainda está sendo ligado. Por enquanto você pode copiar o
                plano ou pedir ajustes aqui embaixo.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled
                  title="Disponível quando o envio para a equipe estiver configurado"
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-pill bg-fmp px-6 py-3 text-sm font-semibold text-white opacity-40"
                >
                  <Send className="h-4 w-4" />
                  Enviar para a equipe
                </button>
                <button
                  type="button"
                  onClick={() => agente.recomecar()}
                  className="rounded-pill border border-line-2 bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:border-fmp hover:text-fmp"
                >
                  Começar de outro painel
                </button>
              </div>
              <p className="mt-4 flex items-center gap-2 text-xs text-ink-3">
                <Lock className="h-3.5 w-3.5" />
                Nada sai daqui sem esse clique.
              </p>
            </div>

            {/* A conversa é convite, não painel: chat sempre aberto é cobrança
                para digitar, e quem não sabe o que perguntar não usa. */}
            <div className="mt-4 rounded-md border border-dashed border-line-2 bg-white p-5">
              <p className="text-sm text-ink-2">
                <strong className="text-ink">Quer mudar alguma coisa no plano inteiro?</strong>{' '}
                Escreva como você falaria com uma pessoa.
              </p>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  enviarPedido(pedido);
                }}
              >
                <input
                  value={pedido}
                  onChange={(e) => setPedido(e.target.value)}
                  disabled={ocupado}
                  placeholder="Ex.: deixa só as 3 mais urgentes"
                  className="flex-1 rounded-pill border border-line bg-paper px-5 py-3 text-sm outline-none transition focus:border-fmp focus:bg-white focus:ring-2 focus:ring-fmp/30"
                />
                <button
                  type="submit"
                  disabled={ocupado || !pedido.trim()}
                  aria-label="Enviar pedido"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-fmp text-white transition hover:bg-fmp-dark disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <div className="mt-3 flex flex-wrap gap-2">
                {AJUSTES_RAPIDOS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={ocupado}
                    onClick={() => enviarPedido(s)}
                    className="rounded-pill border border-line bg-paper px-4 py-2 text-xs font-medium text-ink-2 transition hover:border-fmp hover:bg-white hover:text-fmp disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
              {agente.conversando && (
                <p role="status" className="mt-3 text-xs text-ink-3">
                  Pensando…
                </p>
              )}
              {agente.erro && (
                <p role="alert" className="mt-3 text-xs text-fmp-dark">
                  {agente.erro}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
