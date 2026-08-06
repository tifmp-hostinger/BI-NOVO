import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { BR_STATES, nameOf, type BrState } from '@/lib/brStates';
import type { StateAgg } from '@/services/matriculasService';

type Props = {
  data: StateAgg[];
  selectedUf: string | null;
  onSelect: (uf: string | null) => void;
  height?: number;
  /**
   * Rótulo da métrica principal no tooltip (o campo `total` do StateAgg).
   * Default 'matriculas' — o texto histórico do Presença Nacional.
   */
  metricLabel?: string;
  /** Formatação de `total` na bolha e no tooltip. Default 'int'. */
  metricFormat?: 'int' | 'currency';
  /**
   * Segunda linha do tooltip. Default: "Pos: N · Cursos livres: N", do
   * Presença Nacional. Retornar null omite a linha.
   */
  secondaryLine?: (agg: StateAgg) => string | null;
  /**
   * Valor que governa a INTENSIDADE de cor (bolha e mapa de calor), quando
   * ela deve ser diferente do tamanho. Default: o próprio `total`.
   */
  colorValue?: (agg: StateAgg) => number;
};

const FMP_SAND = '#BFBAA4';

function fmtMetric(v: number, format: 'int' | 'currency'): string {
  if (format === 'currency') {
    return v.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return v.toLocaleString('pt-BR');
}

function fmtBubble(v: number, format: 'int' | 'currency'): string {
  if (v <= 0) return '';
  if (format === 'currency') {
    if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
    return String(Math.round(v));
  }
  return v > 999 ? `${(v / 1000).toFixed(1)}k` : String(v);
}

function defaultSecondaryLine(agg: StateAgg): string {
  return `Pos: ${agg.pos} &middot; Cursos livres: ${agg.livres}`;
}

function interpolateSandToRed(t: number): string {
  const clamp = Math.max(0, Math.min(1, t));
  const from = { r: 0xBF, g: 0xBA, b: 0xA4 };
  const to = { r: 0xEE, g: 0x2A, b: 0x42 };
  const r = Math.round(from.r + (to.r - from.r) * clamp);
  const g = Math.round(from.g + (to.g - from.g) * clamp);
  const b = Math.round(from.b + (to.b - from.b) * clamp);
  return `rgb(${r},${g},${b})`;
}

export function BrazilStateMap({
  data,
  selectedUf,
  onSelect,
  height = 520,
  metricLabel = 'matriculas',
  metricFormat = 'int',
  secondaryLine = defaultSecondaryLine,
  colorValue,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const heatRef = useRef<L.Layer | null>(null);
  const selectedRef = useRef<string | null>(selectedUf);
  // Callbacks de apresentação em ref: as chamadoras passam funções inline
  // (identidade nova a cada render); nas dependências do efeito elas
  // redesenhariam o mapa inteiro em todo render.
  const fnsRef = useRef({ secondaryLine, colorValue });
  fnsRef.current = { secondaryLine, colorValue };

  const byUf = useMemo(() => {
    const m = new Map<string, StateAgg>();
    for (const s of data) m.set(s.uf, s);
    return m;
  }, [data]);

  useEffect(() => {
    selectedRef.current = selectedUf;
  }, [selectedUf]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-14.5, -52],
      zoom: 4,
      minZoom: 3,
      maxZoom: 8,
      scrollWheelZoom: true,
      zoomControl: true,
      attributionControl: false,
      preferCanvas: false,
    });

    L.tileLayer(
      'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
      { subdomains: 'abcd', maxZoom: 19 }
    ).addTo(map);

    L.control
      .attribution({ position: 'bottomright', prefix: false })
      .addAttribution('&copy; OpenStreetMap &middot; CARTO')
      .addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.on('click', () => onSelect(null));

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      heatRef.current = null;
    };
  }, [onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }

    // Tamanho vem de `total`; a cor pode vir de outra métrica (colorValue).
    const { secondaryLine: linhaSecundaria, colorValue: corDe } = fnsRef.current;
    const sizeOf = (agg: StateAgg) => agg.total;
    const colorOf = corDe ?? sizeOf;

    // Max calculado de verdade (não assume que `data` chega ordenado).
    let max = 1;
    let maxColor = 1;
    for (const s of data) {
      if (sizeOf(s) > max) max = sizeOf(s);
      if (colorOf(s) > maxColor) maxColor = colorOf(s);
    }

    const heatPoints: [number, number, number][] = BR_STATES.filter(
      (s) => (byUf.get(s.uf)?.total ?? 0) > 0
    ).map((s) => {
      const agg = byUf.get(s.uf)!;
      const norm = Math.max(0.25, Math.min(1, Math.log10(1 + colorOf(agg)) / Math.log10(1 + maxColor)));
      return [s.lat, s.lng, norm];
    });

    if (heatPoints.length > 0) {
      const heat = (L as unknown as {
        heatLayer: (
          points: [number, number, number][],
          options?: Record<string, unknown>
        ) => L.Layer;
      }).heatLayer(heatPoints, {
        radius: 55,
        blur: 45,
        minOpacity: 0.35,
        maxZoom: 8,
        gradient: {
          0.2: '#E9D9C8',
          0.4: '#E8A79C',
          0.6: '#EE6474',
          0.8: '#EE2A42',
          1.0: '#B81E32',
        },
      });
      heat.addTo(map);
      heatRef.current = heat;
    }

    for (const s of BR_STATES) {
      const agg = byUf.get(s.uf);
      const total = agg?.total ?? 0;
      const corBase = agg ? colorOf(agg) : 0;
      const intensity =
        corBase <= 0
          ? 0
          : Math.max(0.2, Math.min(1, Math.log10(1 + corBase) / Math.log10(1 + maxColor)));
      const escala =
        total === 0 ? 0 : Math.max(0.2, Math.min(1, Math.log10(1 + total) / Math.log10(1 + max)));
      const color = total === 0 ? FMP_SAND : interpolateSandToRed(intensity);

      const isSelected = selectedRef.current === s.uf;
      const scale = total === 0 ? 0.35 : 0.4 + escala * 0.6;
      const size = Math.round(30 + scale * 30);

      const marker = L.marker([s.lat, s.lng], {
        icon: L.divIcon({
          className: 'br-state-marker',
          html: renderBubble({
            state: s,
            label: fmtBubble(total, metricFormat),
            color,
            size,
            isSelected,
            hasData: total > 0,
          }),
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
      });

      const linha2 = agg ? linhaSecundaria(agg) : null;
      marker.bindTooltip(
        `<div style="font-family:Inter,sans-serif;">
          <div style="font-size:10px;color:#64748B;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">${s.region}</div>
          <div style="font-size:13px;font-weight:600;color:#0F172A;margin-top:2px;">${s.name} <span style="color:#94A3B8;font-weight:500;">(${s.uf})</span></div>
          <div style="font-size:12px;color:#B81E32;margin-top:4px;font-weight:600;">${fmtMetric(total, metricFormat)} ${metricLabel}</div>
          ${
            agg
              ? linha2
                ? `<div style="font-size:10px;color:#64748B;margin-top:2px;">${linha2}</div>`
                : ''
              : '<div style="font-size:10px;color:#94A3B8;margin-top:2px;">Sem dados</div>'
          }
        </div>`,
        { direction: 'top', offset: [0, -6], className: 'cep-tooltip' }
      );

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e as unknown as Event);
        onSelect(s.uf);
      });

      marker.addTo(layer);
    }
  }, [byUf, data, onSelect, metricLabel, metricFormat]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded-2xl ring-1 ring-inset ring-gray-200/70"
      style={{ height }}
    />
  );
}

