import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeEspecializacoesKpis,
  computeGraduacaoKpis,
  computeMestradoKpis,
  graduacaoDateRangeFromPletivos,
} from '../calculations';
import { FONTES_POR_DASHBOARD, ritmoDoDataset, type RitmoFonte } from '@/lib/dataFreshness';
import { carregaComCache } from '@/lib/carregaComCache';
import { leCache } from '@/lib/datasetCache';
import {
  fetchInscricoesGraduacao,
  fetchInscricoesMestrado,
  fetchMatriculasGraduacao,
  fetchMatriculasMestrado,
  fetchMatriculasPos,
  fetchRubeusLeadsGraduacao,
  fetchRubeusLeadsMestrado,
  listMetasMestrado,
  listMetasPos,
  listPletivos,
} from '../queries';
import type {
  EspecializacoesKpis,
  GraduacaoKpis,
  InscricaoRow,
  MatriculaGradRow,
  MatriculaMestradoRow,
  MatriculaPosRow,
  MestradoKpis,
  MetaMestrado,
  MetaPos,
  PeriodoLetivo,
} from '../types';

const CHAVE_CACHE = 'analise-conversao-presidencia';

type LeadsRubeus = {
  gradAtual: Awaited<ReturnType<typeof fetchRubeusLeadsGraduacao>>;
  gradAnterior: Awaited<ReturnType<typeof fetchRubeusLeadsGraduacao>>;
  mestrado: Awaited<ReturnType<typeof fetchRubeusLeadsMestrado>>;
};

type BaseData = {
  pletivos: PeriodoLetivo[];
  metaMestrado: MetaMestrado[];
  metaPos: MetaPos[];
  inscricoesGrad: InscricaoRow[];
  inscricoesMest: InscricaoRow[];
  matriculasGrad: MatriculaGradRow[];
  matriculasMest: MatriculaMestradoRow[];
  matriculasPos: MatriculaPosRow[];
};

/** Chave do cache dos leads do Rubeus — muda com a seleção do usuário. */
function chaveRubeus(periodoAtual: string, periodoAnterior: string, anoMestrado: number): string {
  return `${CHAVE_CACHE}:rubeus:${periodoAtual}|${periodoAnterior}|${anoMestrado}`;
}

/**
 * Seleção padrão de períodos da Graduação (a mesma aplicada quando a tela
 * abre). Compartilhada entre a página e o aquecimento: se divergissem, o
 * aquecedor esquentaria uma combinação que a tela nunca pede.
 */
export function escolhePeriodosPadrao(pletivos: { periodo: string }[]): {
  atual: string;
  anterior: string;
} {
  const validos = pletivos.map((p) => p.periodo).filter((p) => /^\d{2}-\d{2}$/.test(p));
  return { atual: validos[0] ?? '26-01', anterior: validos[1] ?? '25-02' };
}

type FaixaGrad = { dataInicio: string; dataFim: string } | null;

/** Download dos leads do Rubeus para uma seleção — compartilhado com o aquecimento. */
async function baixarLeadsRubeus(
  rangeAtual: FaixaGrad,
  rangeAnterior: FaixaGrad,
  anoMestrado: number,
): Promise<LeadsRubeus> {
  const [gradAtual, gradAnterior, mestrado] = await Promise.all([
    rangeAtual
      ? fetchRubeusLeadsGraduacao(rangeAtual.dataInicio, rangeAtual.dataFim)
      : Promise.resolve([]),
    rangeAnterior
      ? fetchRubeusLeadsGraduacao(rangeAnterior.dataInicio, rangeAnterior.dataFim)
      : Promise.resolve([]),
    fetchRubeusLeadsMestrado(anoMestrado),
  ]);
  return { gradAtual, gradAnterior, mestrado };
}

/**
 * Aquece os leads do Rubeus para a SELEÇÃO PADRÃO (a que a tela usa ao
 * abrir). Sem isto o painel abria com a base instantânea mas ainda fazia um
 * download para os cartões de leads. Lê a base do cache — o aquecedor só
 * chama depois de garantir a base quente.
 */
export async function aqueceLeadsRubeusPadrao(): Promise<void> {
  const entrada = await leCache<BaseData>(CHAVE_CACHE);
  const base = entrada?.dataset;
  if (!base) return;
  const { atual, anterior } = escolhePeriodosPadrao(base.pletivos);
  const anoMestrado = new Date().getFullYear();
  await carregaComCache<LeadsRubeus>({
    chave: chaveRubeus(atual, anterior, anoMestrado),
    tabelas: ['rubeus_registros_personalizada'],
    baixar: () =>
      baixarLeadsRubeus(
        graduacaoDateRangeFromPletivos(base.pletivos, atual),
        graduacaoDateRangeFromPletivos(base.pletivos, anterior),
        anoMestrado,
      ),
    mostrar: () => {},
    apenasAquecer: true,
  });
}

