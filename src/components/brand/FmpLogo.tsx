/**
 * Identidade visual da FMP — arquivos oficiais da marca, em `public/`.
 *
 * `LOGO_FMP.png`         marca completa (letreiro + estrela)
 * `SIMBOLO_VERMELHO.png` símbolo isolado, vermelho
 *
 * Ambos com fundo transparente e já aparados (sem sobra em volta do desenho),
 * então a altura definida no CSS corresponde à altura visível da marca.
 *
 * Como são imagens, não herdam cor do contexto: o símbolo é sempre vermelho.
 * Sobre fundo escuro ele é aplicado direto, sem caixa colorida atrás — em cima
 * do vermelho da marca o desenho sumiria.
 */

type SimboloProps = {
  className?: string;
  /** Rótulo acessível. Sem ele o símbolo é tratado como decorativo. */
  titulo?: string;
};

export function FmpSimbolo({ className = 'h-6 w-6', titulo }: SimboloProps) {
  return (
    <img
      src="/SIMBOLO_VERMELHO.png"
      alt={titulo ?? ''}
      aria-hidden={titulo ? undefined : true}
      className={`${className} object-contain`}
      draggable={false}
    />
  );
}

type MarcaProps = {
  /** Altura da marca, ex.: 'h-10'. A largura acompanha a proporção. */
  className?: string;
};

export function FmpMarca({ className = 'h-10' }: MarcaProps) {
  return (
    <img
      src="/LOGO_FMP.png"
      alt="FMP"
      className={`${className} w-auto object-contain`}
      draggable={false}
    />
  );
}
