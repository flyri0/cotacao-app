# Mapa Comparativo de Cotações

Aplicativo desktop ágil e intuitivo para equipes de compras compararem cotações de fornecedores, normalizarem preços por unidade, dividirem alocações de compras e gerarem pedidos de compra com validação de pedido mínimo e conferência de necessidades.

---

## 🛠️ Stack Tecnológica

- **Backend**: Python 3.11+, [pywebview](https://pywebview.flowrl.com/) (janela nativa Windows Edge Chromium), SQLite local (`cotacao.db`).
- **Comunicação**: Bridge nativa JS ↔ Python (`window.pywebview.api`) — arquitetura leve sem servidor HTTP separado.
- **Frontend**: React 18, TypeScript, Vite, [Mantine UI v7](https://mantine.dev/) (Core, Hooks, Form, Notifications), [Mantine React Table](https://www.mantine-react-table.com/), Tabler Icons.
- **Empacotamento**: [PyInstaller](https://pyinstaller.org/) gerando executável standalone único (`.exe`).

---

## 📋 Pré-requisitos

- **Python 3.11+** com virtualenv configurado.
- **Node.js 18+** e **npm**.
- **Windows 10 / 11** (com WebView2 Runtime, nativo no Windows 10/11).

---

## 🚀 Ambiente de Desenvolvimento

### 1. Instalação das dependências

```powershell
# 1. Dependências do Backend Python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt   # ou pip install pywebview pyinstaller pythonnet bottle

# 2. Dependências do Frontend React
cd frontend
npm install
cd ..
```

### 2. Executando em Modo Desenvolvimento

Para ter suporte a *Hot Reload* no frontend:

```powershell
# Terminal 1 — Servidor de Desenvolvimento Vite
cd frontend
npm run dev

# Terminal 2 — Janela pywebview (aponta para http://localhost:5173 com dev tools ativados)
.\.venv\Scripts\python.exe app.py --dev
```

---

## 📦 Como Compilar e Gerar o Executável Standalone (.exe)

O processo de empacotamento embute todos os arquivos estáticos de produção do frontend (`HTML`, `CSS`, `JavaScript`) diretamente dentro de um único binário `.exe` executável.

### 🚀 Build Automático (Recomendado)

Criamos um script Python que automatiza 100% da compilação do frontend e empacotamento com PyInstaller:

```powershell
python build.py
# ou .\.venv\Scripts\python.exe build.py
```

Esse comando executa automaticamente:
1. Verificação de dependências (`Node.js`, `npm`, `PyInstaller`).
2. Build de produção do frontend (`npm run build` gerando `frontend/dist`).
3. Empacotamento do binário standalone com PyInstaller (`app.spec`).
4. Geração do executável final em 📁 **`dist/MapaCotacoes.exe`**.

---

### 🔧 Build Manual Passo a Passo

Caso prefira executar manualmente:

```powershell
# 1. Compilar os arquivos estáticos do frontend (gera a pasta frontend/dist)
cd frontend
npm run build
cd ..

# 2. Gerar o executável standalone com o PyInstaller
.\.venv\Scripts\pyinstaller.exe app.spec --noconfirm --clean
```

### 🌐 Integração Contínua (GitHub Actions — Windows 10/11 & Windows 7)

O repositório possui uma pipeline automatizada no GitHub Actions ([`.github/workflows/build.yml`](.github/workflows/build.yml)) que compila e disponibiliza automaticamente as duas versões do executável:

1. **`MapaCotacoes-Win10-Win11.exe`**:
   - Compilado com **Python 3.11** em `windows-latest`.
   - Otimizado com suporte nativo ao WebView2 moderno e novos recursos do Windows 10/11.
2. **`MapaCotacoes-Win7-Legacy.exe`**:
   - Compilado com **Python 3.8.10** (última versão oficial do runtime Python com retrocompatibilidade para Windows 7 SP1 e Windows 8).
   - Utiliza chamadas Win32 e bibliotecas linkadas para sistemas legados.

Ambos os artefatos são gerados automaticamente a cada `push`, `pull request` ou disparo manual na aba **Actions** do GitHub, e anexados automaticamente aos **Releases** do repositório quando criada uma tag `v*` (ex: `v1.0.0`).

---

## 🪟 Guia de Execução no Windows 7

Para executar o binário **`MapaCotacoes-Win7-Legacy.exe`** em computadores com **Windows 7**:

1. **Service Pack 1 e Atualizações**:
   - O Windows 7 deve ter o **Service Pack 1** e as atualizações de segurança `KB3063858` / `KB2533623` instaladas.
2. **WebView2 Runtime (Versão 109)**:
   - Baixe e instale o instalador autônomo do [Microsoft Edge WebView2 Runtime v109 (versão legada)](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) no Windows 7.
3. **Execução**:
   - Execute o arquivo `MapaCotacoes-Win7-Legacy.exe`. O banco SQLite local `cotacao.db` será gerado automaticamente na mesma pasta.

---

## 💾 Persistência do Banco de Dados (`cotacao.db`)

- Ao executar o arquivo `MapaCotacoes.exe`, o banco de dados SQLite **`cotacao.db`** será criado e mantido automaticamente **na mesma pasta do executável**.
- Isso garante que seus cadastros, cotações, alocações e histórico persistam normalmente entre fechamentos e reinicializações.
- Para realizar backup ou transferir seus dados, você pode copiar o arquivo `cotacao.db` ou utilizar a funcionalidade integrada em **Configurações (<kbd>Ctrl+0</kbd>) > Backup & Restauração**.

---

## ⌨️ Atalhos Globais de Teclado

| Atalho | Tela / Ação |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>1</kbd> | Cadastro de **Produtos** (com edição e importação/exportação Excel) |
| <kbd>Ctrl</kbd> + <kbd>2</kbd> | Cadastro de **Fornecedores** (com edição e importação/exportação Excel) |
| <kbd>Ctrl</kbd> + <kbd>3</kbd> | Gestão de **Necessidades** da Rodada |
| <kbd>Ctrl</kbd> + <kbd>4</kbd> | Lançamento de **Cotações** (com inteligência de tendência de preço e planilha XLSX) |
| <kbd>Ctrl</kbd> + <kbd>5</kbd> | **Comparação (Matriz de Preços Estilo Excel)** |
| <kbd>Ctrl</kbd> + <kbd>6</kbd> | **Alocação de Compras** (Divisão inteligente entre fornecedores) |
| <kbd>Ctrl</kbd> + <kbd>7</kbd> | **Resumo por Fornecedor** & Atingimento de Mínimo |
| <kbd>Ctrl</kbd> + <kbd>8</kbd> | **Gerar Pedido de Compra** (Ordem de compra formal com impressão A4 e cópia) |
| <kbd>Ctrl</kbd> + <kbd>9</kbd> | **Estatísticas & Histórico** Multidimensional |
| <kbd>Ctrl</kbd> + <kbd>0</kbd> | **Configurações**, Identidade Visual & Banco SQLite |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Salvar alocações na tela de compras |
| <kbd>F1</kbd> ou <kbd>Ctrl+K</kbd> | Abrir Guia de Atalhos Rápidos |

---

## 🧪 Testes Automatizados

Para rodar a suíte completa de testes unitários do backend:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v
```
