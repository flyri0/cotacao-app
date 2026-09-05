# AGENTS.md — Mapa Comparativo de Cotações

## Visão geral
App desktop para comparar cotações de fornecedores e gerar pedidos de
compra, substituindo um processo manual de planilha. Uso interno, uma
pessoa/equipe de compras.

## Stack
- **Backend**: Python 3.8+ (compatível com Windows 7 32-bit e Windows 10/11), SQLite (arquivo local)
- **Modos de Exibição (Dual-Mode)**:
  - **Janela Nativa**: via `pywebview` (`window.pywebview.api`).
  - **Navegador Padrão**: via micro-servidor HTTP local integrado (`server.py`, biblioteca padrão `http.server`), ideal para Windows 7 32-bit sem WebView2 e máquinas de baixo consumo.
  - **Instância Única (Single Instance)**: se o programa já estiver em execução na porta 54321, nova inicialização apenas reabre a aba no navegador e encerra o processo duplicado.
  - **Frontend Isomórfico**: Proxy transparente em `frontend/src/services/api.ts` que direciona para pywebview ou REST POST `/api/*` sem alterar componentes React.
- **Frontend**: React (Vite) + Mantine (core, hooks, form, notifications) + Mantine React Table
- **Empacotamento**: PyInstaller (para Win7 32-bit, compilar com Python 3.8.10 x86)

## Por que essa stack (não trocar sem justificativa forte)
- pywebview evita a complexidade do Electron mantendo um app nativo leve.
- O micro-servidor embutido usa apenas a biblioteca padrão do Python (`http.server`), garantindo compatibilidade imediata com Windows 7 (32 bits) sem precisar instalar WebView2 runtime nem frameworks pesados (Flask/FastAPI).
- SQLite evita gerenciar um servidor de banco — arquivo único, fácil de dar backup.
- Mantine resolve autocomplete (`Autocomplete`/`Select` pesquisável) e
  tabelas de forma nativa. Esse ponto é importante: versões anteriores
  deste projeto em Excel e HTML puro gastaram bastante esforço tentando
  simular autocomplete — aqui isso já vem pronto, não reinvente.

## Modelo de domínio — leia antes de mexer no schema
- **Produto**: cadastro mestre com `nome` (único), `categoria` e `ativo` (não guarda unidade fixa).
- **Fornecedor**: cadastro mestre, tem `pedido_minimo`.
- **Rodada**: um ciclo de cotação. Necessidades/Cotações/Alocações sempre
  se referem a uma rodada (`id_rodada`).
- **Necessidade**: itens em falta selecionados para a rodada — é a
  "lista de produtos em falta" do processo que este app gerencia (sem definição
  prévia de volume; quantidades são definidas diretamente na tela de Alocação).
- **Cotação**: um preço recebido de um fornecedor pra um produto numa
  rodada. Guarda `marca` (marca ofertada pelo fornecedor), `embalagem`
  (descrição da embalagem comercial), `qtd_por_embalagem`, `unidade` (unidade
  de medida do conteúdo — ex: UN, KG, L) e `preco_embalagem` separados.
  **O preço unitário é sempre calculado**
  (`preco_embalagem / qtd_por_embalagem`), nunca guardado nem digitado
  direto. Isso existe porque fornecedores diferentes vendem o mesmo
  produto em embalagens diferentes (ex: caixa de 6 vs. unidade) — comparar
  preço bruto sem normalizar dá resultado errado.
- **Auto-cadastro de Produto (Cotação e Necessidades)**: qualquer produto
  digitado ou importado na tela de Cotações ou na tela de Necessidades que não
  exista ainda no cadastro de Produtos é cadastrado automaticamente no banco
  e adicionado às necessidades da rodada ativa. Essa regra de auto-cadastro se
  aplica exclusivamente a Produtos — Fornecedores continuam exigindo
  correspondência prévia no cadastro.
- **Alocação**: a decisão real de compra. **Pode (e deve poder) haver
  múltiplas linhas de Alocação pro mesmo produto na mesma rodada**, cada
  uma com fornecedor e quantidade diferentes. Isso é proposital — é o
  mecanismo que permite dividir um produto entre dois fornecedores (ex:
  pra bater o pedido mínimo de cada um) ou mover a compra de um produto
  pra outro fornecedor. **Nunca modele Alocação com uma constraint de
  unicidade por (rodada, produto)** — isso quebraria a funcionalidade
  central do app.
- Quantidade em Alocação é arredondada pra cima pro múltiplo da embalagem
  na hora de calcular quanto efetivamente comprar (não dá pra comprar meia
  caixa) — a sobra por arredondamento da embalagem cotada fica visível
  na UI (+X sobra).
- **Configurações & Acessibilidade**: tela de Configurações permite ajustar
  a identidade visual (nome, subtítulo, ícone, tema claro/escuro, cor de destaque)
  e a experiência de exibição:
  - `app_densidade`: `'compacto'` (padrão desktop de alta densidade, reduzindo
    paddings de tabela e cards) ou `'confortavel'` (mais espaçamento).
  - `app_tamanho_fonte`: `'pequeno'` (12px), `'medio'` (13.5px padrão) ou `'grande'`
    (15px para acessibilidade de idosos/baixa visão).
  - Todas as preferências são persistidas no SQLite (tabela `configuracoes`)
    e aplicadas instantaneamente no frontend via atributos `data-density` e
    `data-font-size` no elemento raiz `:root`.

## Regras de negócio que a UI precisa expor
1. **Comparação**: preço unitário normalizado de cada fornecedor por
   produto, com destaque visual pro menor.
