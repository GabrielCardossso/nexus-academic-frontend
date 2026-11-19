/**
 * Pedido vencido e cliente inadimplente, iguais ao back:
 * PedidoRepository.existsByDataVencimentoBeforeAndStatusPedidoAndClienteId(hoje, PENDENTE, cliente).
 * Vale para qualquer modalidade: o que conta é ter vencimento antes de hoje e não estar pago.
 */
import type { Pedido } from '../types';
import { hojeAAAAMMDD } from './datas';

type PedidoComPrazo = Pick<Pedido, 'statusPedido' | 'dataVencimento'>;

/** Pedido ainda PENDENTE com vencimento antes de hoje. */
export function estaVencido(p: PedidoComPrazo, hoje: string = hojeAAAAMMDD()): boolean {
  return p.statusPedido === 'PENDENTE' && !!p.dataVencimento && p.dataVencimento < hoje;
}

/**
 * Inadimplente: tem pelo menos um pedido vencido. Não é campo do cadastro.
 * O cliente é reconhecido pelo id ou, quando o id não vem (back real), pelo e-mail (que é único).
 */
export function estaInadimplente(
  cliente: { id?: number; email?: string },
  pedidos: (PedidoComPrazo & Pick<Pedido, 'clienteId' | 'clienteEmail'>)[],
  hoje: string = hojeAAAAMMDD(),
): boolean {
  const temId = cliente.id != null && cliente.id > 0; // id negativo = provisório (back real)
  const mesmoCliente = (p: Pick<Pedido, 'clienteId' | 'clienteEmail'>) =>
    temId && p.clienteId != null
      ? p.clienteId === cliente.id
      : !!cliente.email && p.clienteEmail?.toLowerCase() === cliente.email.toLowerCase();
  return pedidos.some((p) => mesmoCliente(p) && estaVencido(p, hoje));
}
