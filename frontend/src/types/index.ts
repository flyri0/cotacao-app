export interface Produto {
  id: number
  nome: string
  categoria?: string | null
  unidade_padrao: string
  ativo?: number
}

export interface Fornecedor {
  id: number
  nome: string
  contato?: string | null
  telefone?: string | null
  email?: string | null
  pedido_minimo: number
  ativo?: number
}

export interface Rodada {
  id: number
  descricao: string
  status: string
  data_criacao: string
}

export interface RodadaComMetricas extends Rodada {
  total_necessidades: number
  total_cotacoes: number
  total_alocacoes: number
  valor_total_alocado: number
}

export interface Necessidade {
  id: number
  id_rodada: number
  id_produto: number
  produto_nome: string
  produto_categoria?: string | null
  produto_unidade_padrao: string
  quantidade: number
}

export interface Cotacao {
  id: number
  id_rodada: number
  id_fornecedor: number
  fornecedor_nome: string
  id_produto: number
  produto_nome: string
  produto_unidade_padrao: string
  embalagem: string
  qtd_por_embalagem: number
  preco_embalagem: number
  preco_unitario: number
}

export interface Alocacao {
  id?: number
  id_rodada: number
  id_produto: number
  produto_nome: string
  produto_unidade_padrao: string
  id_fornecedor: number
  fornecedor_nome?: string
  quantidade: number
  observacao?: string | null
  embalagem?: string
  qtd_por_embalagem?: number
  preco_embalagem?: number
  preco_unitario?: number
}

export interface ConfiguracoesApp {
  app_nome?: string
  app_subtitulo?: string
  app_icone?: string
  app_theme_color?: string
  app_color_scheme?: 'light' | 'dark' | 'auto'
  [key: string]: string | undefined
}

export interface CotacaoHistoricoItem {
  id: number
  id_rodada: number
  rodada_descricao: string
  rodada_data: string
  id_fornecedor: number
  fornecedor_nome: string
  id_produto?: number
  produto_nome?: string
  produto_categoria?: string | null
  produto_unidade_padrao?: string
  embalagem: string
  qtd_por_embalagem: number
  preco_embalagem: number
  preco_unitario: number
}

export interface RankingFornecedorItem {
  id_fornecedor: number
  fornecedor_nome: string
  total_ofertas: number
  menor_preco_oferecido: number
  preco_medio_oferecido: number
}

export interface EstatisticasProduto {
  produto: Produto
  total_cotacoes: number
  total_rodadas: number
  menor_preco: number
  melhor_fornecedor: string | null
  maior_preco: number
  preco_medio: number
  variacao_percentual: number
  cotacoes_historico: CotacaoHistoricoItem[]
  ranking_fornecedores: RankingFornecedorItem[]
}

export interface EstatisticasFornecedor {
  fornecedor: Fornecedor
  total_cotacoes: number
  total_alocacoes: number
  volume_financeiro_alocado: number
  primeiros_lugares_count: number
  taxa_competitividade_pct: number
  cotacoes_historico: CotacaoHistoricoItem[]
  alocacoes_historico: Alocacao[]
}

export interface HistoricoGlobalCotacaoItem {
  id: number
  id_rodada: number
  rodada_descricao: string
  rodada_data: string
  id_fornecedor: number
  fornecedor_nome: string
  id_produto: number
  produto_nome: string
  produto_categoria: string | null
  produto_unidade_padrao: string
  embalagem: string
  qtd_por_embalagem: number
  preco_embalagem: number
  preco_unitario: number
  foi_alocado: boolean | number
}

export interface RespostaBackup {
  sucesso: boolean
  cancelado?: boolean
  caminho?: string
  nome_arquivo?: string
  tamanho_bytes?: number
  mensagem?: string
  conteudo_base64?: string
}

export interface StatusBanco {
  inicializado: boolean
  total_produtos: number
  total_fornecedores: number
  total_rodadas: number
}

export interface PywebviewApi {
  verificar_status_banco: () => Promise<StatusBanco>
  inicializar_banco_em_branco: () => Promise<{ sucesso: boolean; tipo: string }>
  popular_banco_demo_completo: () => Promise<{ sucesso: boolean; tipo: string }>

  obter_configuracoes: () => Promise<ConfiguracoesApp>
  salvar_configuracoes: (configs: Record<string, any>) => Promise<ConfiguracoesApp>
  formatar_banco_dados: (com_seed?: boolean) => Promise<{ sucesso: boolean; com_seed: boolean }>
  exportar_banco_dados: () => Promise<{ sucesso: boolean; nome_arquivo: string; conteudo_base64: string }>
  selecionar_local_e_salvar_backup: (nome_sugerido?: string) => Promise<RespostaBackup>
  salvar_backup_em_caminho: (caminho_completo: string) => Promise<RespostaBackup>
  importar_banco_dados: (conteudo_base64: string) => Promise<{ sucesso: boolean; mensagem: string }>