/**
 * Download completo da base do painel. Exportado para o aquecimento em
 * segundo plano (aqueceDashboards) usar EXATAMENTE a mesma montagem que a
 * tela — se divergissem, o aquecedor gravaria um cache que o hook não sabe
 * ler, uma falha silenciosa.
 */
export async function baixarBasePresidencia(): Promise<BaseData> {
  const [
    pletivos,
    metaMestrado,
    metaPos,
    inscricoesGrad,
    inscricoesMest,
    matriculasGrad,
    matriculasMest,
    matriculasPos,
  ] = await Promise.all([
    listPletivos(),
    listMetasMestrado(),
    listMetasPos(),
    fetchInscricoesGraduacao(),
    fetchInscricoesMestrado(),
    fetchMatriculasGraduacao(),
    fetchMatriculasMestrado(),
    fetchMatriculasPos(),
  ]);
  return {
    pletivos,
    metaMestrado,
    metaPos,
    inscricoesGrad,
    inscricoesMest,
    matriculasGrad,
    matriculasMest,
    matriculasPos,
  };
}

export function useAnaliseConversaoData(options: {
  periodoGradAtual: string;
  periodoGradAnterior: string;
  anoMestrado: number;
  anoPos: number;
  mesesPos: number[];
}) {
  const {
    periodoGradAtual,
    periodoGradAnterior,
    anoMestrado,
    anoPos,
    mesesPos,
  } = options;

  const [base, setBase] = useState<BaseData | null>(null);
  const [baseLoading, setBaseLoading] = useState(true);
  const [baseError, setBaseError] = useState<string | null>(null);

  const [rubeusGradAtual, setRubeusGradAtual] = useState<GraduacaoKpis['leads'] | null>(null);
  const [rubeusGradAnterior, setRubeusGradAnterior] = useState<GraduacaoKpis['leads'] | null>(null);
  const [rubeusMestrado, setRubeusMestrado] = useState<MestradoKpis['leads'] | null>(null);

  const [rubeusLoading, setRubeusLoading] = useState(false);
  const [rubeusError, setRubeusError] = useState<string | null>(null);

  // Nota: como o denominador da conversao da Graduacao usa o nome_lead vindo do
  // Rubeus (nao apenas a contagem), guardamos os arrays reais tambem.
  const [rubeusGradAtualRows, setRubeusGradAtualRows] = useState<
    Awaited<ReturnType<typeof fetchRubeusLeadsGraduacao>>
  >([]);
  const [rubeusGradAnteriorRows, setRubeusGradAnteriorRows] = useState<
    Awaited<ReturnType<typeof fetchRubeusLeadsGraduacao>>
  >([]);
  const [rubeusMestradoRows, setRubeusMestradoRows] = useState<
    Awaited<ReturnType<typeof fetchRubeusLeadsMestrado>>
  >([]);

  const [revalidando, setRevalidando] = useState(false);

  const loadBase = useCallback(async (forcar = false) => {
    setBaseLoading(true);
    setBaseError(null);
    try {
      await carregaComCache<BaseData>({
        chave: CHAVE_CACHE,
        tabelas: FONTES_POR_DASHBOARD['analise-conversao-presidencia'],
        forcar,
        baixar: baixarBasePresidencia,
        mostrar: (dados) => {
          setBase(dados);
          setBaseLoading(false);
        },
        aoIniciarDownload: (temDadoNaTela) => {
          setBaseLoading(!temDadoNaTela);
          setRevalidando(temDadoNaTela);
        },
      });
    } catch (err) {
      // Não zera `base`: se veio do cache, o usuário segue com dado válido.
      setBaseError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setBaseLoading(false);
      setRevalidando(false);
    }
  }, []);

  useEffect(() => {
    loadBase(false);
  }, [loadBase]);

  // Rubeus depende dos pletivos (faixa de datas da graduacao) e do ano do
  // mestrado. Como o resultado muda conforme a SELECAO do usuario, o cache e
  // por combinacao — sem isso, 3 dos 4 cartoes desta tela continuariam
  // carregando a cada visita mesmo com a base vinda do cache.
  useEffect(() => {
    if (!base) return;
    let cancelled = false;
    async function run() {
      setRubeusLoading(true);
      setRubeusError(null);
      try {
        const rangeAtual = graduacaoDateRangeFromPletivos(
          base!.pletivos,
          periodoGradAtual
        );
        const rangeAnterior = graduacaoDateRangeFromPletivos(
          base!.pletivos,
          periodoGradAnterior
        );

        await carregaComCache<LeadsRubeus>({
          chave: chaveRubeus(periodoGradAtual, periodoGradAnterior, anoMestrado),
          tabelas: ['rubeus_registros_personalizada'],
          baixar: () => baixarLeadsRubeus(rangeAtual, rangeAnterior, anoMestrado),
          mostrar: ({ gradAtual, gradAnterior, mestrado }) => {
            if (cancelled) return;
            setRubeusGradAtualRows(gradAtual);
            setRubeusGradAnteriorRows(gradAnterior);
            setRubeusMestradoRows(mestrado);
            setRubeusGradAtual(gradAtual.length);
            setRubeusGradAnterior(gradAnterior.length);
            setRubeusMestrado(mestrado.length);
            setRubeusLoading(false);
          },
        });
      } catch (err) {
        if (cancelled) return;
        setRubeusError(err instanceof Error ? err.message : 'Erro ao carregar leads');
      } finally {
        if (!cancelled) setRubeusLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [base, periodoGradAtual, periodoGradAnterior, anoMestrado]);

  const graduacaoAtual: GraduacaoKpis | null = useMemo(() => {
    if (!base) return null;
    const pletivo = base.pletivos.find((p) => p.periodo === periodoGradAtual) ?? null;
    return computeGraduacaoKpis(
      periodoGradAtual,
      pletivo,
      rubeusGradAtualRows,
      base.inscricoesGrad,
      base.matriculasGrad
    );
  }, [base, periodoGradAtual, rubeusGradAtualRows]);

  const graduacaoAnterior: GraduacaoKpis | null = useMemo(() => {
    if (!base) return null;
    const pletivo = base.pletivos.find((p) => p.periodo === periodoGradAnterior) ?? null;
    return computeGraduacaoKpis(
      periodoGradAnterior,
      pletivo,
      rubeusGradAnteriorRows,
      base.inscricoesGrad,
      base.matriculasGrad
    );
  }, [base, periodoGradAnterior, rubeusGradAnteriorRows]);

  const mestrado: MestradoKpis | null = useMemo(() => {
    if (!base) return null;
    const meta = base.metaMestrado.find((m) => m.ano === anoMestrado) ?? null;
    return computeMestradoKpis(
      anoMestrado,
      meta,
      rubeusMestradoRows,
      base.inscricoesMest,
      base.matriculasMest
    );
  }, [base, anoMestrado, rubeusMestradoRows]);

  const especializacoes: EspecializacoesKpis | null = useMemo(() => {
    if (!base) return null;
    return computeEspecializacoesKpis(
      anoPos,
      mesesPos,
      base.metaPos,
      base.matriculasPos
    );
  }, [base, anoPos, mesesPos]);

  /**
   * Proxy de frescor por tabela, sobre o dataset SEM filtro de usuário
   * (base é o download completo) — nunca dispara consulta nova.
   */
  const freshnessRitmos = useMemo((): Record<string, RitmoFonte> => {
    if (!base) return {};
    return {
      stg_rm_matriculas_grad: ritmoDoDataset(base.matriculasGrad, 'datamatricula'),
      stg_rm_matriculas_mestrado: ritmoDoDataset(base.matriculasMest, 'datamatricula'),
      stg_rm_matriculas_pos: ritmoDoDataset(base.matriculasPos, 'datadematricula'),
      stg_rm_inscricoes_graduacao: ritmoDoDataset(base.inscricoesGrad, 'datainscricao'),
      stg_rm_inscricoes_mestrado: ritmoDoDataset(base.inscricoesMest, 'datainscricao'),
    };
  }, [base]);

  return {
    base,
    loading: baseLoading,
    error: baseError,
    rubeusLoading,
    rubeusError,
    revalidando,
    // Botão "Atualizar": ignora o cache de propósito.
    refetch: () => loadBase(true),
    graduacaoAtual,
    graduacaoAnterior,
    mestrado,
    especializacoes,
    freshnessRitmos,
    // exposto para debug/telemetria
    rubeusCounts: {
      gradAtual: rubeusGradAtual,
      gradAnterior: rubeusGradAnterior,
      mestrado: rubeusMestrado,
    },
  };
}
