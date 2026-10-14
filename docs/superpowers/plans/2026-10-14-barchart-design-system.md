# BarChart Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Projeto React + Storybook do zero com tokens de design system e um componente `BarChart` em SVG (vertical, horizontal, agrupado, empilhado), acessível e documentado.

**Architecture:** Tokens globais em CSS custom properties com temas light/dark via `[data-theme]`. O `BarChart` separa a geometria pura (`computeBarLayout` em `useBarLayout.ts`, usa `d3-scale`) da renderização (SVG + tooltip HTML + tabela alternativa). O Storybook é o único ambiente de execução: stories e uma página MDX.

**Tech Stack:** Vite 7, React 19, TypeScript 5.9 (strict), Storybook 9 (`@storybook/react-vite`, `@storybook/addon-docs`), `d3-scale` 4, CSS Modules, npm.

**Spec:** `docs/superpowers/specs/2026-10-14-barchart-design-system-design.md`

## Global Constraints

- Dependência de runtime além de React: somente `d3-scale`.
- Sem testes automatizados (decisão do usuário). Verificação = `npm run typecheck` + `npm run build-storybook` + checagem visual no Storybook.
- Estilos só via CSS Modules + tokens de `src/tokens/tokens.css`. O CSS de componente não usa hex direto.
- Textos de UI em pt-BR. Identificadores de código em inglês.
- Barra: espessura máxima 24px, ponta arredondada de 4px, base reta, gap de 2px entre barras vizinhas e entre segmentos empilhados.
- Eixo de valor sempre começa em 0, com `nice()` e ~5 ticks.
- Máximo de 8 séries: o excedente gera `console.warn` e é descartado.
- Label direto apenas no maior valor (no modo empilhado, no maior total).
- Legenda só com 2 ou mais séries. Texto nunca usa a cor da série.
- Animação de entrada de 400ms ease-out, desligada com `prefers-reduced-motion: reduce`.

## Review Focus

1. **Valores inválidos** (negativo, `NaN`, `null`, string, chave ausente): são tratados como 0. Nenhuma barra abaixo da baseline, nenhum `NaN` em `d`. Código em Task 2 (`toValue`); checagem manual em Task 4, Step 4.
2. **Todos os valores zero**: o eixo fica em 0–1, sem label de máximo e sem erro. Código em Task 2; checagem em Task 4, Step 4.
3. **Container muito estreito** (< 150px): a área de plot fica ≤ 0, nenhuma barra é renderizada e não há erro. Código em Task 2 (retorno antecipado); checagem em Task 4, Step 4.
4. **`data` muda enquanto há categoria ativa fora do novo range**: sem crash, e o tooltip some. Código em Task 3 (`activeBand` opcional); checagem em Task 4, Step 4.
5. **Mais de 8 séries**: `console.warn` uma vez e só as 8 primeiras renderizadas, com cores estáveis por posição. Código em Task 3; checagem em Task 4, Step 4.

---

### Task 1: Scaffold do projeto, tokens e Storybook com toggle de tema

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`
- Create: `src/vite-env.d.ts`
- Create: `src/tokens/tokens.css`
- Create: `.storybook/main.ts`, `.storybook/preview.tsx`
- Create: `src/Introduction.mdx`

**Interfaces:**
- Produces: tokens CSS `--surface-page`, `--surface-chart`, `--surface-hover`, `--text-primary`, `--text-secondary`, `--text-muted`, `--grid`, `--axis`, `--border`, `--skeleton`, `--focus-ring`, `--series-1`…`--series-8`, `--space-1`…`--space-6`, `--radius-sm`, `--radius-md`, `--font-sans`, `--font-size-sm|md|lg`. Global do Storybook `theme: 'light' | 'dark'`, aplicada como `data-theme` no `<html>`.

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "ds-dashboards",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Instalar dependências**

```bash
npm install react@^19 react-dom@^19 d3-scale@^4
npm install -D typescript@~5.9 vite@^7 @vitejs/plugin-react@^5 storybook@^9 @storybook/react-vite@^9 @storybook/addon-docs@^9 @types/react@^19 @types/react-dom@^19 @types/d3-scale@^4
```

Expected: instalação sem erros de peer dependency (warnings são aceitáveis).

- [ ] **Step 3: Criar `tsconfig.json`, `vite.config.ts`, `.gitignore`, `src/vite-env.d.ts`**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src", ".storybook"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()] });
```

`.gitignore`:

```
node_modules
storybook-static
*.log
```

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 4: Criar `src/tokens/tokens.css`**

