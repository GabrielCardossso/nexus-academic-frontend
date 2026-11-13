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
export type StatusPedido = 'PENDENTE' | 'PAGO';
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
export interface Colaborador {
  id: number;
  nome: string;
}

// ---------------- Pedido / Desconto ----------------
export interface ItemPedido {
  produtoId: number;
  nome: string;
  precoUnitario: number; // preço de venda, ou preço de aluguel por mês
  quantidade: number;
}

export interface SolicitacaoDesconto {
  percentual: 5 | 10;
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
  itens: ItemPedido[];
  meses?: number; // só aluguel: duração em meses
  pagamento: FormaPagamento;
  solicitacao?: SolicitacaoDesconto; // só cliente NORMAL que pediu desconto
  criadoEm: string; // ISO
  emissao: string; // ISO
  vencimento: string; // ISO (aluguel: fim do aluguel)
  devolvidoEm?: string; // ISO, só aluguel
}

export interface PedidoCriarRequest {
  tipo: TipoPedido;
  clienteId: number;
  pagamento: FormaPagamento;
  itens: { produtoId: number; quantidade: number }[];
  meses?: number; // só aluguel
  descontoSolicitado?: 5 | 10;
}
