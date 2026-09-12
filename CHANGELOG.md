# 0.1.0 (2026-09-12)


### Bug Fixes

* **alocacao:** corrigir loop infinito de autosave e perda de linha ao dividir item ([d3922d7](https://github.com/flyri0/cotacao-app/commit/d3922d75dc2ceaf5dc86d2fdc6801a143b975a65))
* **alocacao:** manter divisoes de compra contiguas e visiveis sob ordenacao e filtros ([290af86](https://github.com/flyri0/cotacao-app/commit/290af86c4c881e13a29731b72b4c7b805ec695b3))
* **alocacao:** permitir multiplas divisoes consecutivas e redimensionar input de quantidade ([d188bc4](https://github.com/flyri0/cotacao-app/commit/d188bc4f442dd9e8c57dc8b24113766cc0d6a081))
* **backend:** corrigir persistencia de app_config.json e auto-recuperacao do banco de dados ([0c59541](https://github.com/flyri0/cotacao-app/commit/0c595410fe00e1abd15f42d6b935127094fbc315))
* **comparacao:** ajustar layout flexbox e margem inferior da tabela comparativa ([a0290c9](https://github.com/flyri0/cotacao-app/commit/a0290c9dae58e283703c5887dafc95a0ff0cbc66))
* **comparacao:** exibir tag MENOR PRECO sempre no menor preco e garantir verde pre-selecionado por padrao ([e58e9c0](https://github.com/flyri0/cotacao-app/commit/e58e9c0980ad8481b3d93ba76172c9990e106c4e))
* compatibility for Python 3.8 type hints ([22e4bfe](https://github.com/flyri0/cotacao-app/commit/22e4bfe21013a6b2a52173c9ce88921b0d63d68d))
* **configuracoes:** restaura layout original de configuracoes e habilita scroll vertical nativo ([f24b82f](https://github.com/flyri0/cotacao-app/commit/f24b82fe816d2aa10f0de71eaf003a6db80e257f))
* **configuracoes:** restaurar scroll vertical em ConfiguracoesView e PedidoView com contêiner responsivo ([0644998](https://github.com/flyri0/cotacao-app/commit/06449986541a3f85049761a05480be88eebce85e))
* correcoes nas tabelas MRT em Rodadas, Alocacao e Resumo, e ajuste de scrollbar ([a8a2098](https://github.com/flyri0/cotacao-app/commit/a8a20985cb994cb22cffe2859750d4f36908e193))
* **excel:** padronizar planilhas, usar nome da rodada, remover import de cotacoes e export de fornecedores ([e411f58](https://github.com/flyri0/cotacao-app/commit/e411f582ef4aeda6bd5f08b14bbbb3d8d7afdc2c))
* **frontend:** ajusta menu colapsado usando ActionIcon e unidades relativas para alinhamento perfeito dos icones ([81023ea](https://github.com/flyri0/cotacao-app/commit/81023ea7b6706c02f221f73512f39ffec9f5a857))
* **frontend:** define tema padrao como 'auto' para evitar flashbang na inicializacao ([cbac5eb](https://github.com/flyri0/cotacao-app/commit/cbac5eb7d75447e65dcd778a1460cdfee90e795d))
* **frontend:** padroniza texto dos botoes para Exportar para Excel ([7a822c8](https://github.com/flyri0/cotacao-app/commit/7a822c82195db5277a4b4becf4949e9555866afd))
* **frontend:** remove !important do padding das tabelas para nao conflitar com o controle nativo de densidade do MRT ([2652cb0](https://github.com/flyri0/cotacao-app/commit/2652cb05122ec8cf26f76f50eaa19bd29ad06be1))
* **frontend:** restaura densidade global mas exclui estritamente tabelas MRT da sobreposicao ([e0dbcd1](https://github.com/flyri0/cotacao-app/commit/e0dbcd13bf0c7ec1c69fc834ac5a1ce262205bd4))
* **frontend:** reverte remocao da densidade global e ajusta css das tabelas para permitir 3 estados no MRT ([bf7e273](https://github.com/flyri0/cotacao-app/commit/bf7e273d0e829ddf04eef79adbba88cea09d0420))
* **packaging:** passar icone para webview.start e embutir favicon.ico no bundle ([2c08a5c](https://github.com/flyri0/cotacao-app/commit/2c08a5c7f7e5b549c012663ae87f651fa082c748))
* **perf:** reverte keep-alive de abas eliminando lag e implementa busca sob demanda em estatísticas ([688c1da](https://github.com/flyri0/cotacao-app/commit/688c1daadbf8dde484de434e0a28bf7914a9873d))
* remove campo e comportamento de observacao em alocacoes e pedidos de compra ([e0ad5b9](https://github.com/flyri0/cotacao-app/commit/e0ad5b92b2d800838692874560ac189a6e99521a))
* **tests:** translate API method calls to English in test files ([da32529](https://github.com/flyri0/cotacao-app/commit/da325295d29dee3b2335c4866d97e2dabcd6142b))
* **ui:** adicionar padding adequado na barra de pesquisa da comparacao conforme DESIGN_SYSTEM.md ([6013e15](https://github.com/flyri0/cotacao-app/commit/6013e1572f14a3ccf86c61a4218d082ebfd84550))
* **ui:** ajustar textos e inverter icones dos botoes de importar/exportar excel ([6d7dddb](https://github.com/flyri0/cotacao-app/commit/6d7dddbb277277f2819b3d83a8b5bb7daab82d9c))
* **ui:** eliminar coluna de vencedor na comparacao com porcentagem na celula do vencedor e calibrar minSize dos headers em todas as tabelas ([47bf58d](https://github.com/flyri0/cotacao-app/commit/47bf58d1d7eaeb824fbab4e0bc0815fcd3f5d636))
* **ui:** reformulacao da MRT na comparacao com alta densidade, botoes de filtro corrigidos e layout compacto ([82f16fc](https://github.com/flyri0/cotacao-app/commit/82f16fcd751d770c16a7f54bb0b3ba10b3bb9f5b))
* **ui:** remover notificacao de toast ao ajustar tamanho da fonte via atalhos ([a3839d5](https://github.com/flyri0/cotacao-app/commit/a3839d5fe1a4533bf4511f00b1518d3cd4c80950))
* **ui:** restaurar show de cores (verde, amarelo, vermelho) diretamente nas celulas da comparacao e compactar layout vertical/horizontal ([8ca1366](https://github.com/flyri0/cotacao-app/commit/8ca136630e1fda1af2b8f7777b27ca97ef5a4b13))
* **ui:** tornar BoasVindasView totalmente responsiva com rolagem vertical para telas pequenas ([d009fb2](https://github.com/flyri0/cotacao-app/commit/d009fb219bf7946705ed8316f04131cd689acae4))


### Features

* **alocacao:** remove botao manual de salvar e adiciona indicador visual de autosave ([2d487c1](https://github.com/flyri0/cotacao-app/commit/2d487c1805f34ecc4b9a3d05e19eb4e03046f6ed))
* **branding:** configurar favicon.ico no frontend e icone no pyinstaller ([25fa118](https://github.com/flyri0/cotacao-app/commit/25fa118e46186fbb9c97a4f7dd0d3a3063aacfab))
* **ci:** adicionar output de executavel nao-standalone compactado em zip no build ([4fee03f](https://github.com/flyri0/cotacao-app/commit/4fee03f2231b5226c875d37728c804165c3d3aeb))
* **comparacao-alocacao:** correlacionar decisao de compra nas celulas com nova paleta semantico-visual ([ee1f4e3](https://github.com/flyri0/cotacao-app/commit/ee1f4e3f750be9d308bc7155c9f7940b6d64093d))
* **comparacao-batch:** reestruturar comparacao com alta densidade e acoes em massa ([caeca9d](https://github.com/flyri0/cotacao-app/commit/caeca9d41a5700496d82bd3c9339da575f72aadc))
* **cotacoes:** adicionar edicao completa de cotacoes com fornecedor, produto, marca, embalagem e preco ([af3efde](https://github.com/flyri0/cotacao-app/commit/af3efdece3a1ea75614948399ff153de46f0cd60))
* **data-integrity:** soft-state active/inactive toggle, safe deletion with history validation for products and suppliers, and closed round protection ([4164e22](https://github.com/flyri0/cotacao-app/commit/4164e221fd45fba17ff4d6afbfd2c8f71ed5f33a))
* **db,alocacao:** remove quantidade de necessidades e preserva sobra de embalagem fechada ([164652d](https://github.com/flyri0/cotacao-app/commit/164652dca9ab38ad7f6e5a9c1924cd5d0d3e972c))
* **domain:** remove product unit, add brand and unit to quotes, and enable auto-creation of products ([6e42590](https://github.com/flyri0/cotacao-app/commit/6e42590b26590eb55fa5c442a7db840512b797be))
* **frontend:** allow live updates of subtotal while typing in AlocacaoView ([b2c0456](https://github.com/flyri0/cotacao-app/commit/b2c04569ec912d04e643cec6f8ec155fc86852b9))
* **frontend:** remove toggle de densidade do MRT e fixa tabelas no modo mais compacto ([242cf48](https://github.com/flyri0/cotacao-app/commit/242cf482c87e624845051d6dcb9855d67becc608))
* implementar sistema de backup automatico seguro com opcoes em configuracoes ([0a18a1a](https://github.com/flyri0/cotacao-app/commit/0a18a1a609b2fdb4de19051a2ca2deb8f2cb2399))
* impressao de pedidos compacta e densa no estilo DANFE A4 ([67ea882](https://github.com/flyri0/cotacao-app/commit/67ea882cdc77e8f91b5e17c86a1a43643bb1458e))
* interface compacta com preferencias de densidade e tamanho de fonte ([1806cac](https://github.com/flyri0/cotacao-app/commit/1806cacb6de061026cf8d0db3bcc18ace7b1b4b4))
* **necessidades:** permite auto-cadastro de produtos inexistentes e atualiza AGENTS.md ([b163dc6](https://github.com/flyri0/cotacao-app/commit/b163dc608d8827944a531f8a2c56e98eaed6ab8e))
* **pedidos:** abas colapsaveis por fornecedor com tabela em largura total ([0913e68](https://github.com/flyri0/cotacao-app/commit/0913e682896c755e9b7dcd2db52d296b65d8b1c5))
* **pedidos:** layout compacto em 2 colunas e remocao de caixa de texto redundante ([90d657b](https://github.com/flyri0/cotacao-app/commit/90d657b043096e94a075d27c6f95692175ca9e61))
* **quality:** integrar linters ruff oxlint commitlint e testes com alta cobertura ([075bf6a](https://github.com/flyri0/cotacao-app/commit/075bf6a9f09f93ab052e22bb3bdbf1f4114b7bd0))
* **rodadas:** professional lifecycle state machine (aberta, fechada, cancelada) with safe deletion and round cancellation ([4c88339](https://github.com/flyri0/cotacao-app/commit/4c883398e83f3606cd99320905a611d5000294d1))
* **seed:** expandir base de dados de demonstracao e atualizar tela de boas-vindas ([c9f1518](https://github.com/flyri0/cotacao-app/commit/c9f1518f2a4f149933c30e86dd5b03270552d309))
* **standards:** padronizar nomenclatura de funcoes apis e convencoes no AGENTS.md ([8940e98](https://github.com/flyri0/cotacao-app/commit/8940e9808afee5ac11fe62e99e3da35df3b71c5d))
* suporte a navegador padrao (dual-mode) com controle de instancia unica e compatibilidade com windows 7 32-bit ([9aa6c3a](https://github.com/flyri0/cotacao-app/commit/9aa6c3aa153893055ed54d9069a1930f5a5c1c46))
* **sync:** sincronizacao em tempo real cross-client desktop e web com apiCache ([c410664](https://github.com/flyri0/cotacao-app/commit/c4106644cf4996319adb5d2e5dab56e8fbdb6ad8))
* **ui:** adicionar cores de 2º e 3º lugar com borda exclusiva para item selecionado ([3014fab](https://github.com/flyri0/cotacao-app/commit/3014fab62c288b56a7f1ef9db3cc6042fb2d7540))
* **ui:** atalhos globais de acessibilidade Ctrl+ e Ctrl- para tamanho de fonte ([4894d9e](https://github.com/flyri0/cotacao-app/commit/4894d9e8f0634bb7ed7bdfb395d300414efb1980))
* **ui:** collapsible sidebar, modal scroll fix, clean autosave, standardize excel buttons, and supplier summary refactor ([eba688b](https://github.com/flyri0/cotacao-app/commit/eba688bac8898c7f385695538fbe195c69a33d48))
* **ui:** habilitar redimensionamento nativo de colunas (Column Resizing) em todas as tabelas MRT ([16ad036](https://github.com/flyri0/cotacao-app/commit/16ad03656819a9a829fa861bf7bf639ba1031918))
* **ui:** implementacao da Mantine React Table na tela de comparacao com coluna de categoria e destaque de marcas ([4e95900](https://github.com/flyri0/cotacao-app/commit/4e959003eaac94d516794728fb98cb2f3df26e9f))
* **ui:** implementacao do redesign visual completo em todas as telas conforme DESIGN_SYSTEM.md ([9b4c10a](https://github.com/flyri0/cotacao-app/commit/9b4c10a95c46401e569f2e2bb96965e1aa8df838))
* **ui:** reescrever tela de comparacao como super-planilha nativa com congelamento de paineis, show de cores, destaque de marcas e celulas ultra-compactas ([51c4652](https://github.com/flyri0/cotacao-app/commit/51c4652a919cd011384ae2d34dd72201200476bb))
* **ui:** remover KPI de criterio de destaque e adicionar filtros estilo excel de ordenacao alfabetica em produto e categoria ([a26336c](https://github.com/flyri0/cotacao-app/commit/a26336c7ab78811cb78230cb44757d0c551a4dc9))
* **ui:** reposicionar notificacoes para canto inferior e aplicar formato compacto ([76d0207](https://github.com/flyri0/cotacao-app/commit/76d020700adc9f8c7b29d199a7bc646029647f34))
* virtualizacao de tabelas MRT, layout viewport sem scrollbar e padronizacao visual ([75557d9](https://github.com/flyri0/cotacao-app/commit/75557d99dd6ae77d061b83cd9cf934438541a633))


### Performance Improvements

* desativar virtualizacao de linhas por padrao em todas as tabelas para rolagem nativa fluida a 60 FPS ([7185f29](https://github.com/flyri0/cotacao-app/commit/7185f29c0591e87c09358ff4bb26fac1b69a5714))
* **frontend:** memoizar joins pesados entre mounts e reduzir re-render em cascata ([b30e564](https://github.com/flyri0/cotacao-app/commit/b30e56449357a606f6a30dbe615ff113e5c5939d))
* **frontend:** mount persistente com LRU de abas + code-splitting por view ([31028f7](https://github.com/flyri0/cotacao-app/commit/31028f73fdd3f2f809bc1d0c96d66da6ec6280fb))
* **frontend:** virtualizar tabelas MRT e reduzir custo de troca de tela ([cc47f31](https://github.com/flyri0/cotacao-app/commit/cc47f31409a329aed08ce970337f17b29d926591))
* otimização de performance com cache de api em ram, pragma wal e keep-alive de abas ([ed00f0b](https://github.com/flyri0/cotacao-app/commit/ed00f0b670e43833100baaeaa91af307f9e4a6b9))


### Reverts

* Revert "refactor(frontend): reescrita modular completa e modernizacao visual" ([d185058](https://github.com/flyri0/cotacao-app/commit/d185058056369cea0d10318884c688673721fbcc))



