export interface Produto {
  id: number
  nome: string
  categoria?: string | null
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
  quantidade?: number
}

export interface Cotacao {
  id: number
  id_rodada: number
  id_fornecedor: number
  fornecedor_nome: string
  id_produto: number
  produto_nome: string
  marca?: string | null
  embalagem: string
  qtd_por_embalagem: number
  unidade: string
  preco_embalagem: number
  preco_unitario: number
  produto_novo?: boolean
}

export interface Alocacao {
  id?: number
  id_rodada: number
  id_produto: number
  produto_nome: string
  id_fornecedor: number
  fornecedor_nome?: string
  quantidade: number
  marca?: string | null
  embalagem?: string
  qtd_por_embalagem?: number
  unidade?: string
  preco_embalagem?: number
  preco_unitario?: number
}

export interface ConfiguracoesApp {
  app_nome?: string
  app_subtitulo?: string
  app_icone?: string
  app_theme_color?: string
  app_color_scheme?: 'light' | 'dark' | 'auto'
  app_densidade?: 'compacto' | 'confortavel'
  app_tamanho_fonte?: string
  app_modo_execucao?: 'janela' | 'navegador'
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
  marca?: string | null
  embalagem: string
  qtd_por_embalagem: number
  unidade: string
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
  marca?: string | null
  embalagem: string
  qtd_por_embalagem: number
  unidade: string
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
  check_db_status: () => Promise<StatusBanco>
  initialize_empty_db: () => Promise<{ sucesso: boolean; tipo: string }>
  populate_demo_db: () => Promise<{ sucesso: boolean; tipo: string }>

  get_settings: () => Promise<ConfiguracoesApp>
  save_settings: (configs: Record<string, any>) => Promise<ConfiguracoesApp>
  format_database: (com_seed?: boolean) => Promise<{ sucesso: boolean; com_seed: boolean }>
  export_database: () => Promise<{ sucesso: boolean; nome_arquivo: string; conteudo_base64: string }>
  select_location_and_save_backup: (nome_sugerido?: string) => Promise<RespostaBackup>
  salvar_backup_em_caminho: (caminho_completo: string) => Promise<RespostaBackup>
  import_database: (conteudo_base64: string) => Promise<{ sucesso: boolean; mensagem: string }>

  list_products: (apenas_ativos?: boolean) => Promise<Produto[]>
  alternar_status_produto: (id_produto: number, ativo?: boolean) => Promise<{ sucesso: boolean; produto: Produto }>
  create_product: (
    nome: string,
    categoria?: string | null,
  ) => Promise<Produto>
  update_product: (
    id_produto: number,
    nome: string,
    categoria?: string | null,
  ) => Promise<Produto>
  remove_product: (id_produto: number) => Promise<{ sucesso: boolean; id: number; mensagem: string }>
  get_product_statistics: (id_produto: number) => Promise<EstatisticasProduto>
  get_supplier_statistics: (id_fornecedor: number) => Promise<EstatisticasFornecedor>
  get_global_quotes_history: () => Promise<HistoricoGlobalCotacaoItem[]>

  list_suppliers: (apenas_ativos?: boolean) => Promise<Fornecedor[]>
  alternar_status_fornecedor: (id_fornecedor: number, ativo?: boolean) => Promise<{ sucesso: boolean; fornecedor: Fornecedor }>
  create_supplier: (
    nome: string,
    contato?: string | null,
    telefone?: string | null,
    email?: string | null,
    pedido_minimo?: number,
  ) => Promise<Fornecedor>
  update_supplier: (
    id_fornecedor: number,
    nome: string,
    contato?: string | null,
    telefone?: string | null,
    email?: string | null,
    pedido_minimo?: number,
  ) => Promise<Fornecedor>
  remove_supplier: (id_fornecedor: number) => Promise<{ sucesso: boolean; id: number; mensagem: string }>

  list_rounds: () => Promise<Rodada[]>
  list_rounds_with_metrics: () => Promise<RodadaComMetricas[]>
  create_round: (
    descricao: string,
    status?: string,
    duplicar_de_id?: number | null,
  ) => Promise<Rodada>
  update_round: (
    id_rodada: number,
    descricao: string,
    status?: string,
  ) => Promise<Rodada>
  remove_round: (id_rodada: number) => Promise<{ sucesso: boolean; id: number; mensagem?: string }>
  duplicate_round_needs: (
    id_origem: number,
    id_destino: number,
  ) => Promise<{ sucesso: boolean; itens_copiados: number }>

  list_needs: (id_rodada: number) => Promise<Necessidade[]>
  create_need: (
    id_rodada: number,
    id_produto?: number | null,
    quantidade?: number,
    produto_nome?: string | null,
  ) => Promise<Necessidade & { produto_novo?: boolean }>
  remove_need: (id_necessidade: number) => Promise<{ sucesso: boolean; id: number }>

  list_quotes: (id_rodada: number) => Promise<Cotacao[]>
  create_quote: (
    id_rodada: number,
    id_fornecedor: number,
    id_produto?: number | null,
    produto_nome?: string | null,
    marca?: string | null,
    embalagem?: string,
    qtd_por_embalagem?: number,
    unidade?: string,
    preco_embalagem?: number,
  ) => Promise<Cotacao>
  remove_quote: (id_cotacao: number) => Promise<{ sucesso: boolean; id: number }>

  list_allocations: (id_rodada: number) => Promise<Alocacao[]>
  save_allocations: (
    id_rodada: number,
    alocacoes: {
      id_produto: number
      id_fornecedor: number
      quantidade: number
    }[],
  ) => Promise<{ sucesso: boolean; total_alocacoes: number }>
  remove_allocation: (id_alocacao: number) => Promise<{ sucesso: boolean; id: number }>

  // Integração Excel (XLSX)
  export_quote_spreadsheet: (
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
  import_quote_spreadsheet: (
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
  export_products_excel: () => Promise<{
    sucesso: boolean
    cancelado?: boolean
    salvo_em_disco?: boolean
    caminho?: string
    nome_arquivo?: string
    conteudo_base64?: string
    total?: number
    mensagem?: string
  }>
  import_products_excel: (conteudo_base64: string) => Promise<{
    sucesso: boolean
    importados: number
    ignorados: number
    erros: string[]
  }>
  export_suppliers_excel: () => Promise<{
    sucesso: boolean
    cancelado?: boolean
    salvo_em_disco?: boolean
    caminho?: string
    nome_arquivo?: string
    conteudo_base64?: string
    total?: number
    mensagem?: string
  }>
  import_suppliers_excel: (conteudo_base64: string) => Promise<{
    sucesso: boolean
    importados: number
    ignorados: number
    erros: string[]
  }>

  // Controle de Ciclo de Vida
  encerrar_sistema?: () => Promise<{
    sucesso: boolean
    mensagem?: string
  }>
}

declare global {
  interface Window {
    pywebview?: {
      api: PywebviewApi
    }
  }
}
