import type { BarChartProps } from '../components/BarChart';

type Props = BarChartProps<Record<string, unknown>>;

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
const seriesReceita = [{ key: 'receita', label: 'Receita' }];

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

/** Variantes do BarChart com dados mock, usadas pelas stories e pela página de demo. */
export const barChartVariants = {
  vertical: {
    label: 'Vertical',
    props: {
      title: 'Receita mensal',
      description: 'Receita bruta, jan–dez 2026',
      data: receitaMensal,
      categoryKey: 'mes',
      series: seriesReceita,
      valueFormat: formatBRL,
    },
  },
  horizontal: {
    label: 'Horizontal',
    props: {
      title: 'Produtos mais vendidos',
      description: 'Unidades vendidas no trimestre',
      data: produtos,
      categoryKey: 'produto',
      series: [{ key: 'vendas', label: 'Vendas' }],
      layout: 'horizontal',
      height: 360,
    },
  },
  agrupado: {
    label: 'Agrupado',
    props: {
      title: 'Pedidos por canal',
      description: 'Comparação entre canais, mai–out',
      data: canais,
      categoryKey: 'mes',
      series: seriesCanais,
      mode: 'grouped',
    },
  },
  empilhado: {
    label: 'Empilhado',
    props: {
      title: 'Pedidos por canal',
      description: 'Composição do total mensal, mai–out',
      data: canais,
      categoryKey: 'mes',
      series: seriesCanais,
      mode: 'stacked',
    },
  },
  carregando: {
    label: 'Carregando',
    props: { title: 'Receita mensal', data: receitaMensal, categoryKey: 'mes', series: seriesReceita, loading: true },
  },
  vazio: {
    label: 'Vazio',
    props: { title: 'Receita mensal', data: [], categoryKey: 'mes', series: seriesReceita },
  },
  muitasCategorias: {
    label: 'Muitas categorias',
    props: {
      title: 'Visitas diárias',
      description: 'Setembro de 2026',
      data: visitas,
      categoryKey: 'dia',
      series: [{ key: 'visitas', label: 'Visitas' }],
    },
  },
  tabela: {
    label: 'Tabela',
    props: { title: 'Pedidos por canal', data: canais, categoryKey: 'mes', series: seriesCanais, mode: 'stacked', showTable: true },
  },
} satisfies Record<string, { label: string; props: Props }>;

export type BarChartVariant = keyof typeof barChartVariants;
