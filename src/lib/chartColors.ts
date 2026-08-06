/**
 * Paleta categórica para pizza/rosca — 8 matizes com separação validada para
 * daltonismo (ΔE ≥ 8 CVD, ≥15 visão normal, ambos sobre fundo branco de
 * card). Antes, cada pizza do app definia seu próprio array local misturando
 * só vermelho e bege (FMP_RED/FMP_DARK/NEUTRAL), então toda fatia parecia a
 * mesma cor. Ordem fixa: nunca ciclar/reordenar por filtro, senão a cor de
 * uma categoria muda quando outra some do recorte.
 *
 * Funis continuam na cor vermelha da marca — esta paleta é só para
 * categorias lado a lado num pie/donut, não usar em funil.
 */
export const CORES_CATEGORICAS = [
  '#2a78d6', // azul
  '#eb6834', // laranja
  '#1baf7a', // verde-água
  '#eda100', // amarelo
  '#e87ba4', // magenta
  '#008300', // verde
  '#4a3aa7', // violeta
  '#e34948', // vermelho
] as const;

export function corCategorica(indice: number): string {
  return CORES_CATEGORICAS[indice % CORES_CATEGORICAS.length];
}
