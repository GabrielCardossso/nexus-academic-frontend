/**
 * Tipos de pedido. Espelham a entidade `Pedido`/`ItemPedido` e os enums do back
 * (repo LionT750/Nexus, branch main): os nomes dos campos e dos valores são os mesmos.
 */
import type { ClienteCategoria } from './cliente';

/** enums/ModalidadePagamento.java (não existe PIX no back). */
export type ModalidadePagamento = 'A_VISTA' | 'A_PRAZO';

/**
 * enums/StatusPedido.java. Um status só: o pedido nasce PENDENTE e vira PAGO em "Finalizar".
 * REJEITADO existe no enum do back, mas nenhuma regra usa (hoje nenhum pedido fica assim).
 */
export type StatusPedido = 'PENDENTE' | 'PAGO' | 'REJEITADO';

/** enums/StatusAprovacaoDesconto.java. */
export type StatusAprovacaoDesconto =
  | 'NAO_SOLICITADO'
  | 'PENDENTE'
  | 'APROVADO'
  | 'APROVADO_AUTOMATICAMENTE'
  | 'REPROVADO'
  | 'REPROVADO_INADIPLENCIA';

/** Item do pedido (entity/ItemPedido.java). Venda ou aluguel é escolhido por item. */
export interface ItemPedido {
  produtoId: number;
  nomeProduto: string;
  quantidade: number;
  /** Preço do produto × quantidade (venda ou aluguel), calculado na hora de criar/editar. */
  valorItem: number;
  isAluguel: boolean;
  /** AAAA-MM-DD. Só aluguel: até quando o cliente fica com o produto. */
  dataVencimentoAluguel?: string | null;
  /** AAAA-MM-DD. Só aluguel: quando foi devolvido. */
  dataDevolucao?: string | null;
}

/**
 * Pedido como o front usa. Os campos são os da entidade do back. Os marcados com "?" o back ainda
 * não devolve em GET /pedidos/{id} (por exemplo os itens e os descontos): os dados locais preenchem,
 * e com o back real eles ficam vazios até o Lucas incluir na resposta.
 */
export interface Pedido {
  id: number;
  descricao?: string | null;
  /** Total já com o desconto autorizado (o back grava, 2 casas). */
  valorTotal: number;
  dataCriacao: string; // AAAA-MM-DD
  /** AAAA-MM-DD. Obrigatória no a prazo. Pedido PENDENTE com vencimento antes de hoje = vencido. */
  dataVencimento?: string | null;
  dataAtualizacaoDesconto?: string | null;
  statusPedido: StatusPedido;
  statusAprovacaoDesconto: StatusAprovacaoDesconto;
  modalidadePagamento?: ModalidadePagamento | null;
  /** Fração de 0 a 0.15 (0.05 = 5%). */
  descontoSolicitado?: number;
  descontoAutorizado?: number;
  clienteId?: number;
  clienteNome: string;
  clienteEmail?: string;
  clienteClassificacao?: ClienteCategoria;
  colaboradorDescontoId?: number;
  colaboradorDescontoNome?: string | null;
  itens?: ItemPedido[];
}

/** Item no corpo do POST/PUT (dtos/ItemPedidoCriarRequest.java). */
export interface ItemPedidoCriarRequest {
  codigoIdProduto: number;
  quantidade: number;
  isAluguel: boolean;
  dataVencimentoAluguel?: string; // AAAA-MM-DD, obrigatória e futura no aluguel
}

/** POST /pedidos (dtos/PedidoCriarRequest.java). O cliente é identificado pelo CNPJ. */
export interface PedidoCriarRequest {
  descricao?: string;
  CNPJcliente: string;
  descontoSolicitado: number; // fração de 0 a 0.15
  itensPedido: ItemPedidoCriarRequest[];
  modalidadePagamento: ModalidadePagamento;
  dataVencimento?: string; // AAAA-MM-DD, obrigatória e futura no a prazo
}

/**
 * PUT /pedidos/{id}/editar (dtos/PedidoEditarRequest.java). Tudo opcional: o que não vier continua
 * como está. O cliente não muda. Os itens, se vierem, substituem todos (recotados pelo preço atual).
 */
export interface PedidoEditarRequest {
  descricao?: string;
  descontoSolicitado?: number;
  modalidadePagamento?: ModalidadePagamento;
  dataVencimento?: string;
  itensPedido?: ItemPedidoCriarRequest[];
}

/** Decisão de um colaborador sobre a solicitação (dtos/ResolverSolicitacaoDescontoRequest.java). */
export type DecisaoDesconto = 'APROVADO' | 'REPROVADO';
