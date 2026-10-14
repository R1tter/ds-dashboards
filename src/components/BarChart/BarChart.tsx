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
