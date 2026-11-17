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
  erroDesconto,
  erroVencimento,
  estaInadimplente,
  fimDoDia,
  pagoNaHora,
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
  ProdutoListarResponse,
  SolicitacaoDesconto,
} from '../types';

// "v7": pedido com descrição, vencimento escolhido (a prazo) e fim do aluguel separado.
// Dados antigos de teste ficam de lado.
const CHAVE_CLIENTES = 'nexus:v7:clientes';
const CHAVE_PRODUTOS = 'nexus:v7:produtos';
const CHAVE_PEDIDOS = 'nexus:v7:pedidos';
const CHAVE_COLABORADORES = 'nexus:v7:colaboradores';

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
  return pedidos.map((p) =>
    p.pagoEm ? p : { ...p, clienteInadimplente: estaInadimplente(p.clienteId, pedidos) },
  );
}

/** Simula o @GeneratedValue(IDENTITY): maior id atual + 1. */
function proximoId(itens: { id: number }[]): number {
  return itens.reduce((maior, item) => Math.max(maior, item.id), 0) + 1;
}

/** Soma ao limite de crédito do cliente (valor negativo desconta). */
function ajustarCredito(clienteId: number, valor: number) {
  salvar(
    CHAVE_CLIENTES,
    ler<ClienteSalvo>(CHAVE_CLIENTES).map((c) =>
      c.id === clienteId ? { ...c, limiteCredito: Math.round((c.limiteCredito + valor) * 100) / 100 } : c,
    ),
  );
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
export async function cadastrarClienteLocal(dados: ClienteCriarRequest): Promise<ClienteCriarResponse> {
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES);
  const cnpj = dados.cnpj.replace(/[^0-9a-z]/gi, '').toUpperCase();
  const email = dados.email.trim();

  if (!cnpjValido(cnpj)) throw new Error('CNPJ inválido.');
  if (clientes.some((c) => c.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Já existe um cliente com esse e-mail.'); // coluna unique
  }

  const novo: ClienteSalvo = { ...dados, id: proximoId(clientes), name: dados.name.trim(), cnpj, email };
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
    ({ id, name, telefone, email, categoria, limiteCredito }) => ({
      id,
      name,
      telefone,
      email,
      categoria,
      limiteCredito,
      inadimplente: estaInadimplente(id, pedidos),
    }),
  );
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

// ---------------- Colaboradores ----------------
export async function listarColaboradoresLocal(): Promise<Colaborador[]> {
  return ler<Colaborador>(CHAVE_COLABORADORES);
}

export async function cadastrarColaboradorLocal(dados: ColaboradorCriarRequest): Promise<Colaborador> {
  const colaboradores = ler<Colaborador>(CHAVE_COLABORADORES);
  const nome = dados.nome.trim();
  const cpf = dados.cpf.replace(/\D/g, '');
  const email = dados.email.trim();

  if (nome.length < 3) throw new Error('Informe o nome do colaborador.');
  if (!cpfValido(cpf)) throw new Error('CPF inválido.');
  if (colaboradores.some((c) => c.cpf === cpf)) throw new Error('Já existe um colaborador com esse CPF.');
  if (colaboradores.some((c) => c.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Já existe um colaborador com esse e-mail.');
  }

  const novo: Colaborador = { id: proximoId(colaboradores), nome, cpf, email };
  salvar(CHAVE_COLABORADORES, [...colaboradores, novo]);
  return novo;
}

// ---------------- Pedidos ----------------
export async function criarPedidoLocal(req: PedidoCriarRequest): Promise<Pedido> {
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES);
  const produtos = ler<ProdutoCriarResponse>(CHAVE_PRODUTOS);
  const pedidos = ler<Pedido>(CHAVE_PEDIDOS);

  const cliente = clientes.find((c) => c.id === req.clienteId);
  if (!cliente) throw new Error('Cliente não encontrado.');
  if (req.itens.length === 0) throw new Error('O pedido precisa de pelo menos um produto.');

  // Inadimplente (pedido a prazo vencido e não pago): só PIX ou à vista.
  const inadimplente = estaInadimplente(cliente.id, pedidos);
  if (inadimplente && req.pagamento === 'A_PRAZO') {
    throw new Error('Cliente inadimplente: não pode fazer pedido a prazo. Use PIX ou à vista.');
  }

  // Aluguel: o fim do aluguel é calculado pela quantidade de meses.
  const aluguel = req.tipo === 'ALUGUEL';
  const meses = aluguel ? req.meses : undefined;
  if (aluguel && (!meses || !Number.isInteger(meses) || meses <= 0)) {
    throw new Error('Informe a duração do aluguel em meses.');
  }

  const itens: ItemPedido[] = req.itens.map(({ produtoId, quantidade }) => {
    const produto = produtos.find((p) => p.id === produtoId);
    if (!produto) throw new Error('Produto não encontrado.');
    if (produto.status !== 'DISPONIVEL') throw new Error(`"${produto.nome}" não está disponível.`);
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw new Error(`Quantidade inválida para "${produto.nome}".`);
    }
    if (quantidade > produto.estoque) {
      throw new Error(`Estoque insuficiente de "${produto.nome}" (disponível: ${produto.estoque}).`);
    }
    const precoUnitario = aluguel ? produto.precoAluguel : produto.precoVenda;
    return { produtoId, nome: produto.nome, precoUnitario, quantidade };
  });

  // NORMAL solicita de 1% a 10%; VIP (que já tem 5%) solicita de 10% a 15% para substituir os 5%;
  // VIP inadimplente (sem os 5%) solicita de 1% a 15%. Sempre depende de aprovação.
  let solicitacao: SolicitacaoDesconto | undefined;
  if (req.descontoSolicitado != null) {
    const erro = erroDesconto(req.descontoSolicitado, cliente.categoria, inadimplente);
    if (erro) throw new Error(erro);
    solicitacao = { percentual: req.descontoSolicitado, status: 'PENDENTE' };
  }

  // A prazo: o vencimento é a data escolhida no pedido (obrigatória e futura). PIX/à vista: a emissão.
  const agora = new Date();
  let vencimento = agora;
  if (req.pagamento === 'A_PRAZO') {
    const erro = erroVencimento(req.dataVencimento);
    if (erro) throw new Error(erro);
    vencimento = fimDoDia(req.dataVencimento!)!;
  }
  // Aluguel: o fim do aluguel é calculado pela quantidade de meses.
  let fimAluguel: Date | undefined;
  if (meses) {
    fimAluguel = new Date(agora);
    fimAluguel.setMonth(fimAluguel.getMonth() + meses);
  }

  const descricao = req.descricao?.trim();
  const novo: Pedido = {
    id: proximoId(pedidos),
    tipo: req.tipo,
    clienteId: cliente.id,
    clienteNome: cliente.name,
    clienteCategoria: cliente.categoria,
    descricao: descricao || undefined,
    itens,
    meses,
    pagamento: req.pagamento,
    solicitacao,
    criadoEm: agora.toISOString(),
    emissao: agora.toISOString(),
    vencimento: vencimento.toISOString(),
    fimAluguel: fimAluguel?.toISOString(),
    pagoEm: pagoNaHora({ pagamento: req.pagamento, solicitacao }) ? agora.toISOString() : undefined,
    clienteInadimplente: inadimplente,
  };

  // A prazo (venda ou aluguel): valida e desconta o total do limite de crédito do cliente.
  const total = resumoPedido(novo).total;
  if (req.pagamento === 'A_PRAZO') {
    if (total > cliente.limiteCredito) throw new Error('Total do pedido acima do limite de crédito do cliente.');
    novo.creditoUsado = total;
  }

  // Baixa de estoque (como o baixarEstoque() do Produto no back)
  salvar(
    CHAVE_PRODUTOS,
    produtos.map((p) => {
      const item = itens.find((i) => i.produtoId === p.id);
      return item ? { ...p, estoque: p.estoque - item.quantidade } : p;
    }),
  );
  salvar(CHAVE_PEDIDOS, [...pedidos, novo]);
  if (req.pagamento === 'A_PRAZO') ajustarCredito(cliente.id, -total);
  return novo;
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
  if (!pedido?.solicitacao || pedido.solicitacao.status !== 'PENDENTE') {
    throw new Error('Não há solicitação pendente para este pedido.');
  }

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
    devolver = Math.max(0, Math.round((usado - resumoPedido(atualizado).total) * 100) / 100);
    atualizado.creditoUsado = Math.round((usado - devolver) * 100) / 100;
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
  if (statusDoPedido(pedido) !== 'PENDENTE') throw new Error('Este pedido já foi concluído ou devolvido.');
  if (aguardaDesconto(pedido)) {
    throw new Error('Aguarde a decisão sobre o desconto solicitado antes de confirmar o pedido.');
  }

  const atualizado: Pedido = { ...pedido, concluidoEm: new Date().toISOString() };
  salvar(CHAVE_PEDIDOS, pedidos.map((p) => (p.id === pedidoId ? atualizado : p)));
  return atualizado;
}

