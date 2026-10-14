import { useMemo } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';

export type Series = { key: string; label: string };
export type Layout = 'vertical' | 'horizontal';
export type Mode = 'grouped' | 'stacked';

export type LayoutInput = {
  data: Record<string, unknown>[];
  categoryKey: string;
  series: Series[];
  layout: Layout;
  mode: Mode;
  width: number;
  height: number;
  valueFormat: (n: number) => string;
  measureText: (text: string) => number;
};

export type Bar = {
  id: string;
  categoryIndex: number;
  seriesIndex: number;
  value: number;
  path: string;
  /** Centro da barra no eixo de categoria. */
  center: number;
  /** Posição da ponta (lado oposto à baseline) no eixo de valor. */
  tip: number;
};

export type Tick = { value: number; pos: number; label: string };

export type Band = {
  index: number;
  label: string;
  /** Rótulo truncado com "…" quando não cabe (só no horizontal). */
  displayLabel: string;
  /** Falso quando o rótulo é pulado para não colidir com vizinhos. */
  showLabel: boolean;
  center: number;
  /** Ponta mais distante da baseline entre as barras da categoria. */
  tip: number;
  /** Área de hover/foco: o step inteiro da categoria. */
  hitStart: number;
  hitSize: number;
};

export type Plot = { x: number; y: number; width: number; height: number };

export type BarLayout = {
  plot: Plot;
  bars: Bar[];
  ticks: Tick[];
  bands: Band[];
  /** Valores saneados, [categoria][série]. */
  values: number[][];
  totals: number[];
  maxLabel: { x: number; y: number; text: string } | null;
};

const MAX_THICKNESS = 24;
const GAP = 2;
const RADIUS = 4;
const LABEL_PAD = 8;
const AXIS_LABEL_HEIGHT = 24;
const LINE_HEIGHT = 16;

