/**
 * Tipos espelhando os DTOs do back-end (Java records).
 * ATENÇÃO: cnpj, limiteCredito, status, id nas listagens e tudo de Pedido/Desconto
 * (incluindo tipo, meses e devolução do aluguel) ainda NÃO existem nos records do back —
 * alinhar com o Lucas quando forem criados.
 */

export type ClienteCategoria = 'NORMAL' | 'VIP';
export type TipoPedido = 'VENDA' | 'ALUGUEL';
export type ProdutoStatus = 'DISPONIVEL' | 'INDISPONIVEL' | 'DESATIVADO';
export type FormaPagamento = 'PIX' | 'A_VISTA' | 'A_PRAZO';
/** Andamento do pedido: nasce PENDENTE, vira CONCLUIDO só quando alguém confirma, DEVOLVIDO após a devolução (aluguel). */
export type StatusPedido = 'PENDENTE' | 'CONCLUIDO' | 'DEVOLVIDO';
/** Situação financeira, independente do status do pedido. */
export type StatusPagamento = 'PENDENTE' | 'PAGO';
export type StatusDesconto = 'PENDENTE' | 'APROVADA' | 'REJEITADA';

// ---------------- Cliente ----------------
export interface ClienteCriarRequest {
  name: string; // nome ou razão social
  telefone: string;
  cnpj: string;
  email: string;
  categoria: ClienteCategoria;
  limiteCredito: number;
}

export interface ClienteCriarResponse {
  id: number;
  name: string;
  email: string;
  categoria: ClienteCategoria;
  limiteCredito: number;
}

export interface ClienteListarResponse {
  id: number; // necessário para o cliente poder ser escolhido no pedido
  name: string;
  telefone: string;
  email: string;
  categoria: ClienteCategoria;
  limiteCredito: number;
  inadimplente?: boolean; // calculado: tem pedido a prazo vencido e não pago
}

// ---------------- Produto ----------------
export interface ProdutoCriarRequest {
  nome: string;
  descricao: string;
  estoque: number;
  precoVenda: number; // BigDecimal no Java
  precoAluguel: number; // valor por mês
  status: ProdutoStatus;
}

export interface ProdutoCriarResponse extends ProdutoCriarRequest {
  id: number;
}

export interface ProdutoListarResponse extends ProdutoCriarRequest {
  id: number; // necessário para o produto poder ser escolhido no pedido
}

// ---------------- Colaborador ----------------
export interface ColaboradorCriarRequest {
  nome: string;
  cpf: string; // só dígitos
  email: string;
}

export interface Colaborador extends ColaboradorCriarRequest {
  id: number;
}

// ---------------- Pedido / Desconto ----------------
export interface ItemPedido {
  produtoId: number;
  nome: string;
  precoUnitario: number; // preço de venda, ou preço de aluguel por mês
  quantidade: number;
}

export interface SolicitacaoDesconto {
  percentual: number; // inteiro dentro da faixa da categoria (ver faixaDesconto em regras.ts)
  status: StatusDesconto;
  colaboradorId?: number; // quem aprovou/rejeitou
  colaboradorNome?: string;
}

/** Total, desconto e status NÃO ficam salvos: são calculados em regras.ts. */
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
  pagoEm?: string; // ISO. PIX/à vista: na criação ou na decisão do desconto. A prazo: ao registrar o pagamento.
  creditoUsado?: number; // só a prazo: quanto foi descontado do limite (volta ao registrar o pagamento)
  /**
   * Cliente inadimplente (pedido a prazo vencido e não pago): perde os 5% automáticos de VIP.
   * Pedido ainda não pago: calculado na listagem com a situação atual do cliente.
   * Pedido pago: fica a situação do momento do pagamento.
   */
  clienteInadimplente?: boolean;
}

/** Cliente como fica guardado (como a tabela do banco): tem id e cnpj. */
export type ClienteSalvo = ClienteCriarRequest & { id: number };

export interface PedidoCriarRequest {
  tipo: TipoPedido;
  clienteId: number;
  pagamento: FormaPagamento;
  itens: { produtoId: number; quantidade: number }[];
  meses?: number; // só aluguel
  descricao?: string;
  dataVencimento?: string; // AAAA-MM-DD, obrigatória e futura no pedido a prazo
  descontoSolicitado?: number; // % inteiro: NORMAL de 1 a 10, VIP de 10 a 15 (VIP inadimplente: 1 a 15)
}