2. **Alocação**: permitir adicionar quantas linhas quiser pro mesmo
   produto (dividir/mover), recalculando subtotal e sobras de embalagens
   em tempo real com salvamento contínuo (autosave).
3. **Resumo por fornecedor**: soma o total alocado e compara com
   `pedido_minimo` — sinalizar claramente quando não bateu.
4. **Pedido**: gerar texto por fornecedor, agrupando as linhas de
   Alocação daquele fornecedor na rodada ativa, com botão de copiar e DANFE.
5. **Configurações**: gerenciar backup/restauração/formatação do SQLite
   e preferências visuais/acessibilidade com live preview em tempo real.

## Convenções de código e nomenclatura

### 1. Funções, Métodos e APIs
- **Métodos da API e Funções Públicas**: Inglês técnico em `snake_case` no Python (`create_product`, `toggle_product_status`, `list_quotes`, `get_sync_status`, `save_backup_to_path`, `shutdown_system`). Seguir a estrutura `verbo_substantivo` (`create_`, `update_`, `remove_`, `list_`, `get_`, `batch_`, `toggle_`).
- **Funções Utilitárias e Hooks no Frontend**: `camelCase` em inglês no TypeScript (`formatMoney`, `calculatePackaging`, `downloadBase64File`, `useActiveRound`, `useAutosave`, `useDataCacheSubscription`).
- **Aliases de Retrocompatibilidade**: Caso uma função pública seja renomeada, manter um alias no backend apontando para o novo nome para evitar quebras em pontos não migrados.
- **Retorno Serializável**: Toda função exposta em `js_api` retorna dict/lista serializável — nunca objetos Python customizados.

### 2. Banco de Dados e Domínio Comercial
- **Tabelas e Colunas**: Estritamente em **Português**, no padrão `snake_case` (`produtos`, `fornecedores`, `cotacoes`, `alocacoes`, `preco_embalagem`, `qtd_por_embalagem`, `pedido_minimo`, `id_rodada`).
- **NUNCA** traduzir termos centrais do negócio para o inglês nas tabelas ou queries SQL (ex: não usar `quotes`, `rounds`, `allocations` no schema SQLite).

### 3. Comentários e Docstrings
- **Idioma**: 100% em **Português (pt-BR)**.
- **Foco do Comentário**: Documentar o **"porquê"** (regras de negócio, motivos de restrições, decisões não óbvias, tolerâncias de pedido mínimo, sobras de embalagens), e não apenas repetir o "o que" o código faz.
- **Preservação**: Preservar comentários explicativos existentes ao realizar manutenções.

### 4. Arquivos e Componentes
- **Telas / Visões React**: `PascalCase` em Português com sufixo `View` em `frontend/src/components/` (`CotacoesView.tsx`, `AlocacaoView.tsx`, `ComparacaoView.tsx`, `ProdutosView.tsx`).
- **Módulos de Domínio Python**: `snake_case` em Português batendo com as entidades (`alocacoes.py`, `cotacoes.py`, `produtos.py`, `fornecedores.py`, `rodadas.py`).
- **Arquivos de Teste**:
  - Backend: `test_<modulo>.py` em `tests/`.
  - Frontend: `<modulo>.test.ts` em `frontend/src/test/`.
- **Frontend / React**: componentes funcionais, hooks. Estado vem de cada componente via `window.pywebview.api`, sem estado global desnecessário.
- **Sem `localStorage`/`sessionStorage`** no frontend — o estado que importa vive no SQLite via a API Python.
- **Design System & Interface**: toda alteração de UI, componente ou nova tela deve seguir estritamente as diretrizes de `DESIGN_SYSTEM.md` na raiz do projeto (herança da `themeColor`, cores semânticas estritas, alta densidade `size="xs"` e alinhamentos de tabela).

## Comandos
- **Desenvolvimento**:
  - `npm run dev` (dentro de `frontend/`) — Vite em modo desenvolvimento
  - `python app.py --dev` — executa o app conectado ao Vite
  - `python app.py` — abre no modo padrão configurado (Janela Nativa ou Navegador Padrão)
  - `python app.py --browser` — força abertura no Navegador Padrão do sistema
  - `python app.py --window` — força abertura em Janela Nativa (pywebview)
- **Qualidade Backend (Python)**:
  - `python -m ruff check backend tests` — validação estática de código com Ruff (Python 3.8+)
  - `python -m ruff format backend tests` — formatação automática de código
  - `python -m pytest tests/` — executa todos os testes unitários do backend
  - `python -m coverage run -m pytest tests/ && python -m coverage report -m` — relatório de cobertura de testes
- **Qualidade Frontend (React / TypeScript)**:
  - `npm run --prefix frontend lint` — validação de linter com Oxlint e ESLint
  - `npm run --prefix frontend test` — executa a suíte de testes com Vitest
  - `npm run --prefix frontend test:coverage` — relatório de cobertura do frontend
  - `npm run --prefix frontend build` — compilação de produção com validação estrita de tipos
- **Commits**:
  - Padrão Conventional Commits validado automaticamente por hook git nativo (`commitlint`).

## O que não fazer
- Não guardar preço unitário calculado no banco.
- Não restringir Alocação a uma linha por (produto, rodada).
- Não adicionar frameworks pesados de backend (FastAPI/Flask/Django) — o `server.py` nativo (`http.server`) e a bridge do `pywebview` já cobrem tudo com máxima leveza e compatibilidade com Win7.
- Não usar cores fixas arbitrárias por tela ou estilos hexadecimais inline — seguir sempre `DESIGN_SYSTEM.md`.
