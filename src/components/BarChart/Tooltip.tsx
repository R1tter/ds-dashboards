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
