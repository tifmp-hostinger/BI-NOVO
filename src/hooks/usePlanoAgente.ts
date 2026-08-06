/**
 * Orquestra a conversa com o agente do Plano de Ação.
 *
 * Mantém a mesma divisão dos hooks de dashboard: o componente cuida da tela, o
 * hook cuida de estado, erro e chamada de rede.
 */

import { useCallback, useState } from 'react';
import {
  conversa,
  guardaMemoria,
  listaEquipe,
  type Colega,
  type MemoriaProposta,
  type PlanoProposto,
  type RespostaAgente,
} from '@/services/planoService';
import type { DashboardSnapshot } from '@/lib/snapshotTypes';

export type MemoriaConsiderada = { id: string; conteudo: string; tipo: string };

/** Uma fala dentro da conversa de uma ação específica. */
export type FalaAcao = { de: 'eu' | 'agente'; texto: string };

type Estado = {
  /** Nada legível na tela ainda. */
  gerando: boolean;
  /** Já há plano e uma resposta está a caminho. */
  conversando: boolean;
  erro: string | null;
  plano: PlanoProposto | null;
  resposta: string;
  memoriasConsideradas: MemoriaConsiderada[];
  memoriaProposta: MemoriaProposta | null;
  conversaId: string | null;
};

const INICIAL: Estado = {
  gerando: false,
  conversando: false,
  erro: null,
  plano: null,
  resposta: '',
  memoriasConsideradas: [],
  memoriaProposta: null,
  conversaId: null,
};

const PEDIDO_INICIAL =
  'Olhe este recorte, diga em uma frase o que mais chama atenção e monte um plano de ação. ' +
  'Use listar_equipe para atribuir responsáveis e propor_plano para entregar o resultado.';

export function usePlanoAgente() {
  const [estado, setEstado] = useState<Estado>(INICIAL);
  const [snapshots, setSnapshots] = useState<Record<string, DashboardSnapshot>>({});
  const [slugAtivo, setSlugAtivo] = useState<string>('');
  const [equipe, setEquipe] = useState<Colega[]>([]);
  /** Conversa por ação, indexada pelo título — o card guarda o próprio fio. */
  const [falas, setFalas] = useState<Record<string, FalaAcao[]>>({});

  const aplica = useCallback((r: RespostaAgente, sufixo?: { acao: string; pergunta: string }) => {
    setEstado((s) => ({
      ...s,
      gerando: false,
      conversando: false,
      erro: null,
      // Turno que não devolve plano novo mantém o que já está na tela: perder o
      // plano porque a pessoa fez uma pergunta lateral seria péssimo.
      plano: r.plano ?? s.plano,
      resposta: r.resposta || s.resposta,
      memoriasConsideradas: r.memorias_consideradas ?? s.memoriasConsideradas,
      memoriaProposta: r.memoria_proposta ?? null,
      conversaId: r.conversa_id ?? s.conversaId,
    }));
    if (sufixo) {
      setFalas((f) => ({
        ...f,
        [sufixo.acao]: [
          ...(f[sufixo.acao] ?? []),
          { de: 'eu', texto: sufixo.pergunta },
          { de: 'agente', texto: r.resposta },
        ],
      }));
    }
  }, []);

  /** Ponto de entrada: recebe o snapshot do painel e pede o primeiro plano. */
  const gerar = useCallback(
    async (snapshot: DashboardSnapshot) => {
      const mapa = { [snapshot.slug]: snapshot };
      setSnapshots(mapa);
      setSlugAtivo(snapshot.slug);
      setEstado({ ...INICIAL, gerando: true });
      setFalas({});

      // A equipe é buscada em paralelo: a tela precisa dela para casar o nome
      // que o agente sugeriu com uma pessoa real na hora de salvar.
      const pedidoEquipe = listaEquipe().catch(() => [] as Colega[]);

      try {
        const r = await conversa({
          mensagem: PEDIDO_INICIAL,
          slugAtivo: snapshot.slug,
          snapshots: mapa,
        });
        setEquipe(await pedidoEquipe);
        // Sem plano e sem texto, `aplica` deixaria o estado idêntico ao
        // inicial — e a página cairia de volta na escolha de painel, como se
        // o clique não tivesse acontecido. Erro explícito é melhor que sumiço.
        if (!r.plano && !r.resposta) {
          setEstado((s) => ({
            ...s,
            gerando: false,
            erro: 'O assistente não conseguiu montar um plano deste recorte. Tente de novo.',
          }));
          return;
        }
        aplica(r);
      } catch (err) {
        setEstado((s) => ({
          ...s,
          gerando: false,
          erro: err instanceof Error ? err.message : 'Não foi possível falar com o assistente.',
        }));
      }
    },
    [aplica],
  );

  /** Mensagem livre sobre o plano inteiro. */
  const perguntar = useCallback(
    async (mensagem: string) => {
      if (!slugAtivo) return;
      setEstado((s) => ({ ...s, conversando: true, erro: null }));
      try {
        const r = await conversa({
          mensagem,
          slugAtivo,
          snapshots,
          conversaId: estado.conversaId,
        });
        aplica(r);
      } catch (err) {
        setEstado((s) => ({
          ...s,
          conversando: false,
          erro: err instanceof Error ? err.message : 'Não foi possível falar com o assistente.',
        }));
      }
    },
    [aplica, estado.conversaId, slugAtivo, snapshots],
  );

  /** Contexto dado sobre uma ação específica — é assim que a equipe ensina. */
  const contextualizar = useCallback(
    async (tituloAcao: string, texto: string) => {
      if (!slugAtivo) return;
      setEstado((s) => ({ ...s, conversando: true, erro: null }));
      try {
        const r = await conversa({
          // O agente precisa saber de qual ação se fala para propor a memória
          // com o escopo certo.
          mensagem: `Sobre a ação "${tituloAcao}": ${texto}`,
          slugAtivo,
          snapshots,
          conversaId: estado.conversaId,
        });
        aplica(r, { acao: tituloAcao, pergunta: texto });
      } catch (err) {
        setEstado((s) => ({
          ...s,
          conversando: false,
          erro: err instanceof Error ? err.message : 'Não foi possível falar com o assistente.',
        }));
      }
    },
    [aplica, estado.conversaId, slugAtivo, snapshots],
  );

  /** Grava a memória que a pessoa confirmou. Entra sempre como proposta. */
  const salvarMemoria = useCallback(
    async (memoria: MemoriaProposta, ensinadoPor: string) => {
      await guardaMemoria(memoria, ensinadoPor);
      setEstado((s) => ({ ...s, memoriaProposta: null }));
    },
    [],
  );

  const descartarMemoria = useCallback(() => {
    setEstado((s) => ({ ...s, memoriaProposta: null }));
  }, []);

  const recomecar = useCallback(() => {
    setEstado(INICIAL);
    setSnapshots({});
    setSlugAtivo('');
    setFalas({});
  }, []);

  return {
    ...estado,
    snapshot: snapshots[slugAtivo] ?? null,
    equipe,
    falas,
    gerar,
    perguntar,
    contextualizar,
    salvarMemoria,
    descartarMemoria,
    recomecar,
  };
}
