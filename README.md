# Mapa Comparativo de Cotações

Aplicativo desktop ágil e intuitivo para equipes de compras compararem cotações de fornecedores, normalizarem preços por unidade, dividirem alocações de compras e gerarem pedidos de compra em padrão formal DANFE com validação de pedido mínimo e conferência de necessidades.

---

## 🛠️ Stack Tecnológica

- **Backend**: Python 3.8+ (compatível com Windows 7 32-bit e Windows 10/11), SQLite local (`cotacao.db`).
- **Modos de Exibição (Dual-Mode)**:
  - **Janela Nativa**: via [pywebview](https://pywebview.flowrl.com/) (Edge Chromium WebView2).
  - **Navegador Padrão**: via micro-servidor HTTP local embutido (`server.py`, biblioteca padrão `http.server`), ideal para **Windows 7 (32 e 64 bits)** sem necessidade de instalar runtimes externos.
  - **Instância Única (Single Instance)**: se o sistema já estiver em execução na porta `54321`, uma nova execução apenas reabre a aba no navegador e encerra o processo duplicado imediatamente.
  - **Frontend Isomórfico**: Proxy transparente em `frontend/src/services/api.ts` que se conecta à janela nativa ou ao micro-servidor HTTP via REST POST `/api/*` sem alterar componentes React.
- **Frontend**: React 18, TypeScript, Vite, [Mantine UI v7](https://mantine.dev/) (Core, Hooks, Form, Notifications), [Mantine React Table](https://www.mantine-react-table.com/), Tabler Icons.
- **Empacotamento**: [PyInstaller](https://pyinstaller.org/) gerando executável standalone único (`.exe`).

---

## 📋 Pré-requisitos

- **Python 3.8+** (Python 3.8.10 para builds do Windows 7 32-bit, Python 3.11+ para Windows 10/11).
- **Node.js 18+** e **npm**.
- **Windows 7 SP1 (32 ou 64-bit)**, **Windows 10** ou **Windows 11**.

---

## 🚀 Como Executar o Projeto

### 1. Instalação das dependências

```powershell
# 1. Dependências do Backend Python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt   # pywebview, pyinstaller, pythonnet, openpyxl

# 2. Dependências do Frontend React
cd frontend
npm install
cd ..
```

### 2. Executando em Modo Desenvolvimento

```powershell
# Terminal 1 — Servidor de Desenvolvimento Vite
cd frontend
npm run dev

# Terminal 2 — Executar o Aplicativo Python
.\.venv\Scripts\python.exe app.py --dev
```

### 3. Opções de Inicialização (Linha de Comando)

Você pode escolher como abrir o sistema usando argumentos:

| Comando | Descrição |
| :--- | :--- |
| `python app.py` | Abre no modo padrão configurado (Janela Nativa ou Navegador Padrão). |
| `python app.py --browser` | **Força abertura no Navegador Padrão** (Chrome, Firefox, Supermium, Edge). |
| `python app.py --window` | **Força abertura em Janela Nativa** (`pywebview`). |
| `python app.py --port 54321` | Especifica uma porta local personalizada para o micro-servidor. |

---

## 🪟 Compatibilidade Especial com Windows 7 (32 e 64 bits)

O Mapa de Cotações foi projetado para rodar com máxima fluidez e baixo consumo de memória em computadores antigos com **Windows 7 (32 bits / x86)**:

1. **Modo Navegador Padrão (Sem WebView2 manual)**:
   - Em máquinas Windows 7 sem o runtime WebView2 instalado, o sistema utiliza o navegador já instalado na máquina (ex: Google Chrome 109, Firefox 115 ESR, Supermium 32-bit) com suporte completo a React e CSS moderno.
2. **Fallback Automático**:
   - Se o usuário tentar abrir em Janela Nativa mas o Windows 7 não tiver o WebView2, o aplicativo detecta a falha e abre automaticamente no navegador padrão sem emitir erros ou travar.
3. **Desligamento Seguro & Heartbeat**:
   - No modo navegador, o sistema monitora a inatividade (*heartbeat*) e encerra o processo em segundo plano caso todas as abas sejam fechadas, liberando 100% da memória RAM. Também há um botão formal de **"Encerrar App"** no menu lateral.
4. **Instância Única (Single Instance)**:
   - Clicar no ícone com o programa já aberto nunca gera processos duplicados — o novo processo apenas traz a aba de volta no navegador.

---

## 📦 Como Compilar e Gerar o Executável Standalone (.exe)

O processo de empacotamento embute todos os arquivos estáticos de produção do frontend (`HTML`, `CSS`, `JavaScript`) diretamente dentro de um único binário `.exe` executável.

### 🚀 Build Automático (Recomendado)

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

## 💾 Persistência do Banco de Dados (`cotacao.db`)

- Ao executar o aplicativo, o banco de dados SQLite **`cotacao.db`** será criado e mantido automaticamente **na mesma pasta do executável**.
- Para realizar backup ou transferir seus dados, você pode copiar o arquivo `cotacao.db` ou utilizar a funcionalidade integrada em **Configurações (<kbd>Ctrl+0</kbd>) > Backup & Restauração**.

---

## ⌨️ Atalhos Globais de Teclado

| Atalho | Tela / Ação |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>1</kbd> | Cadastro de **Produtos** (com edição e importação/exportação Excel) |
| <kbd>Ctrl</kbd> + <kbd>2</kbd> | Cadastro de **Fornecedores** (com pedido mínimo e importação/exportação Excel) |
| <kbd>Ctrl</kbd> + <kbd>3</kbd> | Gestão de **Necessidades** da Rodada |
| <kbd>Ctrl</kbd> + <kbd>4</kbd> | Lançamento de **Cotações** (com inteligência de tendência de preço e planilha XLSX) |
| <kbd>Ctrl</kbd> + <kbd>5</kbd> | **Comparação (Matriz de Preços Estilo Excel)** |
| <kbd>Ctrl</kbd> + <kbd>6</kbd> | **Alocação de Compras** (Divisão inteligente entre fornecedores) |
| <kbd>Ctrl</kbd> + <kbd>7</kbd> | **Resumo por Fornecedor** & Atingimento de Mínimo |
| <kbd>Ctrl</kbd> + <kbd>8</kbd> | **Gerar Pedido de Compra** (Layout formal DANFE com impressão A4 e cópia) |
| <kbd>Ctrl</kbd> + <kbd>9</kbd> | **Estatísticas & Histórico** Multidimensional |
| <kbd>Ctrl</kbd> + <kbd>0</kbd> | **Configurações**, Identidade Visual, Densidade/Fonte e Banco SQLite |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Salvar alocações na tela de compras |
| <kbd>F1</kbd> ou <kbd>Ctrl+K</kbd> | Abrir Guia de Atalhos Rápidos |

---

## 🧪 Testes Automatizados

Para rodar a suíte completa de testes unitários do backend (55 testes):

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v
```
