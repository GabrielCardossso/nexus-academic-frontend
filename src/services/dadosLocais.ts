/**
 * ============================================================
 *  DADOS LOCAIS (temporário) — salva no localStorage do navegador
 * ============================================================
 * Faz o papel do back-end enquanto ele não está integrado.
 * Para usar o back-end real: USAR_DADOS_LOCAIS = false em config/api.ts.
 * Para limpar os dados: F12 > Application > Local Storage > apagar "nexus:*".
 */
import { CARREGAR_MOCKS } from '../config/api';
import {
  aguardaDesconto,
  dataLocal,
  erroDesconto,
  erroVencimento,
  estaInadimplente,
  estaVencido,
  fimDoDia,
  mesmoConteudo,
  MSG_INADIMPLENTE_SEM_DESCONTO,
  MSG_SAIR_DO_A_PRAZO,
  MSG_VENCIDO_SO_PAGAR,
  MSG_INADIMPLENTE_NAO_AUMENTA,
  totalSemDesconto,
  pagoNaHora,
  podeCancelar,
  podeEditar,
  podePagar,
  resumoPedido,
  statusDoPedido,
} from '../regras';
import { COLABORADORES_MOCK, gerarMocks } from './mocks';
import type {
  ClienteCriarRequest,
  ClienteCriarResponse,
  ClienteListarResponse,
  ClienteSalvo,
  Colaborador,
  ColaboradorCriarRequest,
  ItemPedido,
  Pedido,
  PedidoCriarRequest,
  ProdutoCriarRequest,
  ProdutoCriarResponse,
  ProdutoEditarRequest,
  ProdutoListarResponse,
  SolicitacaoDesconto,
} from '../types';

// "v8": dados de exemplo com as regras novas (inadimplente sem desconto, cancelados e desativados).
// Dados de versões antigas ficam de lado e os de exemplo são recriados.
const CHAVE_CLIENTES = 'nexus:v8:clientes';
const CHAVE_PRODUTOS = 'nexus:v8:produtos';
const CHAVE_PEDIDOS = 'nexus:v8:pedidos';
const CHAVE_COLABORADORES = 'nexus:v8:colaboradores';

/** Primeira execução (nada salvo ainda): grava os dados de exemplo de mocks.ts. */
function carregarMocksSeVazio() {
  try {
    // Colaboradores têm chave própria (vieram depois): os de exemplo entram mesmo se o resto já existir,
    // porque as decisões de desconto dos pedidos de exemplo apontam para eles.
    if (CARREGAR_MOCKS && localStorage.getItem(CHAVE_COLABORADORES) === null) {
      salvar(CHAVE_COLABORADORES, COLABORADORES_MOCK);
    }
    const vazio = [CHAVE_CLIENTES, CHAVE_PRODUTOS, CHAVE_PEDIDOS].every((c) => localStorage.getItem(c) === null);
    if (!CARREGAR_MOCKS || !vazio) return;
    const { clientes, produtos, pedidos } = gerarMocks();
    salvar(CHAVE_CLIENTES, clientes);
    salvar(CHAVE_PRODUTOS, produtos);
    salvar(CHAVE_PEDIDOS, pedidos);
  } catch {
    // localStorage indisponível: segue sem mocks
  }
}

function ler<T>(chave: string): T[] {
  carregarMocksSeVazio();
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T[]) : [];
  } catch {
    return [];
  }
}

function salvar<T>(chave: string, itens: T[]) {
  localStorage.setItem(chave, JSON.stringify(itens));
}

/**
 * Lê os pedidos com a situação do cliente preenchida: nos ainda não pagos, a situação atual
 * (inadimplente ou em dia); nos pagos, fica a situação gravada no momento do pagamento.
 */
function lerPedidos(): Pedido[] {
  const pedidos = ler<Pedido>(CHAVE_PEDIDOS);
  // Pago ou cancelado: fica a situação gravada naquele momento (o valor e os selos não mudam mais).
  return pedidos.map((p) =>
    p.pagoEm || p.canceladoEm ? p : { ...p, clienteInadimplente: estaInadimplente(p.clienteId, pedidos) },
  );
}

