/** Decisão de desconto (aprovar ou rejeitar) nos dados locais. */
import { MSG_INADIMPLENTE_SEM_DESCONTO, pagoNaHora, resumoPedido } from '../../regras';
import type { Colaborador, Pedido } from '../../types';
import { arredondar } from '../../utils';
import { ajustarCredito, CHAVE_COLABORADORES, CHAVE_PEDIDOS, ler, lerPedidos, salvar } from './armazenamento';

export async function decidirDescontoLocal(
  pedidoId: number,
  aprovar: boolean,
  colaboradorId: number,
): Promise<Pedido> {
  const pedidos = lerPedidos();
  const pedido = pedidos.find((p) => p.id === pedidoId);
  const colaborador = ler<Colaborador>(CHAVE_COLABORADORES).find((c) => c.id === colaboradorId);

  if (!colaborador) throw new Error('Colaborador não encontrado.');
  if (colaborador.ativo === false) throw new Error('Colaborador desativado: não pode decidir descontos.');
  if (!pedido?.solicitacao || pedido.solicitacao.status !== 'PENDENTE' || pedido.canceladoEm) {
    throw new Error('Não há solicitação pendente para este pedido.');
  }
  // Cliente que ficou inadimplente depois de pedir: a solicitação só pode ser rejeitada.
  if (aprovar && pedido.clienteInadimplente) throw new Error(MSG_INADIMPLENTE_SEM_DESCONTO);

  const atualizado: Pedido = {
    ...pedido,
    solicitacao: {
      ...pedido.solicitacao,
      status: aprovar ? 'APROVADA' : 'REJEITADA',
      colaboradorId: colaborador.id,
      colaboradorNome: colaborador.nome,
    },
  };
  // PIX/à vista esperava só a decisão do desconto para ser pago.
  if (pagoNaHora(atualizado)) atualizado.pagoEm = new Date().toISOString();

  // Pedido a prazo já descontou o total sem desconto: devolve a diferença ao crédito.
  let devolver = 0;
  if (aprovar && pedido.pagamento === 'A_PRAZO') {
    const usado = pedido.creditoUsado ?? resumoPedido(pedido).total;
    devolver = Math.max(0, arredondar(usado - resumoPedido(atualizado).total));
    atualizado.creditoUsado = arredondar(usado - devolver);
  }

  salvar(CHAVE_PEDIDOS, pedidos.map((p) => (p.id === pedidoId ? atualizado : p)));
  if (devolver > 0) ajustarCredito(pedido.clienteId, devolver);
  return atualizado;
}
