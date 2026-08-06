import type { Dashboard } from '@/lib/supabase';

export const SAMPLE_DASHBOARDS: Dashboard[] = [
  {
    id: '1',
    slug: 'presenca-nacional',
    title: 'Presenca Nacional',
    description:
      'Mapa de calor e drill-down por estado das matriculas de Pos-graduacao e Cursos Livres.',
    icon: 'MapPin',
    color: 'fmp',
    category: 'Geolocalizacao',
    is_active: true,
    sort_order: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: '7',
    slug: 'analise-conversao-presidencia',
    title: 'Analise de Conversao - Presidencia',
    description:
      'Funil comercial academico: Graduacao, Mestrado e Especializacoes com paridade de regras Power BI.',
    icon: 'Target',
    color: 'fmp',
    category: 'Presidencia',
    is_active: true,
    sort_order: 2,
    created_at: new Date().toISOString(),
  },
  {
    id: '8',
    slug: 'bolsas-e-descontos',
    title: 'Bolsas e Descontos - Performance e Retenção',
    description:
      'Visão geral de matrículas, bolsas, descontos, faturamento e evasão relacionada a benefícios financeiros.',
    icon: 'Percent',
    color: 'fmp',
    category: 'Financeiro',
    is_active: true,
    sort_order: 3,
    created_at: new Date().toISOString(),
  },
  {
    id: '9',
    slug: 'analise-de-conversao',
    title: 'Analise de Conversao',
    description:
      'Funil comercial completo: leads, inscricoes e matriculas por processo (Graduacao, Especializacoes, Mestrado e Cursos Livres).',
    icon: 'Target',
    color: 'fmp',
    category: 'Comercial',
    is_active: true,
    sort_order: 4,
    created_at: new Date().toISOString(),
  },
  {
    id: '10',
    slug: 'growth-e-performance',
    title: 'Growth e Performance',
    description:
      'Midia paga (Google + Meta) cruzada com o funil de captacao, segmentada por produto.',
    icon: 'TrendingUp',
    color: 'fmp',
    category: 'Comercial',
    is_active: true,
    sort_order: 5,
    created_at: new Date().toISOString(),
  },
];
