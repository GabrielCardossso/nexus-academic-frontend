/**
 * Tipos de pedido e de solicitação de desconto.
 * ATENÇÃO: tudo de Pedido/Desconto (incluindo tipo, meses e devolução do aluguel) ainda NÃO existe
 * igual nos records do back — alinhar com o Lucas quando forem criados.
 */
import type { ClienteCategoria } from './cliente';

export type TipoPedido = 'VENDA' | 'ALUGUEL';
export type FormaPagamento = 'PIX' | 'A_VISTA' | 'A_PRAZO';
/** Andamento do pedido: nasce PENDENTE, vira CONCLUIDO só quando alguém confirma, DEVOLVIDO (aluguel) ou CANCELADO. */
export type StatusPedido = 'PENDENTE' | 'CONCLUIDO' | 'DEVOLVIDO' | 'CANCELADO';
/** Situação financeira, independente do status do pedido. */
export type StatusPagamento = 'PENDENTE' | 'PAGO';
export type StatusDesconto = 'PENDENTE' | 'APROVADA' | 'REJEITADA';

export interface ItemPedido {
  produtoId: number;
  nome: string;
  precoUnitario: number; // preço de venda, ou preço de aluguel por mês
  quantidade: number;
}

export interface SolicitacaoDesconto {
  percentual: number; // inteiro dentro da faixa da categoria (ver faixaDesconto em regras/descontos.ts)
  status: StatusDesconto;
  colaboradorId?: number; // quem aprovou/rejeitou
  colaboradorNome?: string;
}

/** Total, desconto e status NÃO ficam salvos: são calculados em regras/pedido.ts. */
export interface Pedido {
  id: number;
  tipo: TipoPedido;
  clienteId: number;
  clienteNome: string;
  clienteCategoria: ClienteCategoria;
  descricao?: string;
  itens: ItemPedido[];
  meses?: number; // só aluguel: duração em meses
  pagamento: FormaPagamento;
  solicitacao?: SolicitacaoDesconto; // desconto que o cliente pediu (depende de aprovação)
  criadoEm: string; // ISO
  emissao: string; // ISO
  /** ISO. A prazo: data escolhida no pedido para pagar. PIX/à vista: a própria emissão. */
  vencimento: string;
  fimAluguel?: string; // ISO, só aluguel: emissão + meses
  concluidoEm?: string; // ISO, preenchido quando o pedido é confirmado manualmente
  devolvidoEm?: string; // ISO, só aluguel
  canceladoEm?: string; // ISO. Cancelado não volta atrás; estoque e crédito reservado voltaram.
  pagoEm?: string; // ISO. PIX/à vista: na criação ou na decisão do desconto. A prazo: ao registrar o pagamento.
  creditoUsado?: number; // só a prazo: quanto foi descontado do limite (volta ao registrar o pagamento)
  /**
   * Cliente inadimplente (pedido a prazo vencido e não pago): fica sem desconto nenhum.
   * Pedido ainda não pago: calculado na listagem com a situação atual do cliente.
   * Pedido pago ou cancelado: fica a situação daquele momento.
   */
  clienteInadimplente?: boolean;
}

export interface PedidoCriarRequest {
  tipo: TipoPedido;
  clienteId: number;
  pagamento: FormaPagamento;
  itens: { produtoId: number; quantidade: number }[];
  meses?: number; // só aluguel
  descricao?: string;
  dataVencimento?: string; // AAAA-MM-DD, obrigatória e futura no pedido a prazo
  descontoSolicitado?: number; // % inteiro: NORMAL de 1 a 10, VIP de 10 a 15. Inadimplente não pode solicitar.
}
