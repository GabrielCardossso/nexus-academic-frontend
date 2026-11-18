/** Textos que aparecem na tela para cada valor dos tipos (pagamento, tipo e status do pedido). */
import type { FormaPagamento, StatusPagamento, StatusPedido, TipoPedido } from '../types';

export const ROTULO_PAGAMENTO: Record<FormaPagamento, string> = {
  PIX: 'PIX',
  A_VISTA: 'À vista',
  A_PRAZO: 'A prazo',
};

export const ROTULO_TIPO: Record<TipoPedido, string> = {
  VENDA: 'Venda',
  ALUGUEL: 'Aluguel',
};

export const ROTULO_STATUS_PEDIDO: Record<StatusPedido, string> = {
  PENDENTE: 'Pendente',
  CONCLUIDO: 'Concluído',
  DEVOLVIDO: 'Devolvido',
  CANCELADO: 'Cancelado',
};

export const ROTULO_STATUS_PAGAMENTO: Record<StatusPagamento, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
};
