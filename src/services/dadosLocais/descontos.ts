/** Decisão de desconto nos dados locais, igual ao PedidoService.resolverSolicitacaoDesconto do back. */
import { descontoAutorizadoNaDecisao, hojeAAAAMMDD, subtotalDe, totalComDesconto } from '../../regras';
import type { DecisaoDesconto } from '../../types';
import { arredondar } from '../../utils';
import { ativos, CHAVE_COLABORADORES, falha, ler, type ColaboradorSalvo } from './armazenamento';
import { carregarTudo, gravar, pedidoNaoExiste, validarEstado } from './pedidos';

/** PUT /pedidos/{id}/desconto: { idColaborador, statusAprovacaoDesconto: APROVADO | REPROVADO }. */
export async function resolverDescontoLocal(
  pedidoId: number,
  idColaborador: number,
  decisao: DecisaoDesconto,
): Promise<{ id: number; valorTotal: number; nomeColaborador: string }> {
  const { pedidos, clientes, produtos } = carregarTudo();
  const pedido = ativos(pedidos).find((p) => p.id === pedidoId) ?? pedidoNaoExiste(pedidoId);
  const colaborador =
    ativos(ler<ColaboradorSalvo>(CHAVE_COLABORADORES)).find((c) => c.id === idColaborador) ??
    // Nesta rota o back usa o construtor de texto da ColaboradorNotFoundException (mensagem "na venda").
    falha(`A operação não foi executada pois colaborador informado: ${idColaborador} na venda não existe`);
  if (pedido.statusAprovacaoDesconto !== 'PENDENTE') {
    falha(
      `A solicitacao de desconto nao pode ser resolvida pois nao esta pendente, status atual: ${pedido.statusAprovacaoDesconto}`,
    );
  }
  if (decisao !== 'APROVADO' && decisao !== 'REPROVADO') {
    falha('A solicitacao de desconto so pode ser resolvida como APROVADO ou REPROVADO');
  }

  const cliente = clientes.find((c) => c.id === pedido.clienteId)!;
  pedido.colaboradorDescontoId = colaborador.id;
  pedido.statusAprovacaoDesconto = decisao;
  pedido.dataAtualizacaoDesconto = hojeAAAAMMDD();

  const totalAntes = pedido.valorTotal;
  pedido.descontoAutorizado = descontoAutorizadoNaDecisao(pedido, decisao === 'APROVADO', cliente.categoria);
  pedido.valorTotal = totalComDesconto(subtotalDe(pedido.itens), pedido.descontoAutorizado);
  // Pedido a prazo já tinha reservado o total antigo no limite: a diferença volta.
  if (pedido.modalidadePagamento === 'A_PRAZO') {
    cliente.limiteCredito = arredondar(cliente.limiteCredito + (totalAntes - pedido.valorTotal));
  }
  validarEstado(pedido);

  gravar(pedidos, clientes, produtos);
  return { id: pedido.id, valorTotal: pedido.valorTotal, nomeColaborador: colaborador.nome };
}
