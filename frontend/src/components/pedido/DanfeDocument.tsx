import { formatMoney } from '../../utils'
import type { Fornecedor, Rodada } from '../../types'

export interface ItemPedidoLinha {
  id_produto: number
  produto_nome: string
  marca?: string | null
  unidade: string
  quantidade_solicitada: number
  embalagem: string
  qtd_por_embalagem: number
  preco_embalagem: number
  preco_unitario: number
  embalagens_comprar: number
  quantidade_efetiva: number
  sobra: number
  subtotal: number
}

export interface PedidoPorFornecedor {
  fornecedor: Fornecedor
  itens: ItemPedidoLinha[]
  total_pedido: number
  status_minimo: 'ok' | 'abaixo' | 'sem_minimo'
  diferenca_minimo: number
  texto_formatado: string
}

interface DanfeDocumentProps {
  pedido: PedidoPorFornecedor
  rodadaAtual?: Rodada
  selectedRodadaId?: number | null
  totalEmbalagensFechadas: number
}

/**
 * Documento formal de impressão A4 no modelo DANFE para pedidos de compras.
 * Visível exclusivamente no momento da impressão (`.print-only`).
 */
export function DanfeDocument({
  pedido,
  rodadaAtual,
  selectedRodadaId,
  totalEmbalagensFechadas,
}: DanfeDocumentProps) {
  return (
    <div className="print-only danfe-documento">
      {/* QUADRO 1: CABEÇALHO DA ORDEM DE COMPRA */}
      <div className="danfe-quadro">
        <table className="danfe-header-table">
          <tbody>
            <tr>
              <td style={{ width: '65%' }}>
                <div
                  style={{
                    fontSize: '13pt',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: '#0f172a',
                  }}
                >
                  ORDEM DE COMPRA / PEDIDO DE FORNECIMENTO
                </div>
                <div style={{ fontSize: '8pt', color: '#334155', marginTop: '2pt' }}>
                  Ciclo de Cotação: <b>#{rodadaAtual?.id || selectedRodadaId} — {rodadaAtual?.descricao}</b>
                </div>
              </td>
              <td style={{ width: '35%', textAlign: 'right', borderLeft: '1px solid #0f172a' }}>
                <span className="danfe-label">DATA DE EMISSÃO</span>
                <div className="danfe-valor" style={{ fontSize: '8.5pt' }}>
                  {new Date().toLocaleDateString('pt-BR')} às{' '}
                  {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: '7pt', color: '#0f172a', fontWeight: 800, marginTop: '2pt' }}>
                  SITUAÇÃO: APROVADO PARA COMPRA
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* QUADRO 2: IDENTIFICAÇÃO DO FORNECEDOR / DESTINATÁRIO */}
      <div className="danfe-quadro">
        <div className="danfe-titulo-quadro">IDENTIFICAÇÃO DO FORNECEDOR (DESTINATÁRIO)</div>
        <table className="danfe-grid-table">
          <tbody>
            <tr>
              <td style={{ width: '45%' }}>
                <span className="danfe-label">Razão Social / Nome do Fornecedor</span>
                <span className="danfe-valor-destaque">{pedido.fornecedor.nome}</span>
              </td>
              <td style={{ width: '30%' }}>
                <span className="danfe-label">Contato / Vendedor</span>
                <span className="danfe-valor">{pedido.fornecedor.contato || 'Não informado'}</span>
              </td>
              <td style={{ width: '25%' }}>
                <span className="danfe-label">Telefone / WhatsApp</span>
                <span className="danfe-valor">{pedido.fornecedor.telefone || 'Não informado'}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span className="danfe-label">E-mail</span>
                <span className="danfe-valor">{pedido.fornecedor.email || 'Não informado'}</span>
              </td>
              <td>
                <span className="danfe-label">Pedido Mínimo Exigido</span>
                <span className="danfe-valor">
                  {pedido.fornecedor.pedido_minimo > 0
                    ? formatMoney(pedido.fornecedor.pedido_minimo)
                    : 'Não possui'}
                </span>
              </td>
              <td>
                <span className="danfe-label">Situação do Pedido Mínimo</span>
                <span className="danfe-valor">
                  {pedido.status_minimo === 'ok' && `✓ Atingido (+${formatMoney(pedido.diferenca_minimo)})`}
                  {pedido.status_minimo === 'abaixo' && `⚠️ Abaixo (Falta ${formatMoney(pedido.diferenca_minimo)})`}
                  {pedido.status_minimo === 'sem_minimo' && 'Sem exigência'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* QUADRO 3: TABELA DE ITENS DA ORDEM DE COMPRA */}
      <table className="danfe-itens-table">
        <thead>
          <tr>
            <th style={{ width: '24pt', textAlign: 'center' }}>Item</th>
            <th>Descrição do Produto / Marca Ofertada</th>
            <th style={{ width: '70pt' }}>Embalagem</th>
            <th style={{ width: '42pt', textAlign: 'right' }}>Qtd Ped.</th>
            <th style={{ width: '45pt', textAlign: 'center' }}>Comprar</th>
            <th style={{ width: '48pt', textAlign: 'right' }}>Qtd Total</th>
            <th style={{ width: '50pt', textAlign: 'right' }}>Preço Emb.</th>
            <th style={{ width: '50pt', textAlign: 'right' }}>Preço Un.</th>
            <th style={{ width: '58pt', textAlign: 'right' }}>Subtotal (R$)</th>
          </tr>
        </thead>
        <tbody>
          {pedido.itens.map((item, idx) => (
            <tr key={item.id_produto}>
              <td style={{ textAlign: 'center', fontWeight: 700 }}>
                {String(idx + 1).padStart(2, '0')}
              </td>
              <td>
                <b>{item.produto_nome}</b>
                {item.marca ? ` [${item.marca}]` : ''}
              </td>
              <td>{item.embalagem}</td>
              <td style={{ textAlign: 'right' }}>
                {item.quantidade_solicitada} {item.unidade}
              </td>
              <td style={{ textAlign: 'center', fontWeight: 700 }}>
                {item.embalagens_comprar} cx/emb
              </td>
              <td style={{ textAlign: 'right' }}>
                {item.quantidade_efetiva} {item.unidade}
                {item.sobra > 0 ? ` (+${item.sobra})` : ''}
              </td>
              <td style={{ textAlign: 'right' }}>
                {formatMoney(item.preco_embalagem)}
              </td>
              <td style={{ textAlign: 'right' }}>
                {formatMoney(item.preco_unitario)}
              </td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>
                {formatMoney(item.subtotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* QUADRO 4: TOTAIS DA ORDEM DE COMPRA */}
      <div className="danfe-quadro">
        <div className="danfe-titulo-quadro">TOTAIS DA ORDEM DE COMPRA</div>
        <table className="danfe-totais-table">
          <tbody>
            <tr>
              <td style={{ width: '25%' }}>
                <span className="danfe-label">Total de Itens</span>
                <span className="danfe-valor">{pedido.itens.length} produto(s)</span>
              </td>
              <td style={{ width: '25%' }}>
                <span className="danfe-label">Volume de Embalagens</span>
                <span className="danfe-valor">{totalEmbalagensFechadas} cx/emb</span>
              </td>
              <td style={{ width: '25%' }}>
                <span className="danfe-label">Status Pedido Mínimo</span>
                <span className="danfe-valor">
                  {pedido.status_minimo === 'ok' && '✓ Mínimo Atingido'}
                  {pedido.status_minimo === 'abaixo' && '⚠️ Abaixo do Mínimo'}
                  {pedido.status_minimo === 'sem_minimo' && 'Sem Pedido Mínimo'}
                </span>
              </td>
              <td style={{ width: '25%', backgroundColor: '#f8fafc', textAlign: 'right' }}>
                <span className="danfe-label">VALOR TOTAL DO PEDIDO</span>
                <span className="danfe-valor-destaque" style={{ fontSize: '10.5pt' }}>
                  {formatMoney(pedido.total_pedido)}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* QUADRO 5: OBSERVAÇÕES E DADOS COMPLEMENTARES */}
      <div className="danfe-quadro">
        <div className="danfe-titulo-quadro">DADOS COMPLEMENTARES / OBSERVAÇÕES</div>
        <div style={{ padding: '3pt 5pt', fontSize: '7pt', lineHeight: 1.3, color: '#334155' }}>
          <div>• Condições comerciais, faturamento e prazos de entrega acordados conforme cotação aprovada.</div>
          <div>• Favor confirmar o recebimento deste pedido e informar data prevista de faturamento.</div>
        </div>
      </div>

      {/* QUADRO 6: CANHOTO DE RECEBIMENTO E ASSINATURA */}
      <div className="danfe-quadro">
        <table className="danfe-assinatura-table">
          <tbody>
            <tr>
              <td style={{ width: '50%' }}>
                <span className="danfe-label">Confirmação de Recebimento / Fornecedor</span>
                <div style={{ marginTop: '10pt', fontSize: '7.5pt' }}>
                  Data de Aceite: _____ / _____ / __________
                </div>
              </td>
              <td style={{ width: '50%', textAlign: 'center' }}>
                <div
                  style={{
                    borderBottom: '1px solid #0f172a',
                    width: '80%',
                    margin: '0 auto',
                    height: '12pt',
                  }}
                ></div>
                <span className="danfe-label" style={{ marginTop: '2pt', textAlign: 'center' }}>
                  Responsável / Setor de Compras
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DanfeDocument