Os valores do dark são declarados duas vezes: na media query (preferência do sistema, quando não há `data-theme="light"`) e em `[data-theme="dark"]` (toggle explícito).

```css
:root {
  color-scheme: light;

  --surface-page: #f9f9f7;
  --surface-chart: #fcfcfb;
  --surface-hover: rgba(11, 11, 11, 0.04);
  --text-primary: #0b0b0b;
  --text-secondary: #52514e;
  --text-muted: #898781;
  --grid: #e1e0d9;
  --axis: #c3c2b7;
  --border: rgba(11, 11, 11, 0.1);
  --skeleton: #e1e0d9;
  --focus-ring: #2a78d6;

  /* Paleta categórica validada (ordem fixa, CVD-safe nos pares adjacentes) */
  --series-1: #2a78d6;
  --series-2: #eb6834;
  --series-3: #1baf7a;
  --series-4: #eda100;
  --series-5: #e87ba4;
  --series-6: #008300;
  --series-7: #6250d6;
  --series-8: #e34948;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --font-sans: system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-size-sm: 12px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --surface-page: #0d0d0d;
    --surface-chart: #1a1a19;
    --surface-hover: rgba(255, 255, 255, 0.06);
    --text-primary: #f0efec;
    --text-secondary: #c3c2b7;
    --text-muted: #898781;
    --grid: #2c2c2a;
    --axis: #383835;
    --border: rgba(255, 255, 255, 0.1);
    --skeleton: #2c2c2a;
    --focus-ring: #3987e5;
    --series-1: #3987e5;
    --series-2: #d95926;
    --series-3: #199e70;
    --series-4: #c98500;
    --series-5: #d55181;
    --series-6: #008300;
    --series-7: #9085e9;
    --series-8: #e66767;
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --surface-page: #0d0d0d;
  --surface-chart: #1a1a19;
  --surface-hover: rgba(255, 255, 255, 0.06);
  --text-primary: #f0efec;
  --text-secondary: #c3c2b7;
  --text-muted: #898781;
  --grid: #2c2c2a;
  --axis: #383835;
  --border: rgba(255, 255, 255, 0.1);
  --skeleton: #2c2c2a;
  --focus-ring: #3987e5;
  --series-1: #3987e5;
  --series-2: #d95926;
  --series-3: #199e70;
  --series-4: #c98500;
  --series-5: #d55181;
  --series-6: #008300;
  --series-7: #9085e9;
  --series-8: #e66767;
}

body {
  margin: 0;
  background: var(--surface-page);
  color: var(--text-primary);
  font-family: var(--font-sans);
}
```

- [ ] **Step 5: Criar `.storybook/main.ts` e `.storybook/preview.tsx`**

`.storybook/main.ts`:

```ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: { name: '@storybook/react-vite', options: {} },
};

export default config;
```

`.storybook/preview.tsx`:

```tsx
import type { Preview } from '@storybook/react-vite';
import '../src/tokens/tokens.css';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Tema',
      toolbar: {
        title: 'Tema',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (Story, context) => {
      document.documentElement.dataset.theme = context.globals.theme;
      return <Story />;
    },
  ],
  parameters: { layout: 'padded' },
};

export default preview;
```

- [ ] **Step 6: Criar `src/Introduction.mdx`**

```mdx
import { Meta } from '@storybook/addon-docs/blocks';

<Meta title="Introdução" />

# Design System — Dashboards

Componentes de visualização de dados para dashboards. Todos os estilos vêm dos tokens em `src/tokens/tokens.css`. Use **Tema** na toolbar para alternar entre light e dark.

## Paleta categórica

As séries recebem cores nesta ordem fixa. A ordem é o que garante distinção para daltonismo entre séries vizinhas, por isso não reordene nem gere cores novas.

<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
    <div key={n} style={{ textAlign: 'center', fontSize: 12 }}>
      <div style={{ width: 48, height: 48, borderRadius: 8, background: `var(--series-${n})` }} />
      <code>--series-{n}</code>
    </div>
  ))}
</div>
```

- [ ] **Step 7: Verificar**

