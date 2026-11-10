/**
 * ============================================================
 *  DADOS LOCAIS (temporário) — salva no localStorage do navegador
 * ============================================================
 * Faz o papel do back-end enquanto ele não está integrado.
 * Mesmas funções do api.ts, então o App não sabe a diferença.
 * Para usar o back-end real: USAR_DADOS_LOCAIS = false em config/api.ts.
 * Para limpar os dados: F12 > Application > Local Storage > apagar "nexus:*".
 */
import type {
  ClienteCriarRequest,
  ClienteCriarResponse,
  ClienteListarResponse,
  ProdutoCriarRequest,
  ProdutoCriarResponse,
  ProdutoListarResponse,
} from '../types';

// O que fica guardado (como a tabela do banco): tem id e cpf.
type ClienteSalvo = ClienteCriarRequest & { id: number };

const CHAVE_CLIENTES = 'nexus:clientes';
const CHAVE_PRODUTOS = 'nexus:produtos';

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

/** Simula o @CPF do Java (confere os dígitos verificadores). */
function cpfValido(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (qtd: number) => {
    let soma = 0;
    for (let i = 0; i < qtd; i++) soma += Number(cpf[i]) * (qtd + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

export async function cadastrarClienteLocal(dados: ClienteCriarRequest): Promise<ClienteCriarResponse> {
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES);
  const cpf = dados.cpf.replace(/\D/g, '');
  const email = dados.email.trim();

  if (!cpfValido(cpf)) throw new Error('CPF inválido.');
  if (clientes.some((c) => c.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Já existe um cliente com esse e-mail.'); // coluna unique
  }

  const novo: ClienteSalvo = {
    ...dados,
    id: proximoId(clientes),
    name: dados.name.trim(),
    cpf,
    email,
  };
  salvar(CHAVE_CLIENTES, [...clientes, novo]);
  // Resposta igual à do back: ClienteCriarResponse
  return { id: novo.id, name: novo.name, email: novo.email, categoria: novo.categoria };
}

export async function cadastrarProdutoLocal(dados: ProdutoCriarRequest): Promise<ProdutoCriarResponse> {
  const produtos = ler<ProdutoCriarResponse>(CHAVE_PRODUTOS);
  const novo: ProdutoCriarResponse = { ...dados, id: proximoId(produtos), nome: dados.nome.trim() };
  salvar(CHAVE_PRODUTOS, [...produtos, novo]);
  return novo;
}

export async function listarClientesLocal(): Promise<ClienteListarResponse[]> {
  // Devolve só os campos do ClienteListarResponse (sem id e sem cpf)
  return ler<ClienteSalvo>(CHAVE_CLIENTES).map(({ name, telefone, email, categoria }) => ({
    name,
    telefone,
    email,
    categoria,
  }));
}

export async function listarProdutosLocal(): Promise<ProdutoListarResponse[]> {
  return ler<ProdutoCriarResponse>(CHAVE_PRODUTOS).map(({ nome, descricao, estoque, preco }) => ({
    nome,
    descricao,
    estoque,
    preco,
  }));
}
