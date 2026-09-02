# DESIGN_SYSTEM.md — Diretrizes Oficiais de Interface e Redesign

> **Documento Canônico de Interface**: Este arquivo estabelece as regras de design, tipografia, cores, densidade e padrões de componentes para o **Mapa Comparativo de Cotações**. Qualquer alteração de frontend, nova tela ou refatoração visual deve seguir estritamente estas diretrizes.

---

## 1. Princípios Fundamentais

1. **Desktop de Alta Densidade**: O aplicativo é uma ferramenta de trabalho diário de compras. Telas devem aproveitar o espaço vertical e horizontal, evitando paddings inflados, elementos gigantescos ou rolagem desnecessária.
2. **Coerência Visual Absoluta**: Todas as 11 telas devem parecer partes de um mesmo software coeso. Elementos idênticos (cabeçalhos, KPIs, botões, modais) devem ter exatamente o mesmo aspecto e comportamento.
3. **Foco e Clareza Decisória**: Cores não são enfeites aleatórios; são **tokens semânticos** que guiam a decisão do comprador (identificar menor preço, conferir pedido mínimo, verificar rodada aberta/fechada).
4. **Agilidade por Teclado**: Formulários devem priorizar navegação fluida via `Tab` e `Enter`, com atalhos de teclado visíveis através de `<Kbd size="xs">`.
5. **Zero Hexadecimais Fixos no Código (Fidelidade Dual-Theme)**: Nunca utilize valores hexadecimais arbitrários inline (ex: `#fff`, `#dee2e6`, `#ffa8a8`). Todos os estilos devem utilizar tokens do Mantine ou variáveis CSS adaptativas ao tema Claro e Escuro.

---

## 2. Sistema de Cores e Tokens Semânticos

A interface utiliza um modelo híbrido de **Cor Institucional Dinâmica** + **Cores Semânticas Estritas**:

### 2.1 Cor Institucional / Primária (`themeColor`)
- Definida dinamicamente pela preferência do usuário nas Configurações (`app_theme_color` / prop `themeColor`).
- **Uso Exclusivo**:
  - Ícone de cabeçalho padrão de cada tela no `<PageHeader>`.
  - Botão de ação primária da tela/formulário (`variant="filled"`).
  - Aba ativa no menu lateral (`AppShell.Navbar`).
  - Destaques de navegação, barras de foco e seleção ativa.
- **Regra de Ouro**: Nenhuma tela deve fixar sua própria cor institucional no cabeçalho (ex: nada de Produto ser `blue`, Fornecedor ser `cyan`, Cotação ser `teal`, Necessidade ser `indigo`). Todas devem herdar a `themeColor` do app.

### 2.2 Tokens Semânticos Estritos
As seguintes cores possuem significado fixo e não devem ser usadas fora do seu propósito:

| Cor / Token | Significado no Domínio | Onde Usar | Onde NUNCA Usar |
| :--- | :--- | :--- | :--- |
| **Teal / Verde** | Sucesso, menor preço, aprovação | Cotação mais barata (🏆), pedido mínimo atingido, backup com sucesso, status "Salvo" | Em botões genéricos de navegação ou títulos de tela |
| **Red / Vermelho** | Alerta crítico, bloqueio, perigo | Pedido abaixo do mínimo, rodada cancelada, botões de exclusão/formatação, erros | Em elementos informativos que não sejam impeditivos |
| **Yellow / Laranja** | Aviso não impeditivo, atenção | Itens sem cotação, rodada em atenção, aviso de permissão de pasta | Em ações primárias de sucesso |
| **Blue / Azul** | Ação secundária, link, atalho | Botões de divisão de alocação, download de planilha, abas neutras | Para sinalizar menor preço |
| **Gray / Neutro** | Inatividade, histórico, secundário | Rodada fechada, fornecedor inativo, textos secundários (`c="dimmed"`), bordas | Para indicar status positivo |

---

## 3. Escala Tipográfica e Hierarquia

A tipografia é dimensionada com base na escala dinâmica configurada no `:root` (`--app-font-base`, padrão 13.5px):

