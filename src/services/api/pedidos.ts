/** Pedidos e descontos: back real (/pedidos) ou dados locais, conforme USAR_DADOS_LOCAIS. */
import { ENDPOINTS, USAR_DADOS_LOCAIS } from '../../config/api';
import { estaVencido } from '../../regras';
import type {
  ClienteCategoria,
  DecisaoDesconto,
  ModalidadePagamento,
  Pedido,
  PedidoCriarRequest,
  PedidoEditarRequest,
  StatusAprovacaoDesconto,
  StatusPedido,
} from '../../types';
import {
  criarPedidoLocal,
  devolverPedidoLocal,
  editarPedidoLocal,
  excluirPedidoLocal,
  finalizarPedidoLocal,
  listarPedidosDoClienteLocal,
  listarPedidosLocal,
  resolverDescontoLocal,
} from '../dadosLocais';
import { del, exigirId, get, getLista, post, put } from './http';

// DTOs do back (records Java) — nomes exatamente como lá
/** dtos/PedidoListarResponse.java */
interface PedidoBackListar {
  codigoPedido: number;
  valorTotal: number;
  nomeCliente: string;
  statusAprovacaoDesconto: StatusAprovacaoDesconto;
  statusPedido: StatusPedido;
}
/** dtos/PedidoDetailResponse.java (não traz itens nem os percentuais de desconto). */
interface PedidoBackDetalhe {
  id: number;
  descricao: string | null;
  valorTotal: number;
  dataCriacao: string;
  dataVencimento: string | null;
  statusPedido: StatusPedido;
  statusAprovacaoDesconto: StatusAprovacaoDesconto;
  modalidadePagamento: ModalidadePagamento;
  cliente: { id: number; name: string; email: string; classificacao: ClienteCategoria } | null;
  colaboradorDesconto: { name: string; cpf: string; email: string } | null;
}
/** dtos/SolicitacaoDescontoListarResponse.java */
interface SolicitacaoBack {
  id: number;
  cnpjCliente: string;
  valorTotal: number;
  descontoSolicitado: number;
}
/** dtos/PedidoCriarResponse.java */
interface PedidoBackCriarResponse {
  codigoPedido: number;
  valorTotal: number;
  nomeCliente: string;
}

function doDetalhe(d: PedidoBackDetalhe, solicitado?: number): Pedido {
  return {
    id: d.id,
    descricao: d.descricao,
    valorTotal: Number(d.valorTotal),
    dataCriacao: d.dataCriacao,
    dataVencimento: d.dataVencimento,
    statusPedido: d.statusPedido,
    statusAprovacaoDesconto: d.statusAprovacaoDesconto,
    modalidadePagamento: d.modalidadePagamento,
    descontoSolicitado: solicitado,
    clienteId: d.cliente?.id,
    clienteNome: d.cliente?.name ?? '',
    clienteEmail: d.cliente?.email,
    clienteClassificacao: d.cliente?.classificacao,
    colaboradorDescontoNome: d.colaboradorDesconto?.name ?? null,
  };
}

/** Pedido só com o resumo da listagem (usado quando o detalhe de um pedido falha). */
const doResumo = (p: PedidoBackListar): Pedido => ({
  id: p.codigoPedido,
  valorTotal: Number(p.valorTotal),
  clienteNome: p.nomeCliente,
  statusPedido: p.statusPedido,
  statusAprovacaoDesconto: p.statusAprovacaoDesconto,
  dataCriacao: '',
});

/**
 * GET /pedidos/{id} para cada pedido da lista (a listagem do back traz só o resumo). Se o detalhe de
 * um pedido falhar, ele aparece só com o resumo, em vez de a lista inteira dar erro.
 */
async function detalhar(lista: PedidoBackListar[]): Promise<Pedido[]> {
  const solicitacoes = await getLista<SolicitacaoBack>(ENDPOINTS.pedidosSolicitacoesDesconto);
  const detalhes = await Promise.allSettled(lista.map((p) => get<PedidoBackDetalhe>(ENDPOINTS.pedido(p.codigoPedido))));
  return detalhes.map((r, i) =>
    r.status === 'fulfilled'
      ? doDetalhe(r.value, solicitacoes.find((s) => s.id === r.value.id)?.descontoSolicitado)
      : doResumo(lista[i]),
  );
}

