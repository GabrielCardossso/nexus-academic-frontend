/**
 * Pedidos nos dados locais: criar, editar, cancelar, listar, confirmar, registrar pagamento e devolver.
 * As regras (o que pode e o que não pode) estão em `src/regras`; aqui elas são aplicadas e os dados salvos.
 */
import {
  aguardaDesconto,
  dataLocal,
  erroDesconto,
  erroVencimento,
  estaInadimplente,
  estaVencido,
  fimDoDia,
  mesmoConteudo,
  MSG_INADIMPLENTE_NAO_AUMENTA,
  MSG_SAIR_DO_A_PRAZO,
  MSG_VENCIDO_SO_PAGAR,
  pagoNaHora,
  podeCancelar,
  podeEditar,
  podePagar,
  resumoPedido,
  statusDoPedido,
  totalSemDesconto,
} from '../../regras';
import type {
  ClienteSalvo,
  ItemPedido,
  Pedido,
  PedidoCriarRequest,
  ProdutoCriarResponse,
  SolicitacaoDesconto,
} from '../../types';
import { arredondar } from '../../utils';
import {
  ajustarCredito,
  CHAVE_CLIENTES,
  CHAVE_PEDIDOS,
  CHAVE_PRODUTOS,
  ler,
  lerPedidos,
  proximoId,
  salvar,
  substituir,
} from './armazenamento';

interface ContextoPedido {
  clientes: ClienteSalvo[]; // limite de crédito já liberado do pedido original (na edição)
  produtos: ProdutoCriarResponse[]; // estoque já devolvido do pedido original (na edição)
  pedidos: Pedido[]; // para calcular a inadimplência
  original?: Pedido; // pedido sendo editado
}

/**
 * Valida o pedido e monta o registro (sem salvar). Usado no cadastro e na edição.
 * Na edição, os produtos e o cliente que já estavam no pedido continuam aceitos mesmo se
 * depois foram desativados.
 */