```
Título da Tela (PageHeader)       →  Title order={3} (fontSize: 1.05rem, fw: 700, lineHeight: 1.2)
Título de Seção (SectionCard)     →  Title order={5} (fontSize: 0.88rem, fw: 600)
Subtítulos e Metadados            →  Text size="xs" ou size="11px" c="dimmed"
Rótulos de KPIs (StatCard)        →  Text size="11px" fw={700} c="dimmed" tt="uppercase"
Valores Numéricos em KPIs         →  Title order={3} (fontSize: 1.25rem, fw: 700)
Textos de Células de Tabela       →  Text size="xs" (fw: 600 para nomes principais, normal para demais)
Atalhos de Teclado                →  Componente <Kbd size="xs">
```

---

## 4. Espaçamento, Densidade e Layout

### 4.1 Estrutura de Página
Toda e qualquer tela da aplicação deve ter como elemento raiz:
```tsx
<Stack gap="xs" style={{ width: '100%' }}>
  <PageHeader ... />
  {/* Conteúdo da tela */}
</Stack>
```

### 4.2 Containers e Cartões
- **`<SectionCard>`** (ou `<Card withBorder radius="sm" p="sm">`): Usado para formulários de inclusão rápida e seções principais.
- **`<Paper withBorder radius="sm" p="xs">`**: Usado para cartões estatísticos compactos, barras de filtros e agrupamentos secundários.
- **Paddings Proibidos**: Nunca usar `p="xl"` ou `p="lg"` em telas de rotina de trabalho (reservado exclusivamente para telas de modal ou boas-vindas).

---

## 5. Componentes Padrão de Interface

### 5.1 `<PageHeader>`
Obrigatório em **todas as 11 telas** (incluindo `RodadasView`, `ConfiguracoesView` e `EstatisticasView`):
- `icon`: Ícone temático da tela (`@tabler/icons-react`).
- `iconColor`: Herdado dinamicamente de `themeColor`.
- `title`: Nome claro da funcionalidade (ex: "Cadastro de Produtos", "Mapa Comparativo de Cotações").
- `subtitle`: Breve instrução de uso (visível em telas médias/largas).
- `rightSection`: Reservado para controles globais da rodada (`RoundHeaderSelector`) ou botões de exportação/importação.

### 5.2 `<RoundHeaderSelector>`
Posicionado no `rightSection` de todas as telas vinculadas a rodadas (`Necessidades`, `Cotações`, `Comparação`, `Alocação`, `Resumo`, `Pedido`):
- **Tamanho Único**: `AppSelect` e Botão "Nova" devem utilizar estritamente **`size="xs"`**.
- **Sem Duplicação**: O seletor já exibe o status `(Aberta/Fechada)`. Telas **não devem** renderizar badges adicionais de "Rodada Fechada" ao lado do seletor.

### 5.3 `<StatCard>`
Componente obrigatório para qualquer painel de métricas (presente em `Alocação`, `Resumo`, `Comparação`, `Estatísticas`, `Pedido`):
- Dispostos em grid de 3 colunas: `<SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">`.
- Estrutura:
  - `label`: Nome da métrica (11px uppercase dimmed).
  - `value`: Valor formatado em destaque (Title order={3}).
  - `subtitle`: Explicação complementar em 10px dimmed.
  - `color`: Cor semântica do cartão.
  - `icon`: Ícone correspondente no canto direito.

### 5.4 `<EmptyState>`
Exibição visual padrão quando listas, filtros ou tabelas não tiverem dados:
- Ícone sutil centralizado.
- Título claro explicando por que está vazio.
- Descrição orientando o usuário sobre o que fazer.
- Botão de ação direta sugerida (ex: *"Criar Primeira Rodada"*, *"Adicionar Produtos"*).

---

## 6. Padrões de Tabelas

As tabelas são o núcleo do software de compras e devem seguir alinhamentos rígidos:

