/**
 * Configuração da aplicação com duas origens possíveis, nesta ordem:
 *
 * 1. RUNTIME — `window.__APP_CONFIG__`, gerado pelo `docker-entrypoint.d/40-app-config.sh`
 *    a partir das variáveis de ambiente do container, toda vez que ele sobe.
 * 2. BUILD-TIME — `import.meta.env.VITE_*`, embutido pelo Vite durante `npm run build`.
 *
 * Por que os dois caminhos: num SPA estático o `import.meta.env` só enxerga a
 * variável se ela existir no momento do build (build arg do Docker). Se a
 * plataforma de deploy define a variável apenas como env de runtime do
 * container — o que é o padrão da maioria dos painéis — o valor de build fica
 * vazio e a configuração some sem nenhum erro visível. O caminho de runtime
 * cobre esse caso e ainda permite trocar o valor reiniciando o container, sem
 * precisar rebuildar a imagem.
 */

declare global {
  interface Window {
    __APP_CONFIG__?: Record<string, unknown>;
  }
}

/**
 * Normaliza o valor vindo de env var / config.js:
 * - coage para string (uma plataforma pode entregar número quando o valor é só
 *   dígitos, e aí `'12345' === 12345` seria falso sem nenhum motivo aparente);
 * - remove espaços e quebras de linha das pontas (comuns ao colar no painel);
 * - remove um par de aspas que envolva todo o valor (quem escreve `SENHA="x"`
 *   no painel costuma não perceber que as aspas viram parte do valor).
 */
function normaliza(bruto: unknown): string {
  if (bruto === null || bruto === undefined) return '';
  const s = String(bruto).trim();
  return s.replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
}

export type OrigemConfig = 'runtime' | 'build' | 'ausente';

export type ValorConfig = {
  valor: string;
  origem: OrigemConfig;
};

/**
 * O valor de build precisa ser passado por quem chama, com acesso literal
 * (`import.meta.env.VITE_FOO`) — o Vite substitui essa expressão textualmente
 * durante o build, então uma leitura dinâmica por chave não seria substituída
 * de forma confiável.
 */
export function leConfig(chave: string, valorDeBuild: unknown): ValorConfig {
  const runtime = normaliza(
    typeof window !== 'undefined' ? window.__APP_CONFIG__?.[chave] : undefined,
  );
  if (runtime) return { valor: runtime, origem: 'runtime' };

  const build = normaliza(valorDeBuild);
  if (build) return { valor: build, origem: 'build' };

  return { valor: '', origem: 'ausente' };
}