function renderBubble({
  state,
  label: valorLabel,
  color,
  size,
  isSelected,
  hasData,
}: {
  state: BrState;
  label: string;
  color: string;
  size: number;
  isSelected: boolean;
  hasData: boolean;
}) {
  const border = isSelected
    ? 'border: 3px solid #fff; box-shadow: 0 0 0 3px rgba(238,42,66,0.95), 0 16px 40px -12px rgba(184,30,50,0.55);'
    : hasData
    ? 'border: 2px solid rgba(255,255,255,0.9); box-shadow: 0 8px 20px -8px rgba(25,24,24,0.35);'
    : 'border: 2px dashed rgba(191,186,164,0.75); box-shadow: none;';

  const bg = hasData
    ? `background: radial-gradient(circle at 30% 25%, ${lighten(color)}, ${color});`
    : 'background: rgba(255,255,255,0.75);';

  const fontColor = hasData ? '#ffffff' : '#8A8578';
  const fontSize = size > 46 ? 12 : size > 38 ? 11 : 10;
  const label = valorLabel || state.uf;

  return `
    <div style="
      position:relative;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      width:${size}px;height:${size}px;border-radius:9999px;
      ${bg}
      ${border}
      transition:all 0.2s ease-out;
      font-family:Inter,sans-serif;
    ">
      <span style="font-size:${fontSize}px;font-weight:700;color:${fontColor};line-height:1;">${label}</span>
      ${
        hasData
          ? `<span style="font-size:${Math.max(8, fontSize - 2)}px;color:rgba(255,255,255,0.75);font-weight:500;letter-spacing:0.06em;margin-top:1px;">${state.uf}</span>`
          : ''
      }
    </div>
  `;
}

function lighten(hex: string) {
  if (hex.startsWith('rgb')) {
    const parts = hex.match(/\d+/g);
    if (!parts) return hex;
    const [r, g, b] = parts.map(Number);
    const mix = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.45));
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
  }
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const mix = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.45));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

export { nameOf };
