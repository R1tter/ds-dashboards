import type { Meta, StoryObj } from '@storybook/react-vite';
import { barChartVariants as v } from '../../mocks/barChart';
import { BarChart } from './BarChart';

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

export const Vertical: Story = { args: v.vertical.props };
export const Horizontal: Story = { args: v.horizontal.props };
export const Agrupado: Story = { args: v.agrupado.props };
export const Empilhado: Story = { args: v.empilhado.props };
export const Carregando: Story = { args: v.carregando.props };
export const Vazio: Story = { args: v.vazio.props };
export const MuitasCategorias: Story = { name: 'Muitas categorias', args: v.muitasCategorias.props };
export const Tabela: Story = { args: v.tabela.props };
