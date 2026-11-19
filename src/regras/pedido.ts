/**
 * Pedido: valores e o que cada pedido pode fazer, iguais ao back (entity/Pedido.java,
 * entity/ItemPedido.java e PedidoService.java).
 */
import type { ItemPedido, Pedido, ProdutoListarResponse } from '../types';
import { aguardaDesconto } from './descontos';
import { estaVencido } from './inadimplencia';

/** ItemPedido.calcularValorItem: preço (aluguel ou venda) × quantidade. O aluguel não multiplica por tempo. */
export function valorItem(produto: Pick<ProdutoListarResponse, 'precoVenda' | 'precoAluguel'>, quantidade: number, isAluguel: boolean) {
  return centavos(Number(isAluguel ? produto.precoAluguel : produto.precoVenda) * quantidade);
}

/** Soma dos itens, antes do desconto. */
export const subtotalDe = (itens: Pick<ItemPedido, 'valorItem'>[]) => centavos(itens.reduce((s, i) => s + i.valorItem, 0));

/** Pedido.calcularEsetarValorTotal: soma × (1 − desconto), 2 casas, arredondando metade para cima. */
export function totalComDesconto(subtotal: number, desconto: number): number {
  return centavos(subtotal * (1 - desconto));
}

/** Arredonda para centavos como o RoundingMode.HALF_UP do back (com folga para erro de ponto flutuante). */
function centavos(n: number): number {
  return Math.round((n + Math.sign(n) * 1e-9) * 100) / 100;
}

/** "Venda", "Aluguel" ou "Venda e aluguel" (o back marca aluguel por item). */
export function tipoDoPedido(itens: Pick<ItemPedido, 'isAluguel'>[] | undefined): string | null {
  if (!itens?.length) return null;
  const aluguel = itens.some((i) => i.isAluguel);
  const venda = itens.some((i) => !i.isAluguel);
  return aluguel && venda ? 'Venda e aluguel' : aluguel ? 'Aluguel' : 'Venda';
}

// ---------------- O que o pedido pode fazer ----------------

/** "Finalizar" (PUT /pedidos/{id}/finalizar) marca como PAGO: só pendente e sem desconto aguardando decisão. */
export const podeFinalizar = (p: Pick<Pedido, 'statusPedido' | 'statusAprovacaoDesconto'>) =>
  p.statusPedido === 'PENDENTE' && !aguardaDesconto(p);

/**
 * Editar e excluir: o back aceita qualquer pedido PENDENTE.
 * TRAVA DO FRONT (ainda não existe no back, pergunta enviada ao Lucas): pedido vencido não edita nem
 * exclui, senão o cliente sairia da inadimplência sem pagar (mudando o vencimento ou apagando o pedido).
 */
export const podeEditar = (p: Pick<Pedido, 'statusPedido' | 'dataVencimento'>) =>
  p.statusPedido === 'PENDENTE' && !estaVencido(p);

export const podeExcluir = podeEditar;

/**
 * Devolução (PUT /pedidos/{id}/devolucao): o back aceita qualquer pedido com item de aluguel ainda
 * não devolvido, em qualquer status. Sem os itens (back real), não dá para saber: o botão aparece e
 * o back responde se não houver o que devolver.
 */
export function podeDevolver(p: Pick<Pedido, 'itens'>): boolean {
  if (!p.itens) return true;
  return p.itens.some((i) => i.isAluguel && !i.dataDevolucao);
}
