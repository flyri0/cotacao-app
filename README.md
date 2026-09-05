# Mapa Comparativo de Cotações

Aplicativo desktop ágil e intuitivo para equipes de compras compararem cotações de fornecedores, normalizarem preços por unidade, dividirem alocações de compras e gerarem pedidos de compra em padrão formal DANFE com validação de pedido mínimo, conferência de necessidades e sincronização em tempo real.

---

## 🛠️ Stack Tecnológica

- **Backend**: Python 3.8+ (compatível com Windows 7 32-bit e Windows 10/11), SQLite local (`cotacao.db`).
- **Modos de Exibição (Dual-Mode)**:
  - **Janela Nativa**: via [pywebview](https://pywebview.flowrl.com/) (Edge Chromium WebView2).
  - **Navegador Padrão**: via micro-servidor HTTP local embutido (`server.py`, biblioteca padrão `http.server`), ideal para **Windows 7 (32 e 64 bits)** sem necessidade de instalar runtimes externos.
  - **Instância Única (Single Instance)**: se o sistema já estiver em execução na porta `54321`, uma nova execução apenas reabre a aba no navegador e encerra o processo duplicado imediatamente.
  - **Frontend Isomórfico**: Proxy transparente em `frontend/src/services/api.ts` que direciona chamadas para a bridge do `pywebview` ou para o micro-servidor HTTP local via REST POST `/api/*` de forma idêntica.
- **Sincronização & Cache Reativo**:
  - Cache em memória RAM (`apiCache.ts`) com invalidação seletiva por tags sem reconsultas desnecessárias.
  - Sincronização multi-janela instantânea (0ms) via `BroadcastChannel` e sincronização cross-client ultraleve por revisão (`get_sync_status`) com detecção de foco e visibilidade.
- **Frontend**: React 19, TypeScript, Vite, [Mantine UI v7](https://mantine.dev/) (Core, Hooks, Form, Notifications), [Mantine React Table](https://www.mantine-react-table.com/), Tabler Icons.
- **Qualidade, Linters & Testes**:
  - **Backend**: `Ruff` (linter e formatador de altíssima performance configurado para Python 3.8), `pytest` e `coverage` (**97%** de cobertura, **114 testes**).
  - **Frontend**: `Oxlint` e `ESLint` (Flat Config com regras de React Hooks e TS), `Vitest` com `jsdom` e `@testing-library/react` (**99.4%** de cobertura de linhas, **54 testes**).
  - **Commits**: `Commitlint` com validação de [Conventional Commits](https://www.conventionalcommits.org/) via hook git nativo (`commit-msg`).
- **Empacotamento**: [PyInstaller](https://pyinstaller.org/) gerando executável standalone único (`.exe`).

---

## 📋 Pré-requisitos

- **Python 3.8+** (Python 3.8.10 para builds de Windows 7 32-bit, Python 3.11+ para Windows 10/11).
- **Node.js 18+** e **npm**.
- **Windows 7 SP1 (32 ou 64-bit)**, **Windows 10** ou **Windows 11**.

---

## 🚀 Como Executar o Projeto

### 1. Instalação das Dependências

```powershell
# 1. Dependências do Backend Python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt   # pywebview, pyinstaller, openpyxl, ruff, pytest, coverage

# 2. Dependências do Frontend React
cd frontend
npm install
cd ..
```

### 2. Executando em Modo Desenvolvimento

```powershell
# Terminal 1 — Servidor de Desenvolvimento Vite (Frontend)
cd frontend
npm run dev

# Terminal 2 — Aplicativo Python (Backend com ponte para o Vite)
.\.venv\Scripts\python.exe app.py --dev
```

### 3. Opções de Inicialização (Linha de Comando)

Você pode escolher como abrir o sistema através dos argumentos CLI:

| Comando | Descrição |
| :--- | :--- |
| `python app.py` | Abre no modo padrão configurado no SQLite (Janela Nativa ou Navegador). |
| `python app.py --browser` | **Força abertura no Navegador Padrão** do sistema (Chrome, Edge, Firefox, Supermium). |
| `python app.py --window` | **Força abertura em Janela Nativa** (`pywebview`). |
| `python app.py --port 54321` | Especifica uma porta local personalizada para o micro-servidor HTTP. |

---

## 🔍 Qualidade de Código, Linters e Testes

O projeto adota uma política rigorosa de qualidade com **100% de cobertura nos módulos críticos** de negócio e cálculos, e mais de **90%** em todos os demais módulos.

### 🐍 Backend (Python)

| Ação | Comando |
| :--- | :--- |
| **Executar Testes Unitários** | `python -m pytest tests/` |
| **Testes com Relatório de Cobertura** | `python -m coverage run -m pytest tests/ && python -m coverage report -m` |
| **Gerar Relatório HTML de Cobertura** | `python -m coverage html` *(abre em `htmlcov/index.html`)* |
| **Verificar Linter (Ruff)** | `python -m ruff check backend tests` |
| **Formatar Código (Ruff Format)** | `python -m ruff format backend tests` |

### ⚛️ Frontend (React & TypeScript)

| Ação | Comando |
| :--- | :--- |
| **Executar Testes (Vitest)** | `npm run --prefix frontend test` |
| **Testes com Relatório de Cobertura** | `npm run --prefix frontend test:coverage` |
| **Modo Interativo (Watch)** | `npm run --prefix frontend test:watch` |
| **Verificar Linter (Oxlint / ESLint)** | `npm run --prefix frontend lint` |
| **Compilação de Produção (Vite)** | `npm run --prefix frontend build` |

### 📝 Padronização de Commits (Commitlint)

O repositório possui validação automática de mensagens de commit via `.git/hooks/commit-msg` utilizando o padrão **Conventional Commits**:

- `feat:` Nova funcionalidade para o usuário.
- `fix:` Correção de bug.
- `docs:` Alterações em documentação.
- `refactor:` Refatoração de código sem alteração funcional.
- `test:` Adição ou ajuste de testes automatizados.
- `chore:` Atualizações de tarefas de build, pacotes ou ferramentas auxiliares.

```bash
# Exemplo de commit válido:
git commit -m "feat(cotacoes): adicionar ordenacao inteligente por menor preco unitario"
```

---

## 🪟 Compatibilidade Especial com Windows 7 (32 e 64 bits)

O Mapa de Cotações foi projetado para rodar com máxima fluidez e baixo consumo de memória em computadores antigos com **Windows 7 (32 bits / x86)**:

1. **Modo Navegador Padrão (Sem WebView2 manual)**:
   - Em máquinas Windows 7 sem o runtime WebView2 instalado, o micro-servidor integrado (`http.server`) utiliza o navegador já instalado na máquina (ex: Chrome 109, Firefox 115 ESR, Supermium 32-bit) com suporte completo a React 19 e CSS moderno.
2. **Fallback Automático**:
   - Se o usuário tentar abrir em Janela Nativa mas o Windows 7 não possuir o WebView2, o aplicativo detecta a indisponibilidade e abre automaticamente no navegador padrão sem emitir erros ou travar.
3. **Desligamento Seguro & Heartbeat**:
   - No modo navegador, o sistema monitora a conectividade (*heartbeat*) e encerra o processo em segundo plano caso todas as abas sejam fechadas, liberando 100% da memória RAM. Também há um botão formal de **"Encerrar App"** no menu lateral.
4. **Instância Única (Single Instance)**:
   - Executar o atalho do programa enquanto ele já está aberto nunca duplica processos — o novo processo apenas traz a aba de volta à visualização no navegador.

---

## 📦 Como Compilar e Gerar o Executável Standalone (.exe)

O processo de empacotamento embute todos os arquivos estáticos de produção do frontend (`HTML`, `CSS`, `JavaScript`) diretamente dentro de um único binário `.exe` executável.

### 🚀 Build Automático (Recomendado)

```powershell
python build.py
# ou .\.venv\Scripts\python.exe build.py
```

Esse script realiza:
1. Validação de dependências (`Node.js`, `npm`, `PyInstaller`).
2. Build de produção do frontend (`npm run build` gerando `frontend/dist`).
3. Empacotamento do binário standalone com PyInstaller (`app.spec`).
4. Geração do executável final em 📁 **`dist/MapaCotacoes.exe`**.

---

## 💾 Persistência do Banco de Dados (`cotacao.db`)

- O banco SQLite **`cotacao.db`** é criado e mantido automaticamente **na mesma pasta do executável**.
- **Backup & Restauração**: o sistema conta com rotinas de backup automático periódico/ao iniciar e diálogos nativos para salvar ou carregar cópias de segurança em **Configurações (<kbd>Ctrl+0</kbd>) > Banco de Dados & Backups**.
- **Lock de Arquivo**: no Windows, o banco mantém um bloqueio seguro em nível de sistema de arquivos que previne deleções acidentais enquanto o aplicativo estiver aberto.

---

## ⌨️ Atalhos Globais de Teclado

O aplicativo suporta navegação instantânea via teclado em qualquer tela ou campo:

| Atalho | Tela / Ação |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>1</kbd> | Cadastro de **Produtos** (com edição e importação/exportação Excel) |
| <kbd>Ctrl</kbd> + <kbd>2</kbd> | Cadastro de **Fornecedores** (com pedido mínimo e importação/exportação Excel) |
| <kbd>Ctrl</kbd> + <kbd>3</kbd> | Gestão de **Necessidades** da Rodada Ativa |
| <kbd>Ctrl</kbd> + <kbd>4</kbd> | Lançamento de **Cotações** (com histórico de preço e planilha XLSX) |
| <kbd>Ctrl</kbd> + <kbd>5</kbd> | **Comparação (Matriz de Preços Estilo Excel)** |
| <kbd>Ctrl</kbd> + <kbd>6</kbd> | **Alocação de Compras** (Divisão de quantidades entre múltiplos fornecedores) |
| <kbd>Ctrl</kbd> + <kbd>7</kbd> | **Resumo por Fornecedor** & Atingimento de Pedido Mínimo |
| <kbd>Ctrl</kbd> + <kbd>8</kbd> | **Gerar Pedido de Compra** (Layout formal DANFE com impressão A4 e cópia) |
| <kbd>Ctrl</kbd> + <kbd>9</kbd> | **Estatísticas & Histórico** Multidimensional |
| <kbd>Ctrl</kbd> + <kbd>0</kbd> | **Configurações**, Identidade Visual, Densidade/Fonte e Banco SQLite |
| <kbd>Ctrl</kbd> + <kbd>+</kbd> ou <kbd>=</kbd> | **Aumentar Tamanho da Fonte** (Zoom/Acessibilidade) |
| <kbd>Ctrl</kbd> + <kbd>-</kbd> | **Diminuir Tamanho da Fonte** (Zoom/Acessibilidade) |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Salvar alterações imediatamente (na tela de compras/alocações) |
| <kbd>F1</kbd> ou <kbd>Ctrl+K</kbd> | Abrir Painel de Atalhos Rápidos e Ajuda |
