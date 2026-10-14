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
