/**
 * Pedidos nos dados locais, iguais ao PedidoService do back (mesmas validações, mesma ordem e as
 * mesmas mensagens): criar, editar, listar, finalizar, devolver e excluir.
 * As travas que só o front tem ficam na tela (regras/pedido.ts e mensagens.ts), não aqui.
 */
import {
  descontoNaCriacao,
  descontoNaEdicao,
  hojeAAAAMMDD,
  MSG_INADIMPLENTE_SEM_PRAZO,
  subtotalDe,
  totalComDesconto,
  valorItem,
} from '../../regras';
import type {
  ClienteSalvo,
  ItemPedidoCriarRequest,
  Pedido,
  PedidoCriarRequest,
  PedidoEditarRequest,
} from '../../types';
import { arredondar } from '../../utils';
import {
  ativos,
  CHAVE_CLIENTES,
  CHAVE_COLABORADORES,
  CHAVE_PEDIDOS,
  CHAVE_PRODUTOS,
  falha,
  ler,
  proximoId,
  salvar,
  type ColaboradorSalvo,
  type ItemSalvo,
  type PedidoSalvo,
  type ProdutoSalvo,
} from './armazenamento';
import { cnpjValido } from './validacao';

// ---------------- Leitura ----------------

/** Junta o pedido com os dados atuais do cliente, do colaborador e dos produtos (como o JPA faz). */
function montar(p: PedidoSalvo, clientes: ClienteSalvo[], colaboradores: ColaboradorSalvo[], produtos: ProdutoSalvo[]): Pedido {
  const cliente = clientes.find((c) => c.id === p.clienteId);
  const colaborador = colaboradores.find((c) => c.id === p.colaboradorDescontoId);
  return {
    id: p.id,
    descricao: p.descricao,
    valorTotal: p.valorTotal,
    dataCriacao: p.dataCriacao,
    dataVencimento: p.dataVencimento,
    dataAtualizacaoDesconto: p.dataAtualizacaoDesconto,
    statusPedido: p.statusPedido,
    statusAprovacaoDesconto: p.statusAprovacaoDesconto,
    modalidadePagamento: p.modalidadePagamento,
    descontoSolicitado: p.descontoSolicitado,
    descontoAutorizado: p.descontoAutorizado,
    clienteId: p.clienteId,
    clienteNome: cliente?.name ?? '(cliente removido)',
    clienteEmail: cliente?.email,
    clienteClassificacao: cliente?.categoria,
    colaboradorDescontoId: colaborador?.id,
    colaboradorDescontoNome: colaborador?.nome ?? null,
    itens: p.itens.map((i) => ({ ...i, nomeProduto: produtos.find((x) => x.id === i.produtoId)?.nome ?? '(produto)' })),
  };
}

/** GET /pedidos (excluídos não aparecem), já com os dados que o back ainda não devolve (itens, descontos). */
export async function listarPedidosLocal(): Promise<Pedido[]> {
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES);
  const colaboradores = ler<ColaboradorSalvo>(CHAVE_COLABORADORES);
  const produtos = ler<ProdutoSalvo>(CHAVE_PRODUTOS);
  return ativos(ler<PedidoSalvo>(CHAVE_PEDIDOS))
    .map((p) => montar(p, clientes, colaboradores, produtos))
    .sort((a, b) => b.id - a.id);
}

// ---------------- Ajudantes (iguais aos métodos privados do PedidoService) ----------------

export const pedidoNaoExiste = (id: number): never =>
  falha(`A operação não foi executada pois o pedido de id: ${id} não existe`);

/** validarSeClienteEhInadiplente: pedido PENDENTE do cliente com vencimento antes de hoje. */
export function clienteEhInadimplente(clienteId: number, pedidos: PedidoSalvo[]): boolean {
  const hoje = hojeAAAAMMDD();
  return ativos(pedidos).some(
    (p) => p.clienteId === clienteId && p.statusPedido === 'PENDENTE' && !!p.dataVencimento && p.dataVencimento < hoje,
  );
}

/** @Future do back: a data, se vier, precisa ser depois de hoje. */
function validarFutura(data: string | undefined | null, campo: string) {
  if (data && data <= hojeAAAAMMDD()) falha(`${campo}: deve ser uma data futura`);
}