1. **Alinhamento de Conteúdo**:
   - **Esquerda (`textAlign: 'left'`)**: Nomes de produtos, fornecedores, marcas, descrições.
   - **Direita (`textAlign: 'right'`)**: Preços unitários, preços de embalagem, subtotais monetários, quantidades.
   - **Centro (`textAlign: 'center'`)**: Unidades (`UN`, `KG`, `CX`), datas, contadores, status e coluna de ações.
2. **Estilo Visual**:
   - Cabeçalhos (`Table.Th`): texto em caixa alta ou semi-negrito sutil, fundo neutro suave.
   - Zebrado: sempre ativo (`striped`).
   - Hover: sempre ativo (`highlightOnHover`).
   - Bordas: `withTableBorder` limpo.
3. **Ações de Linha**:
   - Sempre em `<Group gap={4} wrap="nowrap" justify="center">`.
   - Utilizar `<ActionIcon variant="subtle" size="sm">` com ícones de tamanho 16px.

---

## 7. Diretrizes Específicas da Tela de Comparação ("Super-Planilha")

A tela de Comparação mantém o formato de **Matriz / Planilha Excel**, com as seguintes regras de aprimoramento:

1. **Congelar Painéis Nativo**:
   - **Coluna A (Produto e Categoria)**: Fixada à esquerda com `position: sticky; left: 0; z-index: 2;`.
   - **Linha de Cabeçalho (Fornecedores)**: Fixada no topo com `position: sticky; top: 0; z-index: 3;`.
   - O usuário pode rolar 10 fornecedores horizontalmente e 50 produtos verticalmente sem perder a referência.
2. **Fim da Poluição de Cores**:
   - As células de cotação padrão utilizam fundo limpo e neutro.
   - Apenas o **1º colocado (menor preço)** recebe o destaque verde suave (`teal`) com distintivo visual de vitória.
   - Eliminar fundos amarelos e vermelhos nas células comuns para evitar a "salada de cores".
3. **Cálculo de Vantagem**:
   - A coluna de "Menor Preço" deve exibir claramente a **economia percentual e absoluta** frente ao 2º colocado (ex: *"-15% vs 2º lugar"*).
4. **Foco Analítico**:
   - A tela de Comparação é estritamente analítica. Não incluir botões intrusivos que forcem o desvio da atenção do comprador.

---

## 8. Formulários, Inputs e Modais

1. **Tamanho Universal de Inputs**:
   - Todos os componentes `<TextInput>`, `<AppSelect>`, `<AppAutocomplete>`, `<NumberInput>` e `<Button>` de formulário devem usar **`size="xs"`**.
2. **Modais de Confirmação e Edição**:
   - Título sempre acompanhado de ícone temático (`<ThemeIcon size="md" variant="light">`).
   - `centered={true}` e `radius="sm"`.
   - Rodapé com ações alinhadas à direita:
     ```tsx
     <Group justify="flex-end" gap="xs" mt="md">
       <Button variant="subtle" color="gray" size="xs" onClick={closeModal}>
         Cancelar
       </Button>
       <Button variant="filled" color={themeColor} size="xs" type="submit">
         Salvar
       </Button>
     </Group>
     ```

---

## 9. Checklist de Validação de Interface

Antes de considerar qualquer tela ou componente concluído, valide os 6 pontos:

- [ ] **Herança de Tema**: O cabeçalho e botões principais respeitam `themeColor` em vez de uma cor fixa arbitrária?
- [ ] **Densidade Compacta**: Todos os inputs e botões estão no tamanho `size="xs"`?
- [ ] **Alinhamento Numérico**: Valores em R$ e quantidades estão rigorosamente alinhados à direita?
- [ ] **Modo Escuro**: Foi testado no Dark Mode sem nenhum hex fixo estourando contraste ou ilegível?
- [ ] **Componentes Padronizados**: Utiliza `<PageHeader>`, `<StatCard>`, `<SectionCard>` e `<EmptyState>` em vez de recriações ad-hoc?
- [ ] **Teclado**: É possível preencher e submeter formulários usando `Tab` e `Enter`?
