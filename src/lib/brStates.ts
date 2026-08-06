export type BrState = {
  uf: string;
  name: string;
  region: 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul';
  lat: number;
  lng: number;
};

export const BR_STATES: BrState[] = [
  { uf: 'AC', name: 'Acre', region: 'Norte', lat: -8.77, lng: -70.55 },
  { uf: 'AL', name: 'Alagoas', region: 'Nordeste', lat: -9.62, lng: -36.82 },
  { uf: 'AP', name: 'Amapa', region: 'Norte', lat: 1.41, lng: -51.77 },
  { uf: 'AM', name: 'Amazonas', region: 'Norte', lat: -3.47, lng: -65.1 },
  { uf: 'BA', name: 'Bahia', region: 'Nordeste', lat: -13.29, lng: -41.71 },
  { uf: 'CE', name: 'Ceara', region: 'Nordeste', lat: -5.5, lng: -39.53 },
  { uf: 'DF', name: 'Distrito Federal', region: 'Centro-Oeste', lat: -15.83, lng: -47.86 },
  { uf: 'ES', name: 'Espirito Santo', region: 'Sudeste', lat: -19.19, lng: -40.34 },
  { uf: 'GO', name: 'Goias', region: 'Centro-Oeste', lat: -15.98, lng: -49.86 },
  { uf: 'MA', name: 'Maranhao', region: 'Nordeste', lat: -5.42, lng: -45.44 },
  { uf: 'MT', name: 'Mato Grosso', region: 'Centro-Oeste', lat: -12.64, lng: -55.42 },
  { uf: 'MS', name: 'Mato Grosso do Sul', region: 'Centro-Oeste', lat: -20.51, lng: -54.54 },
  { uf: 'MG', name: 'Minas Gerais', region: 'Sudeste', lat: -18.1, lng: -44.38 },
  { uf: 'PA', name: 'Para', region: 'Norte', lat: -3.79, lng: -52.48 },
  { uf: 'PB', name: 'Paraiba', region: 'Nordeste', lat: -7.28, lng: -36.72 },
  { uf: 'PR', name: 'Parana', region: 'Sul', lat: -24.89, lng: -51.55 },
  { uf: 'PE', name: 'Pernambuco', region: 'Nordeste', lat: -8.38, lng: -37.86 },
  { uf: 'PI', name: 'Piaui', region: 'Nordeste', lat: -7.72, lng: -42.72 },
  { uf: 'RJ', name: 'Rio de Janeiro', region: 'Sudeste', lat: -22.25, lng: -42.66 },
  { uf: 'RN', name: 'Rio Grande do Norte', region: 'Nordeste', lat: -5.81, lng: -36.59 },
  { uf: 'RS', name: 'Rio Grande do Sul', region: 'Sul', lat: -30.17, lng: -53.5 },
  { uf: 'RO', name: 'Rondonia', region: 'Norte', lat: -10.83, lng: -63.34 },
  { uf: 'RR', name: 'Roraima', region: 'Norte', lat: 1.99, lng: -61.33 },
  { uf: 'SC', name: 'Santa Catarina', region: 'Sul', lat: -27.45, lng: -50.95 },
  { uf: 'SP', name: 'Sao Paulo', region: 'Sudeste', lat: -22.19, lng: -48.79 },
  { uf: 'SE', name: 'Sergipe', region: 'Nordeste', lat: -10.57, lng: -37.45 },
  { uf: 'TO', name: 'Tocantins', region: 'Norte', lat: -9.46, lng: -48.26 },
];

export const STATE_BY_UF = new Map(BR_STATES.map((s) => [s.uf, s]));

export function regionOf(uf: string): string {
  return STATE_BY_UF.get(uf)?.region ?? 'Outros';
}

export function nameOf(uf: string): string {
  return STATE_BY_UF.get(uf)?.name ?? uf;
}