/** Validações do ItemPedidoCriarRequest (@NotNull, @Min(1), @Future). */
function validarItensRequest(itens: ItemPedidoCriarRequest[]) {
  for (const i of itens) {
    if (i.codigoIdProduto == null) falha('codigoIdProduto: não deve ser nulo');
    if (!Number.isInteger(i.quantidade) || i.quantidade < 1) falha('quantidade: deve ser maior que ou igual à 1');
    validarFutura(i.dataVencimentoAluguel, 'dataVencimentoAluguel');
  }
}

function validarDesconto(d: number | undefined) {
  if (d === undefined) return;
  if (!Number.isFinite(d) || d < 0 || d > 0.15) falha('descontoSolicitado: deve ser de 0 a 0.15');
}

/** criarItemPedidos: confere os produtos, baixa o estoque e calcula o valor de cada item. */
function criarItens(req: ItemPedidoCriarRequest[], produtos: ProdutoSalvo[]): ItemSalvo[] {
  const ids = new Set(req.map((i) => i.codigoIdProduto));
  const encontrados = ativos(produtos).filter((p) => ids.has(p.id));
  if (encontrados.length !== ids.size) falha('Nao foram encontrados produtos para os codigos informados no pedido');
  return req.map((i) => {
    const produto = encontrados.find((p) => p.id === i.codigoIdProduto)!;
    if (produto.estoque - i.quantidade < 0) {
      falha(
        `A operação não foi executada pois o estoque disponível: ${produto.estoque} não é suficiente. Quantidade requisitada para baixa: ${i.quantidade}`,
      );
    }
    produto.estoque -= i.quantidade;
    if (i.isAluguel && !i.dataVencimentoAluguel) falha('Para alugueis, e necessario informar a data de vencimento do aluguel');
    return {
      produtoId: produto.id,
      quantidade: i.quantidade,
      valorItem: valorItem(produto, i.quantidade, i.isAluguel),
      isAluguel: i.isAluguel,
      dataVencimentoAluguel: i.isAluguel ? i.dataVencimentoAluguel! : null,
      dataDevolucao: null,
    };
  });
}

/** devolverEstoqueItens: tudo volta ao estoque, menos aluguel já devolvido (já voltou antes). */
function devolverEstoque(itens: ItemSalvo[], produtos: ProdutoSalvo[]) {
  for (const i of itens) {
    if (i.isAluguel && i.dataDevolucao) continue;
    const produto = produtos.find((p) => p.id === i.produtoId);
    if (produto) produto.estoque += i.quantidade;
  }
}

/** validarPedidoNumEstadoValido. */
function validarEstado(p: PedidoSalvo) {
  if (p.statusPedido !== 'PENDENTE' && p.statusAprovacaoDesconto === 'PENDENTE') {
    falha('O pedido nao pode ser concluido pois contem uma solicitacao de desconto pendente de autorizacao');
  }
  if ((p.statusAprovacaoDesconto === 'APROVADO' || p.statusAprovacaoDesconto === 'REPROVADO') && p.colaboradorDescontoId == null) {
    falha('O pedido nao pode ser concluido pois o desconto aprovado/reprovado nao possui um colaborador especificado');
  }
}

const semLimite = (limite: number) => falha(`O limite de crédito de : ${limite.toFixed(2)} não cobre o valor total do pedido`);

/** Grava tudo de uma vez (o @Transactional do back: se algo falhar antes, nada muda). */
function gravar(pedidos: PedidoSalvo[], clientes: ClienteSalvo[], produtos: ProdutoSalvo[]) {
  salvar(CHAVE_PEDIDOS, pedidos);
  salvar(CHAVE_CLIENTES, clientes);
  salvar(CHAVE_PRODUTOS, produtos);
}

/** Cópias para alterar à vontade e só salvar no fim. */
function carregarTudo() {
  return {
    pedidos: ler<PedidoSalvo>(CHAVE_PEDIDOS).map((p) => ({ ...p, itens: p.itens.map((i) => ({ ...i })) })),
    clientes: ler<ClienteSalvo>(CHAVE_CLIENTES).map((c) => ({ ...c })),
    produtos: ler<ProdutoSalvo>(CHAVE_PRODUTOS).map((p) => ({ ...p })),
  };
}

// ---------------- Ações ----------------