function montarPedido(req: PedidoCriarRequest, ctx: ContextoPedido, id: number): Pedido {
  const { clientes, produtos, pedidos, original } = ctx;

  const cliente = clientes.find((c) => c.id === req.clienteId);
  if (!cliente) throw new Error('Cliente não encontrado.');
  if (cliente.ativo === false && cliente.id !== original?.clienteId) {
    throw new Error('Cliente desativado: reative o cadastro para fazer pedidos.');
  }
  if (req.itens.length === 0) throw new Error('O pedido precisa de pelo menos um produto.');

  // Edição de pedido a prazo: o cliente e o vencimento não mudam (senão daria para passar a dívida
  // para outro cliente ou adiar o vencimento e escapar da inadimplência).
  const eraAPrazo = original?.pagamento === 'A_PRAZO';
  if (eraAPrazo && cliente.id !== original!.clienteId) {
    throw new Error('Pedido a prazo: o cliente não pode ser trocado.');
  }

  // Inadimplente (pedido a prazo vencido e não pago): pedido novo só PIX ou à vista, e sem desconto.
  // Um pedido que já era a prazo pode ser editado e continuar a prazo.
  const inadimplente = estaInadimplente(cliente.id, pedidos);
  if (inadimplente && req.pagamento === 'A_PRAZO' && !eraAPrazo) {
    throw new Error('Cliente inadimplente: não pode fazer pedido a prazo. Use PIX ou à vista.');
  }

  const aluguel = req.tipo === 'ALUGUEL';
  const meses = aluguel ? req.meses : undefined;
  if (aluguel && (!meses || !Number.isInteger(meses) || meses <= 0)) {
    throw new Error('Informe a duração do aluguel em meses.');
  }

  const itens: ItemPedido[] = req.itens.map(({ produtoId, quantidade }) => {
    const produto = produtos.find((p) => p.id === produtoId);
    if (!produto) throw new Error('Produto não encontrado.');
    const jaEstava = original?.itens.some((i) => i.produtoId === produtoId);
    if (produto.status !== 'DISPONIVEL' && !jaEstava) throw new Error(`"${produto.nome}" não está disponível.`);
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw new Error(`Quantidade inválida para "${produto.nome}".`);
    }
    if (quantidade > produto.estoque) {
      throw new Error(`Estoque insuficiente de "${produto.nome}" (disponível: ${produto.estoque}).`);
    }
    // Item que já estava no pedido (mesmo tipo) mantém o preço do momento do pedido, desde que a quantidade
    // não aumente. Quantidade maior = nova cotação do item pelo preço atual (item novo também usa o atual).
    const anterior = original?.tipo === req.tipo ? original.itens.find((i) => i.produtoId === produtoId) : undefined;
    const mantemPreco = anterior && quantidade <= anterior.quantidade;
    const precoUnitario = mantemPreco ? anterior.precoUnitario : aluguel ? produto.precoAluguel : produto.precoVenda;
    return { produtoId, nome: produto.nome, precoUnitario, quantidade };
  });

  // NORMAL solicita de 1% a 10%; VIP (que já tem 5%) solicita de 10% a 15% para substituir os 5%.
  // Inadimplente não solicita. Sempre depende de aprovação.
  // Na edição, a solicitação (e a decisão dela) só continua se o cliente, o percentual e o conteúdo
  // do pedido (tipo, pagamento, meses, produtos e quantidades) não mudaram. Senão, volta a ficar pendente.
  let solicitacao: SolicitacaoDesconto | undefined;
  if (req.descontoSolicitado != null) {
    const erro = erroDesconto(req.descontoSolicitado, cliente.categoria, inadimplente);
    if (erro) throw new Error(erro);
    const mantem =
      original?.solicitacao &&
      original.clienteId === cliente.id &&
      original.solicitacao.percentual === req.descontoSolicitado &&
      mesmoConteudo(original, req);
    solicitacao = mantem ? original!.solicitacao : { percentual: req.descontoSolicitado, status: 'PENDENTE' };
  }

  // A prazo: o vencimento é a data escolhida no pedido (obrigatória e futura). PIX/à vista: a emissão.
  const agora = new Date();
  const emissao = original ? new Date(original.emissao) : agora;
  let vencimento = emissao;
  if (req.pagamento === 'A_PRAZO' && eraAPrazo) {
    // Continua a prazo: o vencimento original fica (mesmo que vença hoje).
    if (req.dataVencimento && req.dataVencimento !== dataLocal(original!.vencimento)) {
      throw new Error('O vencimento de um pedido a prazo não pode ser alterado.');
    }
    vencimento = new Date(original!.vencimento);
  } else if (req.pagamento === 'A_PRAZO') {
    const erro = erroVencimento(req.dataVencimento);
    if (erro) throw new Error(erro);
    vencimento = fimDoDia(req.dataVencimento!)!;
  }
  // Aluguel: o fim do aluguel é calculado pela quantidade de meses, a partir do início.
  let fimAluguel: Date | undefined;
  if (meses) {
    fimAluguel = new Date(emissao);
    fimAluguel.setMonth(fimAluguel.getMonth() + meses);
  }

  const descricao = req.descricao?.trim();
  const pedido: Pedido = {
    id,
    tipo: req.tipo,
    clienteId: cliente.id,
    clienteNome: cliente.name,
    clienteCategoria: cliente.categoria,
    descricao: descricao || undefined,
    itens,
    meses,
    pagamento: req.pagamento,
    solicitacao,
    criadoEm: original?.criadoEm ?? agora.toISOString(),
    emissao: emissao.toISOString(),
    vencimento: vencimento.toISOString(),
    fimAluguel: fimAluguel?.toISOString(),
    concluidoEm: original?.concluidoEm,
    pagoEm: pagoNaHora({ pagamento: req.pagamento, solicitacao }) ? agora.toISOString() : undefined,
    clienteInadimplente: inadimplente,
  };

  // Pedido a prazo só sai do a prazo sendo pago na hora (PIX/à vista sem desconto pendente).
  // Senão, numa segunda edição ele já não seria "a prazo" e daria para trocar o cliente ou o vencimento.
  if (eraAPrazo && req.pagamento !== 'A_PRAZO' && !pedido.pagoEm) {
    throw new Error(MSG_SAIR_DO_A_PRAZO);
  }

  // A prazo (venda ou aluguel): valida e reserva o total no limite de crédito do cliente.
  if (req.pagamento === 'A_PRAZO') {
    const total = resumoPedido(pedido).total;
    if (total > cliente.limiteCredito) throw new Error('Total do pedido acima do limite de crédito do cliente.');
    // Inadimplente continuando a prazo: o pedido não pode crescer (seria uma compra nova a prazo).
    if (eraAPrazo && inadimplente && total > totalSemDesconto(original!)) throw new Error(MSG_INADIMPLENTE_NAO_AUMENTA);
    pedido.creditoUsado = total;
  }
  return pedido;
}