Run: `npm run typecheck && npm run build-storybook`
Expected: typecheck sem erros; o build termina com `Output directory: .../storybook-static`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts .gitignore src .storybook
git commit -m "chore: scaffold Storybook project with design tokens and theme toggle"
```

---

### Task 2: Geometria pura do gráfico (`useBarLayout.ts`)

**Files:**
- Create: `src/components/BarChart/useBarLayout.ts`

**Interfaces:**
- Consumes: `d3-scale` (`scaleBand`, `scaleLinear`).
- Produces:
  - `type Series = { key: string; label: string }`
  - `type Layout = 'vertical' | 'horizontal'`, `type Mode = 'grouped' | 'stacked'`
  - `type LayoutInput = { data: Record<string, unknown>[]; categoryKey: string; series: Series[]; layout: Layout; mode: Mode; width: number; height: number; valueFormat: (n: number) => string; measureText: (text: string) => number }`
  - `type Bar = { id: string; categoryIndex: number; seriesIndex: number; value: number; path: string; center: number; tip: number }`
  - `type Tick = { value: number; pos: number; label: string }`
  - `type Band = { index: number; label: string; displayLabel: string; showLabel: boolean; center: number; tip: number; hitStart: number; hitSize: number }`
  - `type Plot = { x: number; y: number; width: number; height: number }`
  - `type BarLayout = { plot: Plot; bars: Bar[]; ticks: Tick[]; bands: Band[]; values: number[][]; totals: number[]; maxLabel: { x: number; y: number; text: string } | null }`
  - `function computeBarLayout(input: LayoutInput): BarLayout`
  - `function useBarLayout(input: LayoutInput): BarLayout` (memoizado)
  - Coordenadas absolutas no espaço do SVG. `center` é o centro no eixo de categoria; `tip` é a posição em pixel da ponta mais distante da baseline.

- [ ] **Step 1: Escrever `useBarLayout.ts`**

```ts
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
```

- [ ] **Step 2: Verificar**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/BarChart/useBarLayout.ts
git commit -m "feat(BarChart): add pure bar layout geometry"
```

---

### Task 3: Componente `BarChart` (SVG, tooltip, teclado, tabela, estados)

**Files:**
- Create: `src/components/BarChart/BarChart.tsx`
- Create: `src/components/BarChart/Tooltip.tsx`
- Create: `src/components/BarChart/BarChart.module.css`
- Create: `src/components/BarChart/index.ts`

**Interfaces:**
- Consumes: `useBarLayout`, `Series`, `Layout`, `Mode`, `Band` de `./useBarLayout` (Task 2). Tokens CSS da Task 1.
- Produces:
  - `function BarChart<T extends Record<string, unknown>>(props: BarChartProps<T>): JSX.Element`
  - `type BarChartProps<T>` com os campos `data`, `categoryKey`, `series`, `layout?`, `mode?`, `title`, `description?`, `height?`, `valueFormat?`, `loading?`, `showTable?`, exatamente como na spec.
  - `index.ts` reexporta `BarChart`, `BarChartProps`, `Series`.

- [ ] **Step 1: Escrever `BarChart.module.css`**

```css
.root {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  font-family: var(--font-sans);
  color: var(--text-primary);
  background: var(--surface-chart);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
}

.title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.description {
  margin: var(--space-1) 0 0;
  font-size: var(--font-size-md);
  color: var(--text-secondary);
}

.toggle {
  flex-shrink: 0;
  padding: var(--space-1) var(--space-3);
  font: inherit;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.toggle:hover {
  color: var(--text-primary);
  background: var(--surface-hover);
}

.toggle:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.legend li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.swatch {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.body {
  position: relative;
}

/* O foco é mostrado pelo .focusRing na categoria ativa. */
.svg {
  display: block;
  outline: none;
  font-family: var(--font-sans);
}

.svg text {
  fill: var(--text-muted);
  font-size: var(--font-size-sm);
}

.svg .maxLabel {
  fill: var(--text-primary);
  font-weight: 600;
}

.tickLabel {
  font-variant-numeric: tabular-nums;
}

.grid {
  stroke: var(--grid);
  stroke-width: 1;
}

.baseline {
  stroke: var(--axis);
  stroke-width: 1;
}

.highlight {
  fill: var(--surface-hover);
}

.focusRing {
  fill: none;
  stroke: var(--focus-ring);
  stroke-width: 2;
}

.hit {
  fill: transparent;
}

.growY,
.growX {
  transform-box: fill-box;
  animation-duration: 400ms;
  animation-timing-function: ease-out;
}

.growY {
  transform-origin: bottom;
  animation-name: growY;
}

.growX {
  transform-origin: left;
  animation-name: growX;
}

@keyframes growY {
  from { transform: scaleY(0); }
}

@keyframes growX {
  from { transform: scaleX(0); }
}

.tooltip {
  position: absolute;
  z-index: 1;
  min-width: 140px;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  background: var(--surface-chart);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.12);
  pointer-events: none;
}

.tooltipTitle {
  margin-bottom: var(--space-1);
  font-weight: 600;
  color: var(--text-primary);
}

.tooltipRows {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.tooltipRows li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-secondary);
}

.tooltipValue {
  margin-left: auto;
  padding-left: var(--space-4);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.tooltipRows .tooltipTotal {
  padding-top: var(--space-1);
  border-top: 1px solid var(--grid);
  font-weight: 600;
}

.skeleton {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  box-sizing: border-box;
  padding: var(--space-4) 0;
}

.skeleton span {
  flex: 1;
  max-width: 24px;
  margin: 0 auto;
  background: var(--skeleton);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  50% { opacity: 0.5; }
}

.empty {
  display: grid;
  place-items: center;
  font-size: var(--font-size-md);
  color: var(--text-muted);
}

.tableWrap {
  overflow: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-md);
}

.table th,
.table td {
  padding: var(--space-2) var(--space-3);
  text-align: right;
  border-bottom: 1px solid var(--grid);
}

.table thead th {
  font-weight: 600;
  color: var(--text-secondary);
}

.table th[scope="row"],
.table thead th:first-child {
  text-align: left;
}

.table td {
  font-variant-numeric: tabular-nums;
}

.srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .growY,
  .growX,
  .skeleton span {
    animation: none;
  }
}
```

