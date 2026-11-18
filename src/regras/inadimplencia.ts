/** Pedido vencido e cliente inadimplente. */
import type { FormaPagamento } from '../types';

/** O mínimo de um pedido para saber se ele venceu. */
export interface PedidoComPrazo {
  clienteId: number;
  pagamento: FormaPagamento;
  vencimento: string;
  pagoEm?: string;
  canceladoEm?: string;
}

/** Pedido a prazo que passou do vencimento sem pagamento (na data `em`, padrão: agora). Cancelado não vence. */
export function estaVencido(p: PedidoComPrazo, em: Date = new Date()): boolean {
  const pagoAte = p.pagoEm != null && new Date(p.pagoEm) <= em;
  return p.pagamento === 'A_PRAZO' && !p.canceladoEm && !pagoAte && new Date(p.vencimento) < em;
}

/** Inadimplente: tem pelo menos um pedido a prazo vencido e não pago. Não é campo do cadastro. */
export function estaInadimplente(clienteId: number, pedidos: PedidoComPrazo[], em: Date = new Date()): boolean {
  return pedidos.some((p) => p.clienteId === clienteId && estaVencido(p, em));
}
