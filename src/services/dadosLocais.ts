/**
 * ============================================================
 *  DADOS LOCAIS (temporário) — salva no localStorage do navegador
 * ============================================================
 * Faz o papel do back-end enquanto ele não está integrado.
 * Para usar o back-end real: USAR_DADOS_LOCAIS = false em config/api.ts.
 * Para limpar os dados: F12 > Application > Local Storage > apagar "nexus:*".
 */
import { PRAZO_DIAS, resumoPedido } from '../regras';
import type {
  ClienteCriarRequest,
  ClienteCriarResponse,
  ClienteListarResponse,
  Colaborador,
  ItemPedido,
  Pedido,
  PedidoCriarRequest,
  ProdutoCriarRequest,
  ProdutoCriarResponse,
  ProdutoListarResponse,
  SolicitacaoDesconto,
} from '../types';

// "v2": formato novo (CNPJ, limite de crédito, status). Dados antigos de teste ficam de lado.
const CHAVE_CLIENTES = 'nexus:v2:clientes';
const CHAVE_PRODUTOS = 'nexus:v2:produtos';
const CHAVE_PEDIDOS = 'nexus:v2:pedidos';

// O que fica guardado (como a tabela do banco): tem id e cnpj.
type ClienteSalvo = ClienteCriarRequest & { id: number };

/** Colaboradores fictícios (não há cadastro de colaborador ainda). */
const COLABORADORES: Colaborador[] = [
  { id: 1, nome: 'Ana Souza' },
  { id: 2, nome: 'Carlos Lima' },
  { id: 3, nome: 'Beatriz Rocha' },
];

function ler<T>(chave: string): T[] {
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

/** Simula o @GeneratedValue(IDENTITY): maior id atual + 1. */
function proximoId(itens: { id: number }[]): number {
  return itens.reduce((maior, item) => Math.max(maior, item.id), 0) + 1;
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
  return ler<ClienteSalvo>(CHAVE_CLIENTES).map(
    ({ id, name, telefone, email, categoria, limiteCredito }) => ({
      id,
      name,
      telefone,
      email,
      categoria,
      limiteCredito,
    }),
  );
}

// ---------------- Produtos ----------------
export async function cadastrarProdutoLocal(dados: ProdutoCriarRequest): Promise<ProdutoCriarResponse> {
  const produtos = ler<ProdutoCriarResponse>(CHAVE_PRODUTOS);
  const novo: ProdutoCriarResponse = { ...dados, id: proximoId(produtos), nome: dados.nome.trim() };
  salvar(CHAVE_PRODUTOS, [...produtos, novo]);
  return novo;
}

export async function listarProdutosLocal(): Promise<ProdutoListarResponse[]> {
  return ler<ProdutoListarResponse>(CHAVE_PRODUTOS);
}

// ---------------- Colaboradores ----------------
export async function listarColaboradoresLocal(): Promise<Colaborador[]> {
  return COLABORADORES;
}

// ---------------- Pedidos ----------------
export async function criarPedidoLocal(req: PedidoCriarRequest): Promise<Pedido> {
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES);
  const produtos = ler<ProdutoCriarResponse>(CHAVE_PRODUTOS);
  const pedidos = ler<Pedido>(CHAVE_PEDIDOS);

  const cliente = clientes.find((c) => c.id === req.clienteId);
  if (!cliente) throw new Error('Cliente não encontrado.');
  if (req.itens.length === 0) throw new Error('O pedido precisa de pelo menos um produto.');

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
    return { produtoId, nome: produto.nome, precoUnitario: produto.preco, quantidade };
  });

  // Só cliente NORMAL solicita desconto; VIP já recebe 5% automático.
  const solicitacao: SolicitacaoDesconto | undefined =
    cliente.categoria === 'NORMAL' && req.descontoSolicitado
      ? { percentual: req.descontoSolicitado, status: 'PENDENTE' }
      : undefined;

  const agora = new Date();
  const vencimento = new Date(agora);
  if (req.pagamento === 'A_PRAZO') vencimento.setDate(vencimento.getDate() + PRAZO_DIAS);

  const novo: Pedido = {
    id: proximoId(pedidos),
    clienteId: cliente.id,
    clienteNome: cliente.name,
    clienteCategoria: cliente.categoria,
    limiteCredito: cliente.limiteCredito,
    itens,
    pagamento: req.pagamento,
    solicitacao,
    criadoEm: agora.toISOString(),
    emissao: agora.toISOString(),
    vencimento: vencimento.toISOString(),
  };

  if (req.pagamento === 'A_PRAZO' && resumoPedido(novo).total > cliente.limiteCredito) {
    throw new Error('Total do pedido acima do limite de crédito do cliente.');
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
  return novo;
}

export async function listarPedidosLocal(): Promise<Pedido[]> {
  return ler<Pedido>(CHAVE_PEDIDOS).reverse(); // mais recentes primeiro
}

export async function decidirDescontoLocal(
  pedidoId: number,
  aprovar: boolean,
  colaboradorId: number,
): Promise<Pedido> {
  const pedidos = ler<Pedido>(CHAVE_PEDIDOS);
  const pedido = pedidos.find((p) => p.id === pedidoId);
  const colaborador = COLABORADORES.find((c) => c.id === colaboradorId);

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
  salvar(CHAVE_PEDIDOS, pedidos.map((p) => (p.id === pedidoId ? atualizado : p)));
  return atualizado;
}