- [ ] **Step 2: Escrever `Tooltip.tsx`**

```tsx
import { useLayoutEffect, useRef, useState } from 'react';
import styles from './BarChart.module.css';

export type TooltipRow = { key: string; label: string; value: string; color?: string };

type TooltipProps = {
  title: string;
  rows: TooltipRow[];
  /** Ponto de ancoragem no espaço do container. */
  x: number;
  y: number;
  placement: 'top' | 'right';
  bounds: { width: number; height: number };
};

const OFFSET = 8;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

export function Tooltip({ title, rows, x, y, placement, bounds }: TooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Mede a cada render; só atualiza o estado quando o tamanho muda (sem loop).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
  });

  const left = clamp(placement === 'top' ? x - size.w / 2 : x + OFFSET, 0, bounds.width - size.w);
  const top = clamp(placement === 'top' ? y - size.h - OFFSET : y - size.h / 2, 0, bounds.height - size.h);

  return (
    <div
      ref={ref}
      className={styles.tooltip}
      style={{ left, top, visibility: size.w ? 'visible' : 'hidden' }}
      aria-hidden="true"
    >
      <div className={styles.tooltipTitle}>{title}</div>
      <ul className={styles.tooltipRows}>
        {rows.map((r) => (
          <li key={r.key} className={r.color ? undefined : styles.tooltipTotal}>
            {r.color && <span className={styles.swatch} style={{ background: r.color }} />}
            <span>{r.label}</span>
            <span className={styles.tooltipValue}>{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Escrever `BarChart.tsx`**

```tsx
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import styles from './BarChart.module.css';
import { Tooltip, type TooltipRow } from './Tooltip';
import { useBarLayout, type Band, type Layout, type Mode, type Series } from './useBarLayout';

export type { Series };

export type BarChartProps<T extends Record<string, unknown>> = {
  /** Uma linha por categoria. */
  data: T[];
  /** Campo de `data` usado como rótulo da categoria. */
  categoryKey: keyof T & string;
  /** 1 a 8 séries. A cor segue a posição no array. */
  series: Series[];
  layout?: Layout;
  /** Ignorado com uma única série. */
  mode?: Mode;
  /** Obrigatório: título visível e nome acessível do gráfico. */
  title: string;
  description?: string;
  /** Altura da área do gráfico em px. */
  height?: number;
  valueFormat?: (n: number) => string;
  loading?: boolean;
  /** Estado inicial do toggle gráfico/tabela. */
  showTable?: boolean;
};

const MAX_SERIES = 8;
const FONT = '12px system-ui, -apple-system, "Segoe UI", sans-serif';
const SKELETON_HEIGHTS = [45, 70, 55, 85, 60, 75, 50, 65];

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const defaultFormat = (n: number) => compact.format(n);

let canvasContext: CanvasRenderingContext2D | null = null;
function measureText(text: string): number {
  canvasContext ??= document.createElement('canvas').getContext('2d');
  if (!canvasContext) return text.length * 7;
  canvasContext.font = FONT;
  return canvasContext.measureText(text).width;
}

const crisp = (v: number) => Math.round(v) + 0.5;