/** POST /pedidos (PedidoService.criar). */
export async function criarPedidoLocal(req: PedidoCriarRequest): Promise<{ id: number; valorTotal: number }> {
  const cnpj = (req.CNPJcliente ?? '').replace(/[^0-9a-z]/gi, '').toUpperCase();
  if (!cnpjValido(cnpj)) falha('CNPJcliente: CNPJ inválido');
  validarDesconto(req.descontoSolicitado);
  if (!req.itensPedido?.length) falha('itensPedido: não deve estar vazio');
  if (!req.modalidadePagamento) falha('modalidadePagamento: não deve ser nulo');
  validarItensRequest(req.itensPedido);
  validarFutura(req.dataVencimento, 'dataVencimento');

  const { pedidos, clientes, produtos } = carregarTudo();
  const cliente =
    ativos(clientes).find((c) => c.cnpj === cnpj) ??
    falha(`A operação não foi executada pois o cliente informado CNPJ: ${cnpj} não existe`);
  const inadimplente = clienteEhInadimplente(cliente.id, pedidos);

  const itens = criarItens(req.itensPedido, produtos);
  const desconto = descontoNaCriacao(req.descontoSolicitado, cliente.categoria, inadimplente);
  const hoje = hojeAAAAMMDD();
  const pedido: PedidoSalvo = {
    id: proximoId(pedidos),
    descricao: req.descricao ?? null,
    valorTotal: totalComDesconto(subtotalDe(itens), desconto.descontoAutorizado),
    dataCriacao: hoje,
    dataVencimento: req.dataVencimento ?? null,
    dataAtualizacaoDesconto: desconto.atualizarData ? hoje : null,
    descontoSolicitado: desconto.descontoSolicitado,
    descontoAutorizado: desconto.descontoAutorizado,
    statusPedido: 'PENDENTE',
    statusAprovacaoDesconto: desconto.statusAprovacaoDesconto,
    modalidadePagamento: req.modalidadePagamento,
    clienteId: cliente.id,
    colaboradorDescontoId: null,
    itens,
  };

  if (pedido.modalidadePagamento === 'A_PRAZO') {
    if (inadimplente) falha(MSG_INADIMPLENTE_SEM_PRAZO);
    if (!pedido.dataVencimento) falha('A operação não foi executada pois pedidos A_PRAZO precisam de uma data de vencimento');
    if (pedido.valorTotal > cliente.limiteCredito) semLimite(cliente.limiteCredito);
    cliente.limiteCredito = arredondar(cliente.limiteCredito - pedido.valorTotal);
  }
  validarEstado(pedido);

  gravar([...pedidos, pedido], clientes, produtos);
  return { id: pedido.id, valorTotal: pedido.valorTotal };
}

/**
 * PUT /pedidos/{id}/editar (PedidoService.editarPedido). Só pedido PENDENTE. O que não vier no corpo
 * continua igual. Os itens, se vierem, substituem todos e são recotados pelo preço atual.
 */
export async function editarPedidoLocal(id: number, req: PedidoEditarRequest): Promise<Pedido> {
  validarDesconto(req.descontoSolicitado);
  if (req.itensPedido) validarItensRequest(req.itensPedido);
  validarFutura(req.dataVencimento, 'dataVencimento');

  const { pedidos, clientes, produtos } = carregarTudo();
  const pedido = ativos(pedidos).find((p) => p.id === id) ?? pedidoNaoExiste(id);
  if (pedido.statusPedido !== 'PENDENTE') falha('Esse pedido já foi pago e não pode mais ser editado');

  const cliente = clientes.find((c) => c.id === pedido.clienteId)!;
  const eraAPrazo = pedido.modalidadePagamento === 'A_PRAZO';
  const totalAnterior = pedido.valorTotal;
  const modalidade = req.modalidadePagamento ?? pedido.modalidadePagamento;

  if (req.dataVencimento) pedido.dataVencimento = req.dataVencimento;
  if (modalidade === 'A_PRAZO' && !pedido.dataVencimento) {
    falha('A operação não foi executada pois pedidos A_PRAZO precisam de uma data de vencimento');
  }
  if (modalidade === 'A_PRAZO' && !eraAPrazo && clienteEhInadimplente(cliente.id, pedidos)) falha(MSG_INADIMPLENTE_SEM_PRAZO);
  if (req.descricao != null) pedido.descricao = req.descricao;
  if (req.itensPedido) {
    if (req.itensPedido.length === 0) falha('Nao foram encontrados produtos para os codigos informados no pedido');
    devolverEstoque(pedido.itens, produtos);
    pedido.itens = criarItens(req.itensPedido, produtos);
  }
  pedido.modalidadePagamento = modalidade;

  const desconto = descontoNaEdicao(pedido, req.descontoSolicitado, cliente.categoria);
  pedido.descontoSolicitado = desconto.descontoSolicitado;
  pedido.descontoAutorizado = desconto.descontoAutorizado;
  pedido.statusAprovacaoDesconto = desconto.statusAprovacaoDesconto;
  if (desconto.limparColaborador) pedido.colaboradorDescontoId = null;
  if (desconto.atualizarData) pedido.dataAtualizacaoDesconto = hojeAAAAMMDD();

  pedido.valorTotal = totalComDesconto(subtotalDe(pedido.itens), pedido.descontoAutorizado);
  if (eraAPrazo) cliente.limiteCredito = arredondar(cliente.limiteCredito + totalAnterior);
  if (modalidade === 'A_PRAZO') {
    if (pedido.valorTotal > cliente.limiteCredito) semLimite(cliente.limiteCredito);
    cliente.limiteCredito = arredondar(cliente.limiteCredito - pedido.valorTotal);
  }
  validarEstado(pedido);

  gravar(pedidos, clientes, produtos);
  return montar(pedido, clientes, ler<ColaboradorSalvo>(CHAVE_COLABORADORES), produtos);
}

