import { useEffect, useState } from 'react';
import styles from './App.module.css';
import { BarChart, type BarChartProps } from './components/BarChart';
import { barChartVariants, type BarChartVariant } from './mocks/barChart';

type Theme = 'light' | 'dark';

const variantKeys = Object.keys(barChartVariants) as BarChartVariant[];

export function App() {
  const [variant, setVariant] = useState<BarChartVariant>('vertical');
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  // Widening para o tipo genérico: cada variante tem um formato de linha diferente.
  const chartProps: BarChartProps<Record<string, unknown>> = barChartVariants[variant].props;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>BarChart</h1>
        <div className={styles.controls}>
          <label className={styles.field}>
            Variante
            <select value={variant} onChange={(e) => setVariant(e.target.value as BarChartVariant)}>
              {variantKeys.map((key) => (
                <option key={key} value={key}>
                  {barChartVariants[key].label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={styles.themeButton}
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            Tema escuro
          </button>
        </div>
      </header>

      {/* key remonta o gráfico: reseta o estado interno e replays a animação de entrada */}
      <BarChart key={variant} {...chartProps} />
    </main>
  );
}