export function BarChart<T extends Record<string, unknown>>({
  data,
  categoryKey,
  series,
  layout = 'vertical',
  mode = 'grouped',
  title,
  description,
  height = 320,
  valueFormat = defaultFormat,
  loading = false,
  showTable = false,
}: BarChartProps<T>) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const bodyRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [tableView, setTableView] = useState(showTable);
  const [active, setActive] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => setTableView(showTable), [showTable]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (series.length > MAX_SERIES) {
      console.warn(
        `BarChart: ${series.length} séries recebidas; apenas as ${MAX_SERIES} primeiras são exibidas. Agrupe o restante em "Outros".`,
      );
    }
  }, [series.length]);

  const visibleSeries = useMemo(() => series.slice(0, MAX_SERIES), [series]);
  const vertical = layout === 'vertical';
  const stacked = mode === 'stacked' && visibleSeries.length > 1;

  const chart = useBarLayout({
    data,
    categoryKey,
    series: visibleSeries,
    layout,
    mode,
    width,
    height,
    valueFormat,
    measureText,
  });
  const { plot } = chart;

  // `active` pode apontar para fora do range se `data` encolher; nesse caso não há banda ativa.
  const activeBand: Band | undefined = active === null ? undefined : chart.bands[active];

  const rowsFor = (i: number): TooltipRow[] => {
    const rows: TooltipRow[] = visibleSeries.map((s, si) => ({
      key: s.key,
      label: s.label,
      value: valueFormat(chart.values[i][si]),
      color: `var(--series-${si + 1})`,
    }));
    return stacked ? [...rows, { key: '__total', label: 'Total', value: valueFormat(chart.totals[i]) }] : rows;
  };

  const announcement =
    focused && activeBand
      ? `${activeBand.label}: ${rowsFor(activeBand.index)
          .map((r) => `${r.label} ${r.value}`)
          .join(', ')}`
      : '';

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const last = chart.bands.length - 1;
    const move = (delta: number) => (active === null ? 0 : Math.min(last, Math.max(0, active + delta)));
    let target: number | null;
    if (e.key === (vertical ? 'ArrowLeft' : 'ArrowUp')) target = move(-1);
    else if (e.key === (vertical ? 'ArrowRight' : 'ArrowDown')) target = move(1);
    else if (e.key === 'Home') target = 0;
    else if (e.key === 'End') target = last;
    else if (e.key === 'Escape') target = null;
    else return;
    e.preventDefault();
    setActive(target);
  };

  const hitRect = (b: Band) =>
    vertical
      ? { x: b.hitStart, y: plot.y, width: b.hitSize, height: plot.height }
      : { x: plot.x, y: b.hitStart, width: plot.width, height: b.hitSize };

  const isEmpty = !loading && data.length === 0;

  const renderBody = () => {
    if (loading) {
      return (
        <div className={styles.skeleton} style={{ height }} aria-hidden="true">
          {SKELETON_HEIGHTS.map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
      );
    }
    if (isEmpty) {
      return (
        <div className={styles.empty} style={{ height }}>
          Sem dados para exibir
        </div>
      );
    }
    if (tableView) {
      return (
        <div className={styles.tableWrap} style={{ maxHeight: height }}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>{title}</caption>
            <thead>
              <tr>
                <th scope="col">{categoryKey}</th>
                {visibleSeries.map((s) => (
                  <th key={s.key} scope="col">
                    {s.label}
                  </th>
                ))}
                {stacked && <th scope="col">Total</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={i}>
                  <th scope="row">{String(d[categoryKey] ?? '')}</th>
                  {visibleSeries.map((s, si) => (
                    <td key={s.key}>{valueFormat(chart.values[i][si])}</td>
                  ))}
                  {stacked && <td>{valueFormat(chart.totals[i])}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    // Antes da primeira medição: reserva a altura sem desenhar.
    if (width === 0) return <div style={{ height }} />;

    return (
      <>
        <svg
          className={styles.svg}
          width={width}
          height={height}
          role="img"
          aria-labelledby={description ? `${titleId} ${descId}` : titleId}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={() => {
            setFocused(true);
            setActive((a) => a ?? 0);
          }}
          onBlur={() => {
            setFocused(false);
            setActive(null);
          }}
          onMouseLeave={() => {
            if (!focused) setActive(null);
          }}
        >
          {activeBand && <rect className={styles.highlight} {...hitRect(activeBand)} />}

          {chart.ticks.map((t) =>
            vertical ? (
              <line
                key={t.value}
                className={t.value === 0 ? styles.baseline : styles.grid}
                x1={plot.x}
                x2={plot.x + plot.width}
                y1={crisp(t.pos)}
                y2={crisp(t.pos)}
              />
            ) : (
              <line
                key={t.value}
                className={t.value === 0 ? styles.baseline : styles.grid}
                x1={crisp(t.pos)}
                x2={crisp(t.pos)}
                y1={plot.y}
                y2={plot.y + plot.height}
              />
            ),
          )}

          {chart.ticks.map((t) =>
            vertical ? (
              <text key={t.value} className={styles.tickLabel} x={plot.x - 8} y={t.pos} textAnchor="end" dominantBaseline="central">
                {t.label}
              </text>
            ) : (
              <text key={t.value} className={styles.tickLabel} x={t.pos} y={plot.y + plot.height + 16} textAnchor="middle">
                {t.label}
              </text>
            ),
          )}

          {chart.bands
            .filter((b) => b.showLabel)
            .map((b) =>
              vertical ? (
                <text key={b.index} x={b.center} y={plot.y + plot.height + 16} textAnchor="middle">
                  {b.displayLabel}
                </text>
              ) : (
                <text key={b.index} x={plot.x - 8} y={b.center} textAnchor="end" dominantBaseline="central">
                  {b.displayLabel}
                </text>
              ),
            )}

          {chart.bands.map((b) => (
            <g key={b.index} className={vertical ? styles.growY : styles.growX}>
              {chart.bars
                .filter((bar) => bar.categoryIndex === b.index)
                .map((bar) => (
                  <path key={bar.id} d={bar.path} style={{ fill: `var(--series-${bar.seriesIndex + 1})` }} />
                ))}
            </g>
          ))}

          {chart.maxLabel && (
            <text
              className={styles.maxLabel}
              x={chart.maxLabel.x}
              y={chart.maxLabel.y}
              textAnchor={vertical ? 'middle' : 'start'}
              dominantBaseline={vertical ? 'auto' : 'central'}
            >
              {chart.maxLabel.text}
            </text>
          )}

          {focused && activeBand && <rect className={styles.focusRing} {...hitRect(activeBand)} />}

          {chart.bands.map((b) => (
            <rect key={b.index} className={styles.hit} {...hitRect(b)} onMouseEnter={() => setActive(b.index)} />
          ))}
        </svg>

        {activeBand && (
          <Tooltip
            title={activeBand.label}
            rows={rowsFor(activeBand.index)}
            x={vertical ? activeBand.center : activeBand.tip}
            y={vertical ? activeBand.tip : activeBand.center}
            placement={vertical ? 'top' : 'right'}
            bounds={{ width, height }}
          />
        )}
      </>
    );
  };

  return (
    <div className={styles.root} aria-busy={loading || undefined}>
      <div className={styles.header}>
        <div>
          <h3 id={titleId} className={styles.title}>
            {title}
          </h3>
          {description && (
            <p id={descId} className={styles.description}>
              {description}
            </p>
          )}
        </div>
        {!loading && !isEmpty && (
          <button type="button" className={styles.toggle} onClick={() => setTableView((v) => !v)}>
            {tableView ? 'Ver gráfico' : 'Ver tabela'}
          </button>
        )}
      </div>

      {visibleSeries.length > 1 && !isEmpty && (
        <ul className={styles.legend}>
          {visibleSeries.map((s, i) => (
            <li key={s.key}>
              <span className={styles.swatch} style={{ background: `var(--series-${i + 1})` }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      <div ref={bodyRef} className={styles.body}>
        {renderBody()}
      </div>

      <div className={styles.srOnly} aria-live="polite">
        {loading ? 'Carregando…' : announcement}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Escrever `index.ts`**

```ts
export { BarChart } from './BarChart';
export type { BarChartProps, Series } from './BarChart';
```

- [ ] **Step 5: Verificar**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/components/BarChart
git commit -m "feat(BarChart): add accessible SVG bar chart with tooltip, keyboard nav and table view"
```

---

### Task 4: Stories, documentação MDX e verificação visual

**Files:**
- Create: `src/components/BarChart/BarChart.stories.tsx`
- Create: `src/components/BarChart/BarChart.mdx`

**Interfaces:**
- Consumes: `BarChart` de `./BarChart` (Task 3).
- Produces: as stories `Vertical`, `Horizontal`, `Agrupado`, `Empilhado`, `Carregando`, `Vazio`, `MuitasCategorias`, `Tabela` sob `Charts/BarChart`, mais a página Docs (MDX).

- [ ] **Step 1: Escrever `BarChart.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BarChart } from './BarChart';

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const formatBRL = (n: number) => brl.format(n);

const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const receitas = [42000, 38500, 51200, 47800, 55300, 61000, 58400, 63900, 59700, 67200, 72500, 81300];
const receitaMensal = meses.map((mes, i) => ({ mes, receita: receitas[i] }));

const produtos = [
  { produto: 'Plano Empresarial Anual com Suporte Premium', vendas: 1840 },
  { produto: 'Plano Profissional Mensal', vendas: 1520 },
  { produto: 'Add-on de Relatórios Avançados', vendas: 1210 },
  { produto: 'Plano Básico', vendas: 980 },
  { produto: 'Consultoria de Implantação (pacote 20h)', vendas: 640 },
  { produto: 'Treinamento Online para Equipes', vendas: 510 },
  { produto: 'Integração Personalizada via API', vendas: 330 },
  { produto: 'Armazenamento Extra 1 TB', vendas: 210 },
];

const canais = [
  { mes: 'Mai', web: 12400, app: 8300, loja: 4100 },
  { mes: 'Jun', web: 13100, app: 9100, loja: 3900 },
  { mes: 'Jul', web: 12800, app: 10400, loja: 4300 },
  { mes: 'Ago', web: 14200, app: 11200, loja: 4000 },
  { mes: 'Set', web: 15000, app: 12900, loja: 4600 },
  { mes: 'Out', web: 15800, app: 14100, loja: 4400 },
];
const seriesCanais = [
  { key: 'web', label: 'Web' },
  { key: 'app', label: 'App' },
  { key: 'loja', label: 'Loja física' },
];

const visitas = Array.from({ length: 30 }, (_, i) => ({
  dia: `${String(i + 1).padStart(2, '0')}/09`,
  visitas: Math.round(1200 + 400 * Math.sin(i / 3) + i * 15),
}));

const meta = {
  title: 'Charts/BarChart',
  component: BarChart,
  argTypes: {
    layout: { control: 'inline-radio', options: ['vertical', 'horizontal'] },
    mode: { control: 'inline-radio', options: ['grouped', 'stacked'] },
    valueFormat: { control: false },
  },
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = {
  args: {
    title: 'Receita mensal',
    description: 'Receita bruta, jan–dez 2026',
    data: receitaMensal,
    categoryKey: 'mes',
    series: [{ key: 'receita', label: 'Receita' }],
    valueFormat: formatBRL,
  },
};

export const Horizontal: Story = {
  args: {
    title: 'Produtos mais vendidos',
    description: 'Unidades vendidas no trimestre',
    data: produtos,
    categoryKey: 'produto',
    series: [{ key: 'vendas', label: 'Vendas' }],
    layout: 'horizontal',
    height: 360,
  },
};

export const Agrupado: Story = {
  args: {
    title: 'Pedidos por canal',
    description: 'Comparação entre canais, mai–out',
    data: canais,
    categoryKey: 'mes',
    series: seriesCanais,
    mode: 'grouped',
  },
};

export const Empilhado: Story = {
  args: {
    title: 'Pedidos por canal',
    description: 'Composição do total mensal, mai–out',
    data: canais,
    categoryKey: 'mes',
    series: seriesCanais,
    mode: 'stacked',
  },
};

export const Carregando: Story = {
  args: { title: 'Receita mensal', data: receitaMensal, categoryKey: 'mes', series: [{ key: 'receita', label: 'Receita' }], loading: true },
};

export const Vazio: Story = {
  args: { title: 'Receita mensal', data: [], categoryKey: 'mes', series: [{ key: 'receita', label: 'Receita' }] },
};

export const MuitasCategorias: Story = {
  name: 'Muitas categorias',
  args: {
    title: 'Visitas diárias',
    description: 'Setembro de 2026',
    data: visitas,
    categoryKey: 'dia',
    series: [{ key: 'visitas', label: 'Visitas' }],
  },
};

export const Tabela: Story = {
  args: { title: 'Pedidos por canal', data: canais, categoryKey: 'mes', series: seriesCanais, mode: 'stacked', showTable: true },
};
```

- [ ] **Step 2: Escrever `BarChart.mdx`**

O MDX vinculado com `<Meta of>` é a página Docs do componente. A tabela de props vem do `<ArgTypes>` (react-docgen), o mesmo mecanismo do autodocs.

```mdx
import { Meta, Canvas, ArgTypes } from '@storybook/addon-docs/blocks';
import * as Stories from './BarChart.stories';

<Meta of={Stories} />

# BarChart

Compara magnitudes entre categorias. Uma única API cobre quatro variantes: `layout` (vertical/horizontal) × `mode` (agrupado/empilhado) × número de séries.

<Canvas of={Stories.Vertical} />

## Quando usar

- **Barras**: comparar valores entre categorias discretas (meses, produtos, regiões).
- **Linha em vez de barras**: tendência contínua no tempo com muitos pontos. Barras com mais de ~30 categorias viram ruído.
- **Horizontal**: rótulos longos ou rankings. O nome fica legível sem rotação.

<Canvas of={Stories.Horizontal} />

## Agrupado vs. empilhado

- **Agrupado**: compara as séries entre si dentro de cada categoria.
- **Empilhado**: mostra a composição e o total. Só o segmento da base é comparável com precisão entre categorias.

<Canvas of={Stories.Agrupado} />
<Canvas of={Stories.Empilhado} />

## Acessibilidade

- O gráfico é focável. Use **←/→** (ou **↑/↓** no horizontal) para navegar pelas categorias, **Home/End** para ir às extremidades e **Esc** para limpar a seleção. Cada categoria é anunciada por leitor de tela.
- **Ver tabela** mostra os mesmos dados numa `<table>` semântica.
- A identidade das séries nunca depende só da cor: legenda, tooltip e tabela trazem os nomes.

## Faça / Não faça

| Faça | Não faça |
|------|----------|
| Mantenha a ordem de `series` estável para as cores não mudarem | Reordenar séries entre gráficos do mesmo dashboard |
| Agrupe o excedente em "Outros" a partir da 8ª série | Passar mais de 8 séries (o excedente é descartado) |
| Use `valueFormat` para moeda e unidades | Truncar o eixo: ele sempre começa em 0 |
| Deixe o destaque só no maior valor | Pôr número em cada barra |

## Props

<ArgTypes of={Stories} />
```

- [ ] **Step 3: Verificar build**

Run: `npm run typecheck && npm run build-storybook`
Expected: typecheck sem erros; o build termina com `Output directory: .../storybook-static`.

- [ ] **Step 4: Verificação visual (Review Focus incluso)**

Run: `npm run storybook` e abra `http://localhost:6006`. Se não tiver browser, peça ao usuário para conferir ou use a skill `anthropic-skills:chrome-browser`.

Confira cada item nos temas **Light** e **Dark** (toolbar "Tema"):

1. As stories `Vertical`, `Horizontal`, `Agrupado`, `Empilhado`, `Carregando`, `Vazio`, `Muitas categorias` e `Tabela` renderizam sem erro no console.
2. Barras com no máximo 24px, ponta arredondada e base reta, gap visível entre as barras agrupadas e entre os segmentos empilhados.
3. Label em negrito só no maior valor (no `Empilhado`, sobre a maior pilha).
4. Hover em qualquer ponto da faixa da categoria mostra o tooltip com todas as séries (mais o Total no empilhado). O tooltip nunca sai do card.
5. Tab até o gráfico, depois as setas, Home, End e Esc: o anel de foco acompanha a categoria e o tooltip aparece.
6. `Horizontal`: nomes longos truncados com `…`, nome completo no tooltip.
7. `Muitas categorias`: rótulos do eixo X alternados, sem sobreposição.
8. "Ver tabela" / "Ver gráfico" alternam corretamente.
9. Com o "Reduce motion" do SO ativado, as barras aparecem sem animação.
10. **Review Focus**, via painel Controls na story `Vertical`:
    - Edite `data` para `[{"mes":"A","receita":-5},{"mes":"B","receita":"abc"},{"mes":"C"},{"mes":"D","receita":10}]`: só D tem barra e não há erro no console.
    - Edite `data` para que todas as receitas sejam `0`: eixo 0–1, sem label de máximo, sem erro.
    - Reduza o viewport (toolbar Viewport, ou a janela) até o card ficar com menos de 150px: sem barras e sem erro.
    - Em `Muitas categorias`, foque o gráfico, pressione End e troque `data` em Controls por um array de 3 itens: o tooltip some e não há erro.
    - Em `Agrupado`, edite `series` com 9 itens de `key` distintas (`web`, `app`, `loja`, `s4`…`s9`; séries sem dados viram 0): um `console.warn` e 8 séries na legenda.

Se algum item falhar, corrija o código na task dona do item e repita os Steps 3 e 4.

- [ ] **Step 5: Commit**

```bash
git add src/components/BarChart/BarChart.stories.tsx src/components/BarChart/BarChart.mdx
git commit -m "docs(BarChart): add stories and usage documentation"
```
