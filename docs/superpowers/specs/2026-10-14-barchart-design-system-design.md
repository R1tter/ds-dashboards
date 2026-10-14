# BarChart — Design System para dashboards

Data: 2026-10-14
Status: aprovado em conversa, aguardando revisão da spec

## Objetivo

Criar do zero um projeto React com Storybook que sirva como design system de estudo/portfólio para um app de dashboards. O escopo é **um único componente**: `BarChart`, moderno, acessível e seguindo boas práticas de UX de visualização de dados.

### Critérios de sucesso

- `npm run storybook` sobe sem erros e mostra todas as stories listadas abaixo.
- O componente funciona nos temas light e dark, alternados pela toolbar do Storybook.
- Navegação por teclado, tooltip e alternância para tabela funcionam em todas as variantes.
- A página de docs (MDX + autodocs) explica quando usar, do/don't e a API.

### Fora do escopo

- Outros componentes (linha, pizza, KPI etc.).
- Testes automatizados (decisão explícita: apenas Storybook).
- Valores negativos e eixo divergente.
- Publicação em npm, build de biblioteca.

## Stack

- Vite + React 19 + TypeScript (strict)
- Storybook 9 com framework `@storybook/react-vite` e autodocs
- `d3-scale` como única dependência de runtime além do React (escalas `scaleBand`/`scaleLinear` e `ticks()`/`nice()`)
- CSS Modules + CSS custom properties para tokens
- npm

## Estrutura de arquivos

```
src/
  tokens/tokens.css            # tokens globais; temas via [data-theme]
  components/BarChart/
    BarChart.tsx               # componente público, renderização SVG
    BarChart.module.css
    useBarLayout.ts            # função pura: dados + dimensões -> geometria
    Tooltip.tsx
    BarChart.stories.tsx
    BarChart.mdx               # guia de uso
    index.ts
.storybook/
  main.ts
  preview.tsx                  # importa tokens.css; toolbar global de tema
```

Responsabilidades:

- **`useBarLayout`**: recebe dados, séries, layout, modo, largura e altura e devolve escalas, retângulos (x, y, largura, altura, cor, série, categoria, valor), ticks e a posição do label de máximo. Não conhece React DOM nem CSS. Pode ser lida e entendida isoladamente.
- **`BarChart`**: mede a largura do container com `ResizeObserver`, chama `useBarLayout`, renderiza SVG, legenda, tooltip, região `aria-live` e a tabela alternativa. Também guarda o estado de categoria ativa (hover/foco).
- **`Tooltip`**: apresentação pura, posicionada em HTML absoluto sobre o SVG.

## Tokens

O arquivo `tokens.css` define em `:root` (light) e em `[data-theme="dark"]`:

- Superfícies: `--surface-page`, `--surface-chart` (light `#fcfcfb` / dark `#1a1a19`)
- Texto: `--text-primary`, `--text-secondary`, `--text-muted`
- Chrome do gráfico: `--grid` (hairline), `--axis` (baseline)
- Séries: `--series-1` … `--series-8`, com a paleta categórica validada do skill `dataviz`:

| Slot | Light | Dark |
|------|-------|------|
| 1 azul | `#2a78d6` | `#3987e5` |
| 2 laranja | `#eb6834` | `#d95926` |
| 3 água | `#1baf7a` | `#199e70` |
| 4 amarelo | `#eda100` | `#c98500` |
| 5 magenta | `#e87ba4` | `#d55181` |
| 6 verde | `#008300` | `#008300` |
| 7 violeta | `#6250d6` | `#9085e9` |
| 8 vermelho | `#e34948` | `#e66767` |

- Espaço (`--space-1..6`, base 4px), raio (`--radius-sm` 4px), tipografia (`system-ui`, tamanhos 12/14/16) e foco (`--focus-ring`).

O tema dark tem valores próprios, validados contra a superfície escura. Não é uma inversão automática. A preferência do sistema (`prefers-color-scheme`) vale quando não há `data-theme` explícito.

## API

```ts
type Series = { key: string; label: string };

type BarChartProps<T extends Record<string, unknown>> = {
  data: T[];
  categoryKey: keyof T;
  series: Series[];                      // 1 a 8 séries
  layout?: 'vertical' | 'horizontal';    // default 'vertical'
  mode?: 'grouped' | 'stacked';          // default 'grouped'; ignorado com 1 série
  title: string;                         // obrigatório
  description?: string;
  height?: number;                       // default 320 (px)
  valueFormat?: (n: number) => string;   // default Intl.NumberFormat('pt-BR', { notation: 'compact' })
  loading?: boolean;                     // default false
  showTable?: boolean;                   // estado inicial do toggle gráfico/tabela; default false
};
```

As quatro variantes saem da combinação `layout` × `mode` × número de séries:

| Variante | Props |
|----------|-------|
| Vertical simples | 1 série, `layout="vertical"` |
| Horizontal | `layout="horizontal"` |
| Agrupado | 2+ séries, `mode="grouped"` |
| Empilhado | 2+ séries, `mode="stacked"` |