/** Baixa (sinal −1) ou devolve (sinal +1) o estoque dos itens do pedido. */
const baixarEstoque = (produtos: ProdutoCriarResponse[], itens: ItemPedido[], sinal = -1) =>
  produtos.map((p) => {
    const item = itens.find((i) => i.produtoId === p.id);
    return item ? { ...p, estoque: p.estoque + sinal * item.quantidade } : p;
  });

export async function listarPedidosLocal(): Promise<Pedido[]> {
  return lerPedidos().reverse(); // mais recentes primeiro
}

export async function criarPedidoLocal(req: PedidoCriarRequest): Promise<Pedido> {
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES);
  const produtos = ler<ProdutoCriarResponse>(CHAVE_PRODUTOS);
  const pedidos = ler<Pedido>(CHAVE_PEDIDOS);

  const novo = montarPedido(req, { clientes, produtos, pedidos }, proximoId(pedidos));

  salvar(CHAVE_PRODUTOS, baixarEstoque(produtos, novo.itens));
  salvar(CHAVE_PEDIDOS, [...pedidos, novo]);
  if (novo.creditoUsado) ajustarCredito(novo.clienteId, -novo.creditoUsado);
  return novo;
}

/**
 * Edita um pedido ainda não pago (pode mudar praticamente tudo).
 * Desfaz o pedido antigo (estoque e crédito reservado voltam) e aplica o novo com as mesmas
 * validações do cadastro. Se o novo for PIX/à vista sem desconto pendente, já fica pago.
 */
export async function editarPedidoLocal(id: number, req: PedidoCriarRequest): Promise<Pedido> {
  const pedidos = ler<Pedido>(CHAVE_PEDIDOS);
  const original = pedidos.find((p) => p.id === id);
  if (!original) throw new Error('Pedido não encontrado.');
  if (original.canceladoEm) throw new Error('Pedido cancelado: não pode ser editado.');
  if (original.devolvidoEm) throw new Error('Aluguel já devolvido: não pode ser editado.');
  if (estaVencido(original)) throw new Error(MSG_VENCIDO_SO_PAGAR);
  if (!podeEditar(original)) throw new Error('Pedido já pago: não pode mais ser editado.');

  // Desfaz o original: devolve o estoque e libera o crédito reservado (a prazo não pago).
  const produtos = baixarEstoque(ler<ProdutoCriarResponse>(CHAVE_PRODUTOS), original.itens, +1);
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES).map((c) =>
    c.id === original.clienteId && original.creditoUsado
      ? { ...c, limiteCredito: arredondar(c.limiteCredito + original.creditoUsado) }
      : c,
  );

  const atualizado = montarPedido(req, { clientes, produtos, pedidos, original }, id);

  salvar(CHAVE_PRODUTOS, baixarEstoque(produtos, atualizado.itens));
  salvar(
    CHAVE_CLIENTES,
    clientes.map((c) =>
      c.id === atualizado.clienteId && atualizado.creditoUsado
        ? { ...c, limiteCredito: arredondar(c.limiteCredito - atualizado.creditoUsado) }
        : c,
    ),
  );
  return substituir(CHAVE_PEDIDOS, pedidos, atualizado);
}

/**
 * Cancela o pedido (o "excluir" do pedido; não volta atrás). Só pedido não pago e não devolvido, e
 * nunca um pedido a prazo vencido. O estoque e o crédito reservado voltam; o pedido fica na lista
 * como "Cancelado".
 */