/** GET /pedidos (+ detalhe de cada um). Pedido excluído não aparece. */
export async function listarPedidos(): Promise<Pedido[]> {
  if (USAR_DADOS_LOCAIS) return listarPedidosLocal();
  const lista = await getLista<PedidoBackListar>(ENDPOINTS.pedidos);
  const pedidos = await detalhar(lista);
  return pedidos.sort((a, b) => b.id - a.id);
}

/** GET /pedidos/vencidosEmAberto: pedidos PENDENTES com vencimento antes de hoje (definem o inadimplente). */
export async function listarPedidosVencidos(): Promise<Pedido[]> {
  if (USAR_DADOS_LOCAIS) return (await listarPedidosLocal()).filter((p) => estaVencido(p));
  const lista = await getLista<PedidoBackListar>(ENDPOINTS.pedidosVencidos);
  if (lista.length === 0) return [];
  return detalhar(lista);
}

/** Como identificar o cliente em GET /pedidos/cliente (o back aceita um dos três). */
export type ClienteDoPedido = { idCliente: number } | { cnpjCliente: string } | { emailCliente: string };

/** GET /pedidos/cliente?idCliente= | cnpjCliente= | emailCliente=: pedidos de um cliente. */
export async function listarPedidosDoCliente(cliente: ClienteDoPedido): Promise<Pedido[]> {
  if (USAR_DADOS_LOCAIS) return listarPedidosDoClienteLocal(cliente);
  const [chave, valor] = Object.entries(cliente)[0];
  const lista = await getLista<PedidoBackListar>(`${ENDPOINTS.pedidosDoCliente}?${chave}=${encodeURIComponent(String(valor))}`);
  return lista.length === 0 ? [] : detalhar(lista);
}

/** Quantas solicitações de desconto aguardam decisão (GET /pedidos/solicitacoesDescontoEmAberto). */
export async function contarSolicitacoesPendentes(): Promise<number> {
  if (USAR_DADOS_LOCAIS) {
    return (await listarPedidosLocal()).filter((p) => p.statusPedido === 'PENDENTE' && p.statusAprovacaoDesconto === 'PENDENTE')
      .length;
  }
  return (await getLista<SolicitacaoBack>(ENDPOINTS.pedidosSolicitacoesDesconto)).length;
}

/** POST /pedidos */
export async function criarPedido(pedido: PedidoCriarRequest): Promise<{ id: number; valorTotal: number }> {
  if (USAR_DADOS_LOCAIS) return criarPedidoLocal(pedido);
  const r = await post<PedidoBackCriarResponse>(ENDPOINTS.pedidos, pedido);
  return { id: r.codigoPedido, valorTotal: Number(r.valorTotal) };
}

/** PUT /pedidos/{id}/editar (só o que vier no corpo muda). */
export async function editarPedido(id: number, pedido: PedidoEditarRequest): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await editarPedidoLocal(id, pedido);
    return;
  }
  await put(ENDPOINTS.pedidoEditar(id), pedido);
}

/** PUT /pedidos/{id}/finalizar: marca o pedido como PAGO. */
export async function finalizarPedido(id: number): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await finalizarPedidoLocal(id);
    return;
  }
  await put(ENDPOINTS.pedidoFinalizar(id));
}

/** PUT /pedidos/{id}/devolucao: devolve os itens de aluguel ainda não devolvidos. */
export async function devolverPedido(id: number): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await devolverPedidoLocal(id);
    return;
  }
  await put(ENDPOINTS.pedidoDevolucao(id));
}

/** DELETE /pedidos/{id}: só pendente; o pedido some da listagem. */
export async function excluirPedido(id: number): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await excluirPedidoLocal(id);
    return;
  }
  await del(ENDPOINTS.pedido(id));
}

/** PUT /pedidos/{id}/desconto: { idColaborador, statusAprovacaoDesconto }. */
export async function resolverDesconto(pedidoId: number, idColaborador: number, decisao: DecisaoDesconto): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await resolverDescontoLocal(pedidoId, idColaborador, decisao);
    return;
  }
  await put(ENDPOINTS.pedidoDesconto(pedidoId), {
    idColaborador: exigirId(idColaborador, 'Decidir desconto'),
    statusAprovacaoDesconto: decisao,
  });
}