A cor de cada série é definida pelo seu índice em `series` (`--series-{i+1}`). Assim, a série mantém a mesma cor quando outras são removidas pelo consumidor, desde que a ordem do array seja preservada. Com mais de 8 séries, o componente emite `console.warn` e renderiza apenas as 8 primeiras. A doc orienta agrupar o excedente em "Outros".

## Especificação visual

- Barra com espessura máxima de **24px**. A faixa (`band`) pode ser maior, e a sobra vira espaço livre.
- Ponta de dado com raio de **4px**, base reta. É desenhada como `<path>`, não como `rx` em `<rect>`, para manter a base quadrada.
- **Gap de 2px** na cor da superfície entre barras vizinhas no modo agrupado e entre segmentos no modo empilhado.
- Gridlines hairline de 1px, sólidas, cor `--grid`, somente no eixo de valor. A baseline usa `--axis`.
- O eixo de valor começa sempre em 0, com domínio `nice()` e cerca de 5 ticks formatados por `valueFormat`.
- No horizontal, os rótulos de categoria ficam à esquerda. A largura reservada é medida a partir do texto (limite de 40% da largura). Quando o rótulo passa disso, é truncado com `…` e o texto completo aparece no tooltip e na tabela.
- No vertical, quando os rótulos de categoria não cabem na faixa, são exibidos alternadamente (1 a cada N).
- **Label direto apenas no maior valor**: no topo da coluna, no fim da barra horizontal ou, no modo empilhado, no total da maior pilha. Nunca há número em todas as barras.
- A legenda aparece somente com 2 ou mais séries, acima do gráfico. Cada item tem swatch colorido e texto em `--text-secondary`. Texto nunca usa a cor da série.
- Animação de entrada: as barras crescem a partir da baseline em 400ms ease-out. Fica desativada com `prefers-reduced-motion: reduce`.

## Interação

- **Hover**: a área de hit é a faixa inteira da categoria (retângulo transparente). A categoria ativa recebe um realce de fundo sutil, e as barras das outras categorias não mudam.
- **Tooltip**: um tooltip por categoria, com o nome da categoria e uma linha por série (swatch, label, valor formatado). No modo empilhado, inclui também uma linha de **Total**. O tooltip fica preso aos limites do container.
- **Teclado**: o SVG é focável (`tabIndex=0`). As setas ←/→ (vertical) ou ↑/↓ (horizontal) movem a categoria ativa, e Home/End vão para a primeira e a última. Escape limpa a seleção. O foco aparece com `--focus-ring` em volta da faixa ativa. Ao receber foco, a primeira categoria fica ativa.
- **Toggle gráfico/tabela**: botão no cabeçalho do componente que alterna entre o SVG e uma `<table>` semântica (`<caption>` = title, `<th scope>` em linhas e colunas, mais uma coluna Total no modo empilhado).

## Acessibilidade

- O SVG tem `role="img"` e `aria-labelledby` apontando para o título visível e para `description`.
- Uma região `aria-live="polite"` visualmente oculta anuncia a categoria ativa e seus valores durante a navegação por teclado.
- Identidade das séries nunca depende só da cor: legenda sempre presente com 2 ou mais séries, tooltip com labels e tabela como alternativa equivalente.
- Contraste de texto ≥ 4,5:1 nos dois temas. As marcas usam a paleta validada. Slots com contraste abaixo de 3:1 no light (água, amarelo, magenta) são compensados pela legenda, pelo tooltip e pela tabela.

## Estados

- **`loading`**: skeleton com barras cinza em altura variada e animação de pulso (estática com reduced-motion), além de `aria-busy="true"`.
- **Vazio** (`data.length === 0`): mensagem centralizada "Sem dados para exibir" na área do gráfico. O título continua visível.
- **Largura zero** (antes da primeira medição): não renderiza o SVG, evitando um flash de layout errado.

## Stories

Em `BarChart.stories.tsx`, com autodocs e controles para todas as props:

1. Vertical simples (receita mensal, 12 meses)
2. Horizontal (ranking de 8 produtos com nomes longos)
3. Agrupado (3 canais × 6 meses)
4. Empilhado (3 canais × 6 meses)
5. Loading
6. Vazio
7. Muitas categorias (30 dias), para testar rótulos alternados
8. Tabela (`showTable: true`)

A toolbar global do Storybook alterna o tema light/dark (`data-theme` no `<html>`).

## Documentação (`BarChart.mdx`)

- Quando usar barras: comparar magnitudes entre categorias. Quando usar linha em vez de barras: tendência contínua no tempo, com muitos pontos.
- Quando usar horizontal: rótulos longos e rankings.
- Agrupado vs. empilhado: comparar séries entre si vs. ver composição e total.
- Do/don't: não truncar o eixo, não usar mais de 8 séries, não usar cores fora da paleta, não pôr número em toda barra.
- Tabela de props (gerada pelo autodocs).