/** Valores negativos e não numéricos estão fora do escopo; viram 0. */
export function toValue(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function barPath(x: number, y: number, w: number, h: number, layout: Layout, rounded: boolean): string {
  if (!rounded) return `M${x},${y}h${w}v${h}h${-w}Z`;
  if (layout === 'vertical') {
    const r = Math.min(RADIUS, w / 2, h);
    return `M${x},${y + h}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h}Z`;
  }
  const r = Math.min(RADIUS, h / 2, w);
  return `M${x},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x}Z`;
}

function truncate(text: string, maxWidth: number, measure: (t: string) => number): string {
  if (measure(text) <= maxWidth) return text;
  let s = text;
  while (s.length > 0 && measure(s + '…') > maxWidth) s = s.slice(0, -1);
  return s.trimEnd() + '…';
}

export function computeBarLayout(input: LayoutInput): BarLayout {
  const { data, categoryKey, series, layout, mode, width, height, valueFormat, measureText } = input;
  const vertical = layout === 'vertical';
  const stacked = mode === 'stacked' && series.length > 1;

  const labels = data.map((d) => String(d[categoryKey] ?? ''));
  const values = data.map((d) => series.map((s) => toValue(d[s.key])));
  const totals = values.map((row) => row.reduce((a, b) => a + b, 0));
  const maxValue = Math.max(0, ...(stacked ? totals : values.flat()));

  const valueScale = scaleLinear().domain([0, maxValue || 1]).nice();
  const tickValues = valueScale.ticks(5);
  const tickLabels = tickValues.map(valueFormat);
  const maxText = maxValue > 0 ? valueFormat(maxValue) : '';

  const maxCategoryWidth = Math.max(0, ...labels.map(measureText));
  const categoryLabelWidth = Math.min(maxCategoryWidth, width * 0.4);

  const margin = vertical
    ? {
        top: LINE_HEIGHT + 4,
        right: LABEL_PAD,
        bottom: AXIS_LABEL_HEIGHT,
        left: Math.max(0, ...tickLabels.map(measureText)) + LABEL_PAD * 1.5,
      }
    : {
        top: LABEL_PAD,
        right: Math.max(measureText(maxText) + LABEL_PAD * 1.5, measureText(tickLabels.at(-1) ?? '') / 2 + 2),
        bottom: AXIS_LABEL_HEIGHT,
        left: categoryLabelWidth + LABEL_PAD * 1.5,
      };

  const plot: Plot = {
    x: margin.left,
    y: margin.top,
    width: Math.max(0, width - margin.left - margin.right),
    height: Math.max(0, height - margin.top - margin.bottom),
  };

  if (plot.width < 1 || plot.height < 1 || data.length === 0) {
    return { plot, bars: [], ticks: [], bands: [], values, totals, maxLabel: null };
  }

  valueScale.range(vertical ? [plot.y + plot.height, plot.y] : [plot.x, plot.x + plot.width]);
  const baseline = valueScale(0);

  const bandScale = scaleBand<number>()
    .domain(data.map((_, i) => i))
    .range(vertical ? [plot.x, plot.x + plot.width] : [plot.y, plot.y + plot.height])
    .paddingInner(0.3)
    .paddingOuter(0.15);
  const step = bandScale.step();
  const bandwidth = bandScale.bandwidth();

  // Quantas categorias pular entre rótulos para não colidirem.
  const labelSpace = vertical ? maxCategoryWidth + LABEL_PAD : LINE_HEIGHT;
  const every = Math.max(1, Math.ceil(labelSpace / step));

  const bars: Bar[] = [];
  // p0 = início no eixo de valor (lado da baseline), p1 = ponta.
  const addBar = (
    categoryIndex: number,
    seriesIndex: number,
    value: number,
    crossStart: number,
    thickness: number,
    p0: number,
    p1: number,
    rounded: boolean,
  ) => {
    const lo = Math.min(p0, p1);
    const len = Math.abs(p1 - p0);
    const [x, y, w, h] = vertical ? [crossStart, lo, thickness, len] : [lo, crossStart, len, thickness];
    bars.push({
      id: `${categoryIndex}-${seriesIndex}`,
      categoryIndex,
      seriesIndex,
      value,
      path: barPath(x, y, w, h, layout, rounded),
      center: crossStart + thickness / 2,
      tip: p1,
    });
  };

  const bands: Band[] = labels.map((label, i) => {
    const bandStart = bandScale(i) ?? 0;
    const row = values[i];

    if (stacked) {
      const thickness = Math.min(MAX_THICKNESS, bandwidth);
      const crossStart = bandStart + (bandwidth - thickness) / 2;
      const last = row.findLastIndex((v) => v > 0);
      let acc = 0;
      let first = true;
      row.forEach((v, s) => {
        if (v <= 0) return;
        let p0 = valueScale(acc);
        const p1 = valueScale(acc + v);
        acc += v;
        // Gap de 2px entre segmentos: recorta a base de todo segmento menos o primeiro.
        if (!first) p0 += vertical ? -GAP : GAP;
        first = false;
        if ((vertical ? p0 - p1 : p1 - p0) <= 0) return;
        addBar(i, s, v, crossStart, thickness, p0, p1, s === last);
      });
    } else {
      const n = series.length;
      const thickness = Math.max(1, Math.min(MAX_THICKNESS, (bandwidth - GAP * (n - 1)) / n));
      const groupSize = thickness * n + GAP * (n - 1);
      const groupStart = bandStart + (bandwidth - groupSize) / 2;
      row.forEach((v, s) => {
        if (v <= 0) return;
        addBar(i, s, v, groupStart + s * (thickness + GAP), thickness, baseline, valueScale(v), true);
      });
    }

    return {
      index: i,
      label,
      displayLabel: vertical ? label : truncate(label, categoryLabelWidth, measureText),
      showLabel: i % every === 0,
      center: bandStart + bandwidth / 2,
      tip: valueScale(stacked ? totals[i] : Math.max(0, ...row)),
      hitStart: bandStart - (step - bandwidth) / 2,
      hitSize: step,
    };
  });

  let maxLabel: BarLayout['maxLabel'] = null;
  if (maxValue > 0) {
    const anchor = stacked ? bands[totals.indexOf(maxValue)] : bars.find((b) => b.value === maxValue);
    if (anchor) {
      maxLabel = vertical
        ? { x: anchor.center, y: anchor.tip - 6, text: maxText }
        : { x: anchor.tip + 6, y: anchor.center, text: maxText };
    }
  }

  const ticks = tickValues.map((value, i) => ({ value, pos: valueScale(value), label: tickLabels[i] }));

  return { plot, bars, ticks, bands, values, totals, maxLabel };
}

export function useBarLayout(input: LayoutInput): BarLayout {
  const { data, categoryKey, series, layout, mode, width, height, valueFormat, measureText } = input;
  return useMemo(
    () => computeBarLayout({ data, categoryKey, series, layout, mode, width, height, valueFormat, measureText }),
    [data, categoryKey, series, layout, mode, width, height, valueFormat, measureText],
  );
}