/** PUT /pedidos/{id}/finalizar: marca como PAGO. No a prazo, o total volta para o limite do cliente. */
export async function finalizarPedidoLocal(id: number): Promise<{ id: number; valorTotal: number }> {
  const { pedidos, clientes, produtos } = carregarTudo();
  const pedido = ativos(pedidos).find((p) => p.id === id) ?? pedidoNaoExiste(id);
  if (pedido.statusPedido !== 'PENDENTE') {
    falha(`O pedido nao pode ser finalizado pois nao esta pendente, status atual: ${pedido.statusPedido}`);
  }
  pedido.statusPedido = 'PAGO';
  validarEstado(pedido);
  if (pedido.modalidadePagamento === 'A_PRAZO') {
    const cliente = clientes.find((c) => c.id === pedido.clienteId)!;
    cliente.limiteCredito = arredondar(cliente.limiteCredito + pedido.valorTotal);
  }
  gravar(pedidos, clientes, produtos);
  return { id, valorTotal: pedido.valorTotal };
}

/**
 * PUT /pedidos/{id}/devolucao: devolve todos os itens de aluguel ainda não devolvidos (em qualquer
 * status do pedido). O estoque volta e cada item ganha a data de devolução. O crédito não volta.
 */
export async function devolverPedidoLocal(id: number): Promise<{ id: number; itensDevolvidos: number }> {
  const { pedidos, clientes, produtos } = carregarTudo();
  const pedido = ativos(pedidos).find((p) => p.id === id) ?? pedidoNaoExiste(id);
  const alugueis = pedido.itens.filter((i) => i.isAluguel);
  if (alugueis.length === 0) falha('O pedido nao possui itens de aluguel para devolver');
  const paraDevolver = alugueis.filter((i) => !i.dataDevolucao);
  if (paraDevolver.length === 0) falha('Os alugueis deste pedido ja foram devolvidos');
  devolverEstoque(paraDevolver, produtos);
  for (const i of paraDevolver) i.dataDevolucao = hojeAAAAMMDD();
  validarEstado(pedido);
  gravar(pedidos, clientes, produtos);
  return { id, itensDevolvidos: paraDevolver.length };
}

/**
 * DELETE /pedidos/{id}: só pedido PENDENTE. O estoque volta e, no a prazo, o total volta para o
 * limite. É soft delete: o pedido some da listagem.
 */
export async function excluirPedidoLocal(id: number): Promise<{ id: number }> {
  const { pedidos, clientes, produtos } = carregarTudo();
  const pedido = ativos(pedidos).find((p) => p.id === id) ?? pedidoNaoExiste(id);
  if (pedido.statusPedido !== 'PENDENTE') {
    falha(`O pedido de id: ${id} não pode ser excluído pois não está pendente, status atual: ${pedido.statusPedido}`);
  }
  devolverEstoque(pedido.itens, produtos);
  if (pedido.modalidadePagamento === 'A_PRAZO') {
    const cliente = clientes.find((c) => c.id === pedido.clienteId)!;
    cliente.limiteCredito = arredondar(cliente.limiteCredito + pedido.valorTotal);
  }
  pedido.excluido = true;
  gravar(pedidos, clientes, produtos);
  return { id };
}

/** Usado pela decisão de desconto (descontos.ts). */
export { carregarTudo, gravar, validarEstado };