  listar_produtos: (apenas_ativos?: boolean) => Promise<Produto[]>
  alternar_status_produto: (id_produto: number, ativo?: boolean) => Promise<{ sucesso: boolean; produto: Produto }>
  criar_produto: (
    nome: string,
    categoria?: string | null,
    unidade_padrao?: string,
  ) => Promise<Produto>
  atualizar_produto: (
    id_produto: number,
    nome: string,
    categoria?: string | null,
    unidade_padrao?: string,
  ) => Promise<Produto>
  remover_produto: (id_produto: number) => Promise<{ sucesso: boolean; id: number; mensagem: string }>
  obter_estatisticas_produto: (id_produto: number) => Promise<EstatisticasProduto>
  obter_estatisticas_fornecedor: (id_fornecedor: number) => Promise<EstatisticasFornecedor>
  obter_historico_global_cotacoes: () => Promise<HistoricoGlobalCotacaoItem[]>

  listar_fornecedores: (apenas_ativos?: boolean) => Promise<Fornecedor[]>
  alternar_status_fornecedor: (id_fornecedor: number, ativo?: boolean) => Promise<{ sucesso: boolean; fornecedor: Fornecedor }>
  criar_fornecedor: (
    nome: string,
    contato?: string | null,
    telefone?: string | null,
    email?: string | null,
    pedido_minimo?: number,
  ) => Promise<Fornecedor>
  atualizar_fornecedor: (
    id_fornecedor: number,
    nome: string,
    contato?: string | null,
    telefone?: string | null,
    email?: string | null,
    pedido_minimo?: number,
  ) => Promise<Fornecedor>
  remover_fornecedor: (id_fornecedor: number) => Promise<{ sucesso: boolean; id: number; mensagem: string }>

  listar_rodadas: () => Promise<Rodada[]>
  listar_rodadas_com_metricas: () => Promise<RodadaComMetricas[]>
  criar_rodada: (
    descricao: string,
    status?: string,
    duplicar_de_id?: number | null,
  ) => Promise<Rodada>
  atualizar_rodada: (
    id_rodada: number,
    descricao: string,
    status?: string,
  ) => Promise<Rodada>
  remover_rodada: (id_rodada: number) => Promise<{ sucesso: boolean; id: number }>
  duplicar_necessidades_rodada: (
    id_origem: number,
    id_destino: number,
  ) => Promise<{ sucesso: boolean; itens_copiados: number }>

  listar_necessidades: (id_rodada: number) => Promise<Necessidade[]>
  criar_necessidade: (
    id_rodada: number,
    id_produto: number,
    quantidade?: number,
  ) => Promise<Necessidade>
  remover_necessidade: (id_necessidade: number) => Promise<{ sucesso: boolean; id: number }>

  listar_cotacoes: (id_rodada: number) => Promise<Cotacao[]>
  criar_cotacao: (
    id_rodada: number,
    id_fornecedor: number,
    id_produto: number,
    embalagem: string,
    qtd_por_embalagem: number,
    preco_embalagem: number,
  ) => Promise<Cotacao>
  remover_cotacao: (id_cotacao: number) => Promise<{ sucesso: boolean; id: number }>

  listar_alocacoes: (id_rodada: number) => Promise<Alocacao[]>
  salvar_alocacoes: (
    id_rodada: number,
    alocacoes: {
      id_produto: number
      id_fornecedor: number
      quantidade: number
      observacao?: string | null
    }[],
  ) => Promise<{ sucesso: boolean; total_alocacoes: number }>
  remover_alocacao: (id_alocacao: number) => Promise<{ sucesso: boolean; id: number }>

  // Integração Excel (XLSX)
  exportar_planilha_cotacao: (
    id_rodada: number,
    id_fornecedor?: number | null,
  ) => Promise<{
    sucesso: boolean
    cancelado?: boolean
    salvo_em_disco?: boolean
    caminho?: string
    nome_arquivo?: string
    conteudo_base64?: string
    total_itens?: number
    total?: number
    mensagem?: string
  }>
  importar_planilha_cotacao: (
    id_rodada: number,
    id_fornecedor: number,
    conteudo_base64: string,
  ) => Promise<{
    sucesso: boolean
    importados: number
    ignorados: number
    erros: string[]
    fornecedor_nome: string
  }>
  exportar_produtos_excel: () => Promise<{
    sucesso: boolean
    cancelado?: boolean
    salvo_em_disco?: boolean
    caminho?: string
    nome_arquivo?: string
    conteudo_base64?: string
    total?: number
    mensagem?: string
  }>
  importar_produtos_excel: (conteudo_base64: string) => Promise<{
    sucesso: boolean
    importados: number
    ignorados: number
    erros: string[]
  }>
  exportar_fornecedores_excel: () => Promise<{
    sucesso: boolean
    cancelado?: boolean
    salvo_em_disco?: boolean
    caminho?: string
    nome_arquivo?: string
    conteudo_base64?: string
    total?: number
    mensagem?: string
  }>
  importar_fornecedores_excel: (conteudo_base64: string) => Promise<{
    sucesso: boolean
    importados: number
    ignorados: number
    erros: string[]
  }>
}

declare global {
  interface Window {
    pywebview?: {
      api: PywebviewApi
    }
  }
}