/** Simula o @GeneratedValue(IDENTITY): maior id atual + 1. */
function proximoId(itens: { id: number }[]): number {
  return itens.reduce((maior, item) => Math.max(maior, item.id), 0) + 1;
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

/** Soma ao limite de crédito do cliente (valor negativo desconta). */
function ajustarCredito(clienteId: number, valor: number) {
  salvar(
    CHAVE_CLIENTES,
    ler<ClienteSalvo>(CHAVE_CLIENTES).map((c) =>
      c.id === clienteId ? { ...c, limiteCredito: arredondar(c.limiteCredito + valor) } : c,
    ),
  );
}

/** Troca um registro (pelo id) e salva a lista. */
function substituir<T extends { id: number }>(chave: string, lista: T[], atualizado: T): T {
  salvar(chave, lista.map((x) => (x.id === atualizado.id ? atualizado : x)));
  return atualizado;
}

/**
 * Valida CNPJ (dígitos verificadores). Aceita também o CNPJ alfanumérico
 * (letras + números), em que cada caractere vale "código ASCII − 48".
 */
function cnpjValido(cnpj: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;
  const digito = (pesos: number[]) => {
    const soma = pesos.reduce((acc, peso, i) => acc + (cnpj.charCodeAt(i) - 48) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return (
    digito([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[12]) &&
    digito([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[13])
  );
}

/** Valida CPF (11 dígitos e dígitos verificadores; recusa todos iguais, como 111.111.111-11). */
function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (tamanho: number) => {
    const soma = [...cpf.slice(0, tamanho)].reduce((acc, d, i) => acc + Number(d) * (tamanho + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

// ---------------- Clientes ----------------
/** Valida e normaliza os dados do cliente (cadastro e edição). `idAtual` = cliente sendo editado. */
function validarCliente(dados: ClienteCriarRequest, clientes: ClienteSalvo[], idAtual?: number): ClienteCriarRequest {
  const name = dados.name.trim();
  const cnpj = dados.cnpj.replace(/[^0-9a-z]/gi, '').toUpperCase();
  const email = dados.email.trim();
  const limiteCredito = Number(dados.limiteCredito);

  if (name.length < 3) throw new Error('Informe o nome ou a razão social do cliente.');
  if (!cnpjValido(cnpj)) throw new Error('CNPJ inválido.');
  if (clientes.some((c) => c.id !== idAtual && c.cnpj === cnpj)) throw new Error('Já existe um cliente com esse CNPJ.');
  if (clientes.some((c) => c.id !== idAtual && c.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Já existe um cliente com esse e-mail.'); // coluna unique
  }
  if (!Number.isFinite(limiteCredito) || limiteCredito < 0) throw new Error('Limite de crédito inválido.');
  return { ...dados, name, cnpj, email, telefone: dados.telefone.trim(), limiteCredito };
}

export async function cadastrarClienteLocal(dados: ClienteCriarRequest): Promise<ClienteCriarResponse> {
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES);
  const novo: ClienteSalvo = { ...validarCliente(dados, clientes), id: proximoId(clientes) };
  salvar(CHAVE_CLIENTES, [...clientes, novo]);
  return {
    id: novo.id,
    name: novo.name,
    email: novo.email,
    categoria: novo.categoria,
    limiteCredito: novo.limiteCredito,
  };
}

export async function listarClientesLocal(): Promise<ClienteListarResponse[]> {
  const pedidos = ler<Pedido>(CHAVE_PEDIDOS);
  return ler<ClienteSalvo>(CHAVE_CLIENTES).map(
    ({ id, name, telefone, cnpj, email, categoria, limiteCredito, ativo }) => ({
      id,
      name,
      telefone,
      cnpj,
      email,
      categoria,
      limiteCredito,
      ativo: ativo !== false,
      inadimplente: estaInadimplente(id, pedidos),
    }),
  );
}

/**
 * Edita os dados do cliente. O limite informado é o limite **disponível** (o que a tela mostra).
 * Os pedidos já feitos guardam o nome e a categoria do momento do pedido.
 */
export async function editarClienteLocal(id: number, dados: ClienteCriarRequest): Promise<ClienteSalvo> {
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES);
  const atual = clientes.find((c) => c.id === id);
  if (!atual) throw new Error('Cliente não encontrado.');
  return substituir(CHAVE_CLIENTES, clientes, { ...atual, ...validarCliente(dados, clientes, id) });
}

/** Nada é excluído de verdade: o cliente desativado some da escolha de pedido novo, e pode ser reativado. */
export async function definirClienteAtivoLocal(id: number, ativo: boolean): Promise<ClienteSalvo> {
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES);
  const atual = clientes.find((c) => c.id === id);
  if (!atual) throw new Error('Cliente não encontrado.');
  return substituir(CHAVE_CLIENTES, clientes, { ...atual, ativo });
}

// ---------------- Produtos ----------------
export async function cadastrarProdutoLocal(dados: ProdutoCriarRequest): Promise<ProdutoCriarResponse> {
  const produtos = ler<ProdutoCriarResponse>(CHAVE_PRODUTOS);
  // O cadastro não recebe status (igual ao back): todo produto novo entra como disponível.
  const novo: ProdutoCriarResponse = { ...dados, id: proximoId(produtos), nome: dados.nome.trim(), status: 'DISPONIVEL' };
  salvar(CHAVE_PRODUTOS, [...produtos, novo]);
  return novo;
}

export async function listarProdutosLocal(): Promise<ProdutoListarResponse[]> {
  return ler<ProdutoListarResponse>(CHAVE_PRODUTOS);
}

/** Edita nome, descrição, preços e status. O estoque só muda por "Repor estoque" e pelos pedidos. */
export async function editarProdutoLocal(id: number, dados: ProdutoEditarRequest): Promise<ProdutoCriarResponse> {
  const produtos = ler<ProdutoCriarResponse>(CHAVE_PRODUTOS);
  const atual = produtos.find((p) => p.id === id);
  if (!atual) throw new Error('Produto não encontrado.');
  const nome = dados.nome.trim();
  if (!nome) throw new Error('Informe o nome do produto.');
  const precoVenda = Number(dados.precoVenda);
  const precoAluguel = Number(dados.precoAluguel);
  if (!Number.isFinite(precoVenda) || precoVenda < 0) throw new Error('Preço de venda inválido.');
  if (!Number.isFinite(precoAluguel) || precoAluguel < 0) throw new Error('Preço de aluguel inválido.');
  return substituir(CHAVE_PRODUTOS, produtos, {
    ...atual,
    nome,
    descricao: dados.descricao.trim(),
    precoVenda,
    precoAluguel,
    status: dados.status,
  });
}

/** Repor estoque: soma a quantidade ao estoque atual (não substitui e não muda o status). */
export async function reporEstoqueLocal(id: number, quantidade: number): Promise<ProdutoCriarResponse> {
  const produtos = ler<ProdutoCriarResponse>(CHAVE_PRODUTOS);
  const atual = produtos.find((p) => p.id === id);
  if (!atual) throw new Error('Produto não encontrado.');
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    throw new Error('Informe uma quantidade inteira maior que zero para repor.');
  }
  return substituir(CHAVE_PRODUTOS, produtos, { ...atual, estoque: atual.estoque + quantidade });
}

// ---------------- Colaboradores ----------------
export async function listarColaboradoresLocal(): Promise<Colaborador[]> {
  return ler<Colaborador>(CHAVE_COLABORADORES).map((c) => ({ ...c, ativo: c.ativo !== false }));
}

/** Valida e normaliza os dados do colaborador (cadastro e edição). `idAtual` = colaborador sendo editado. */
function validarColaborador(dados: ColaboradorCriarRequest, colaboradores: Colaborador[], idAtual?: number) {
  const nome = dados.nome.trim();
  const cpf = dados.cpf.replace(/\D/g, '');
  const email = dados.email.trim();
  const outros = colaboradores.filter((c) => c.id !== idAtual);

  if (nome.length < 3) throw new Error('Informe o nome do colaborador.');
  if (!cpfValido(cpf)) throw new Error('CPF inválido.');
  if (outros.some((c) => c.cpf === cpf)) throw new Error('Já existe um colaborador com esse CPF.');
  if (outros.some((c) => c.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Já existe um colaborador com esse e-mail.');
  }
  return { nome, cpf, email };
}

export async function cadastrarColaboradorLocal(dados: ColaboradorCriarRequest): Promise<Colaborador> {
  const colaboradores = ler<Colaborador>(CHAVE_COLABORADORES);
  const novo: Colaborador = { id: proximoId(colaboradores), ...validarColaborador(dados, colaboradores) };
  salvar(CHAVE_COLABORADORES, [...colaboradores, novo]);
  return novo;
}

/** As decisões de desconto já tomadas guardam o nome do colaborador daquele momento. */
export async function editarColaboradorLocal(id: number, dados: ColaboradorCriarRequest): Promise<Colaborador> {
  const colaboradores = ler<Colaborador>(CHAVE_COLABORADORES);
  const atual = colaboradores.find((c) => c.id === id);
  if (!atual) throw new Error('Colaborador não encontrado.');
  return substituir(CHAVE_COLABORADORES, colaboradores, { ...atual, ...validarColaborador(dados, colaboradores, id) });
}

/** Colaborador desativado não decide descontos; as decisões antigas continuam no histórico. */
export async function definirColaboradorAtivoLocal(id: number, ativo: boolean): Promise<Colaborador> {
  const colaboradores = ler<Colaborador>(CHAVE_COLABORADORES);
  const atual = colaboradores.find((c) => c.id === id);
  if (!atual) throw new Error('Colaborador não encontrado.');
  return substituir(CHAVE_COLABORADORES, colaboradores, { ...atual, ativo });
}

// ---------------- Pedidos ----------------
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
    // Continua a prazo: o vencimento original fica (mesmo que vença hoje ou já tenha vencido).
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

/** Baixa o estoque dos itens do pedido (como o baixarEstoque() do Produto no back). */
const baixarEstoque = (produtos: ProdutoCriarResponse[], itens: ItemPedido[], sinal = -1) =>
  produtos.map((p) => {
    const item = itens.find((i) => i.produtoId === p.id);
    return item ? { ...p, estoque: p.estoque + sinal * item.quantidade } : p;
  });

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
  if (estaVencido(pedido)) {
    throw new Error(MSG_VENCIDO_SO_PAGAR);
  }
  if (!podeCancelar(pedido)) throw new Error('Só pedido ainda não pago (e não devolvido) pode ser cancelado.');

  salvar(CHAVE_PRODUTOS, baixarEstoque(ler<ProdutoCriarResponse>(CHAVE_PRODUTOS), pedido.itens, +1));
  if (pedido.creditoUsado) ajustarCredito(pedido.clienteId, pedido.creditoUsado);
  return substituir(CHAVE_PEDIDOS, pedidos, { ...pedido, canceladoEm: new Date().toISOString() });
}

export async function listarPedidosLocal(): Promise<Pedido[]> {
  return lerPedidos().reverse(); // mais recentes primeiro
}

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

export async function devolverPedidoLocal(pedidoId: number): Promise<Pedido> {
  const pedidos = ler<Pedido>(CHAVE_PEDIDOS);
  const pedido = pedidos.find((p) => p.id === pedidoId);

  if (!pedido || pedido.tipo !== 'ALUGUEL') throw new Error('Aluguel não encontrado.');
  if (pedido.devolvidoEm) throw new Error('Este aluguel já foi devolvido.');
  if (statusDoPedido(pedido) !== 'CONCLUIDO') throw new Error('Confirme o pedido antes de registrar a devolução.');

  // O estoque volta na devolução (o crédito, por enquanto, não volta).
  salvar(CHAVE_PRODUTOS, baixarEstoque(ler<ProdutoCriarResponse>(CHAVE_PRODUTOS), pedido.itens, +1));
  return substituir(CHAVE_PEDIDOS, pedidos, { ...pedido, devolvidoEm: new Date().toISOString() });
}
