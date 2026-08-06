import { createClient } from '@supabase/supabase-js';
import { leConfig } from '@/lib/runtimeConfig';

// Runtime (/config.js, gerado no boot do container) tem precedência sobre o
// valor embutido no build — ver src/lib/runtimeConfig.ts.
const supabaseUrl = leConfig('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL).valor;
const supabaseAnonKey = leConfig(
  'VITE_SUPABASE_ANON_KEY',
  import.meta.env.VITE_SUPABASE_ANON_KEY,
).valor;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // A plataforma agora exige login: a sessão precisa sobreviver a um F5, e o
    // token de acesso precisa ser renovado sozinho antes de expirar — sem isso
    // o usuário cairia para a tela de login no meio do uso.
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'fmp-bi-sessao',
  },
});

export type Dashboard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type UserCep = {
  id: string;
  cep: string;
  city: string;
  state: string;
  region: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  age_group: string;
  enrollment_status: 'active' | 'prospect' | 'alumni';
  program: string;
  intensity: number;
  created_at: string;
};