/** Registra o pagamento de um pedido a prazo: o crédito reservado volta ao limite do cliente. */
export async function pagarPedidoLocal(pedidoId: number): Promise<Pedido> {
  // A situação do cliente (inadimplente ou não) fica gravada no pedido no momento do pagamento.
  const pedidos = lerPedidos();
  const pedido = pedidos.find((p) => p.id === pedidoId);

  if (!pedido) throw new Error('Pedido não encontrado.');
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
  const produtos = ler<ProdutoCriarResponse>(CHAVE_PRODUTOS);
  const pedido = pedidos.find((p) => p.id === pedidoId);

  if (!pedido || pedido.tipo !== 'ALUGUEL') throw new Error('Aluguel não encontrado.');
  if (pedido.devolvidoEm) throw new Error('Este aluguel já foi devolvido.');
  if (statusDoPedido(pedido) !== 'CONCLUIDO') throw new Error('Confirme o pedido antes de registrar a devolução.');

  const atualizado: Pedido = { ...pedido, devolvidoEm: new Date().toISOString() };

  // O estoque volta na devolução (o crédito, por enquanto, não volta).
  salvar(
    CHAVE_PRODUTOS,
    produtos.map((p) => {
      const item = pedido.itens.find((i) => i.produtoId === p.id);
      return item ? { ...p, estoque: p.estoque + item.quantidade } : p;
    }),
  );
  salvar(CHAVE_PEDIDOS, pedidos.map((p) => (p.id === pedidoId ? atualizado : p)));
  return atualizado;
}
