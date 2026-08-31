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
- **Necessidade**: quanto de um produto é preciso numa rodada — é a
  "lista de produtos em falta" do processo original que este app substitui.
- **Cotação**: um preço recebido de um fornecedor pra um produto numa
  rodada. Guarda `marca` (marca ofertada pelo fornecedor), `embalagem`
  (descrição da embalagem comercial), `qtd_por_embalagem`, `unidade` (unidade
  de medida do conteúdo — ex: UN, KG, L) e `preco_embalagem` separados.
  **O preço unitário é sempre calculado**
  (`preco_embalagem / qtd_por_embalagem`), nunca guardado nem digitado
  direto. Isso existe porque fornecedores diferentes vendem o mesmo
  produto em embalagens diferentes (ex: caixa de 6 vs. unidade) — comparar
  preço bruto sem normalizar dá resultado errado.
- **Auto-cadastro de Produto na Cotação**: qualquer produto digitado ou
  importado na tela de Cotações que não exista ainda no cadastro de
  Produtos é cadastrado automaticamente no banco e adicionado às necessidades
  da rodada ativa. Essa regra de auto-cadastro se aplica exclusivamente a
  Produtos — Fornecedores continuam exigindo correspondência prévia no cadastro.
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
  caixa) — a diferença entre o necessário e o comprado deve ficar visível
  na UI, não escondida.
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
   produto (dividir/mover), recalculando subtotal em tempo real.
3. **Resumo por fornecedor**: soma o total alocado e compara com
   `pedido_minimo` — sinalizar claramente quando não bateu.
4. **Conferência de necessidade**: soma todas as linhas de Alocação de um
   produto (mesmo divididas) e compara com a Necessidade da rodada —
   sinalizar "Falta cobrir" / "Excedente" / "Ok".
5. **Pedido**: gerar texto por fornecedor, agrupando as linhas de
   Alocação daquele fornecedor na rodada ativa, com botão de copiar.
6. **Configurações**: gerenciar backup/restauração/formatação do SQLite
   e preferências visuais/acessibilidade com live preview em tempo real.

## Convenções de código
- Python: type hints em funções públicas, `black` pra formatação.
- Tabelas/colunas do banco em português, snake_case, batendo com a
  linguagem do domínio acima (não traduzir pra inglês).
- React: componentes funcionais, hooks. Um componente por tela
  (Cadastros, Necessidades, Cotações, Comparação, Alocação, Resumo,
  Pedido, Estatísticas, Rodadas, Configurações). Estado vem de cada
  componente via `window.pywebview.api`, sem estado global desnecessário.
- Toda função exposta em `js_api` retorna dict/lista serializável — nunca
  objetos Python customizados.
- Sem `localStorage`/`sessionStorage` no frontend — o estado que importa
  vive no SQLite via a API Python.

## Comandos
- `npm run dev` (dentro de `frontend/`) — Vite em modo desenvolvimento
- `npm run build` (dentro de `frontend/`) — gera `frontend/dist`
- `python app.py` — abre no modo padrão configurado (Janela Nativa ou Navegador Padrão)
- `python app.py --browser` — força abertura no Navegador Padrão do sistema
- `python app.py --window` — força abertura em Janela Nativa (pywebview)
- `python -m unittest discover -s tests -p "test_*.py"` — executa todos os testes unitários de backend

## O que não fazer
- Não guardar preço unitário calculado no banco.
- Não restringir Alocação a uma linha por (produto, rodada).
- Não adicionar frameworks pesados de backend (FastAPI/Flask/Django) — o `server.py` nativo (`http.server`) e a bridge do `pywebview` já cobrem tudo com máxima leveza e compatibilidade com Win7.