export async function cancelarPedidoLocal(id: number): Promise<Pedido> {
  const pedidos = lerPedidos(); // grava a situação do cliente no momento do cancelamento
  const pedido = pedidos.find((p) => p.id === id);
  if (!pedido) throw new Error('Pedido não encontrado.');
  if (pedido.canceladoEm) throw new Error('Este pedido já foi cancelado.');
  if (estaVencido(pedido)) throw new Error(MSG_VENCIDO_SO_PAGAR);
  if (!podeCancelar(pedido)) throw new Error('Só pedido ainda não pago (e não devolvido) pode ser cancelado.');

  salvar(CHAVE_PRODUTOS, baixarEstoque(ler<ProdutoCriarResponse>(CHAVE_PRODUTOS), pedido.itens, +1));
  if (pedido.creditoUsado) ajustarCredito(pedido.clienteId, pedido.creditoUsado);
  return substituir(CHAVE_PEDIDOS, pedidos, { ...pedido, canceladoEm: new Date().toISOString() });
}

/** Conclusão manual: nenhum pedido (nem VIP, nem com desconto aprovado) conclui sozinho. */
export async function confirmarPedidoLocal(pedidoId: number): Promise<Pedido> {
  const pedidos = ler<Pedido>(CHAVE_PEDIDOS);
  const pedido = pedidos.find((p) => p.id === pedidoId);

  if (!pedido) throw new Error('Pedido não encontrado.');
  if (statusDoPedido(pedido) !== 'PENDENTE') throw new Error('Este pedido já foi concluído, devolvido ou cancelado.');
  if (aguardaDesconto(pedido)) {
    throw new Error('Aguarde a decisão sobre o desconto solicitado antes de confirmar o pedido.');
  }

  return substituir(CHAVE_PEDIDOS, pedidos, { ...pedido, concluidoEm: new Date().toISOString() });
}

/** Registra o pagamento de um pedido a prazo: o crédito reservado volta ao limite do cliente. */
export async function pagarPedidoLocal(pedidoId: number): Promise<Pedido> {
  // A situação do cliente (inadimplente ou não) fica gravada no pedido no momento do pagamento.
  const pedidos = lerPedidos();
  const pedido = pedidos.find((p) => p.id === pedidoId);

  if (!pedido) throw new Error('Pedido não encontrado.');
  if (pedido.canceladoEm) throw new Error('Pedido cancelado: não há pagamento a registrar.');
  if (pedido.pagamento !== 'A_PRAZO') throw new Error('Só pedidos a prazo têm pagamento a registrar.');
  if (pedido.pagoEm) throw new Error('O pagamento deste pedido já foi registrado.');
  if (!podePagar(pedido)) {
    throw new Error('Aguarde a decisão sobre o desconto solicitado antes de registrar o pagamento.');
  }

  const atualizado: Pedido = { ...pedido, pagoEm: new Date().toISOString() };
  salvar(CHAVE_PEDIDOS, pedidos.map((p) => (p.id === pedidoId ? atualizado : p)));
  ajustarCredito(pedido.clienteId, pedido.creditoUsado ?? resumoPedido(pedido).total);
  return atualizado;
}

/** Devolução do aluguel concluído: o estoque volta (o crédito, por enquanto, não volta). */
export async function devolverPedidoLocal(pedidoId: number): Promise<Pedido> {
  const pedidos = ler<Pedido>(CHAVE_PEDIDOS);
  const pedido = pedidos.find((p) => p.id === pedidoId);

  if (!pedido || pedido.tipo !== 'ALUGUEL') throw new Error('Aluguel não encontrado.');
  if (pedido.devolvidoEm) throw new Error('Este aluguel já foi devolvido.');
  if (statusDoPedido(pedido) !== 'CONCLUIDO') throw new Error('Confirme o pedido antes de registrar a devolução.');

  salvar(CHAVE_PRODUTOS, baixarEstoque(ler<ProdutoCriarResponse>(CHAVE_PRODUTOS), pedido.itens, +1));
  return substituir(CHAVE_PEDIDOS, pedidos, { ...pedido, devolvidoEm: new Date().toISOString() });
}
