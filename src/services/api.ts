import { API_BASE_URL, ENDPOINTS, USAR_DADOS_LOCAIS } from '../config/api';
import type {
  ClienteCategoria,
  ClienteCriarRequest,
  ClienteCriarResponse,
  ClienteListarResponse,
  Colaborador,
  ColaboradorCriarRequest,
  PedidoCriarRequest,
  ProdutoCriarRequest,
  ProdutoCriarResponse,
  ProdutoEditarRequest,
  ProdutoListarResponse,
  ProdutoStatus,
} from '../types';
import {
  cadastrarClienteLocal,
  cadastrarColaboradorLocal,
  cadastrarProdutoLocal,
  confirmarPedidoLocal,
  criarPedidoLocal,
  decidirDescontoLocal,
  definirClienteAtivoLocal,
  definirColaboradorAtivoLocal,
  cancelarPedidoLocal,
  devolverPedidoLocal,
  editarClienteLocal,
  editarColaboradorLocal,
  editarPedidoLocal,
  editarProdutoLocal,
  listarClientesLocal,
  listarColaboradoresLocal,
  listarPedidosLocal,
  listarProdutosLocal,
  pagarPedidoLocal,
  reporEstoqueLocal,
} from './dadosLocais';

/**
 * Autenticação (Spring Security).
 * Hoje o back libera tudo (SecurityConf: permitAll), então não precisa de header.
 * Se passar a exigir token (JWT), retorne aqui: { Authorization: `Bearer ...` }.
 */
function getAuthHeaders(): Record<string, string> {
  return {};
}

/** Erro do Spring vem como ProblemDetail: { title, detail, errors: [{ field, message }] }. */
async function erroDaResposta(response: Response): Promise<Error> {
  const texto = await response.text();
  try {
    const p = JSON.parse(texto) as { title?: string; detail?: string; errors?: { field?: string; message?: string }[] };
    const campos = p.errors?.map((e) => [e.field, e.message].filter(Boolean).join(': ')).join('; ');
    const msg = [p.detail, campos].filter(Boolean).join(' — ') || p.title;
    if (msg) return new Error(msg);
  } catch {
    // não é JSON: usa o texto puro
  }
  return new Error(`Erro ${response.status}: ${texto || response.statusText}`);
}

async function post<T>(endpoint: string, body: unknown): Promise<T | null> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await erroDaResposta(response);
  // Alguns endpoints retornam 201/204 sem corpo
  const texto = await response.text();
  return texto ? (JSON.parse(texto) as T) : null;
}

async function get<T>(endpoint: string): Promise<T[]> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'GET', headers: getAuthHeaders() });
  if (!response.ok) throw await erroDaResposta(response);

  const dados: unknown = await response.json();
  if (Array.isArray(dados)) return dados as T[]; // lista simples
  const content = (dados as { content?: unknown } | null)?.content; // paginação do Spring (Page<T>)
  return Array.isArray(content) ? (content as T[]) : [];
}

// ============================================================
//  DTOs do back (records Java) — nomes exatamente como lá
// ============================================================
interface ClienteBackRequest {
  name: string;
  telefone: string;
  cnpj: string;
  email: string;
  limiteDeCredito: number;
  classificacao: ClienteCategoria;
}
interface ClienteBackCriarResponse {
  id: number;
  name: string;
  email: string;
  classificacao: ClienteCategoria;
}
/** O back ainda não devolve id nem cnpj na listagem (o pedido precisa deles). */
interface ClienteBackListar {
  id?: number;
  name: string;
  telefone: string;
  email: string;
  limiteDeCredito: number;
  classificacao: ClienteCategoria;
}

interface ProdutoBackRequest {
  nome: string;
  descricao: string;
  estoque: number;
  precoVenda: number;
  precoAluguel: number;
}
type ProdutoBackCriarResponse = ProdutoBackRequest & { id: number };
/** A listagem do back hoje devolve só nome, descricao, estoque e "preco"; id, preços e status ainda faltam. */
interface ProdutoBackListar {
  id?: number;
  nome: string;
  descricao: string;
  estoque: number;
  preco?: number;
  precoVenda?: number;
  precoAluguel?: number;
  statusProduto?: ProdutoStatus;
}

interface ColaboradorBack {
  id?: number; // o back ainda não devolve id na listagem (a aprovação de desconto precisa dele)
  name: string;
  cpf: string;
  email: string;
}

/** Enquanto o back não devolve id, usa um id negativo provisório só para a tela (não serve para pedido). */
const idProvisorio = (id: number | undefined, i: number) => id ?? -(i + 1);

// ============================================================
//  Clientes
// ============================================================
export async function cadastrarCliente(cliente: ClienteCriarRequest): Promise<ClienteCriarResponse | null> {
  if (USAR_DADOS_LOCAIS) return cadastrarClienteLocal(cliente);
  const corpo: ClienteBackRequest = {
    name: cliente.name,
    telefone: cliente.telefone,
    cnpj: cliente.cnpj.replace(/[^0-9a-z]/gi, '').toUpperCase(),
    email: cliente.email,
    limiteDeCredito: cliente.limiteCredito,
    classificacao: cliente.categoria,
  };
  const r = await post<ClienteBackCriarResponse>(ENDPOINTS.clientes, corpo);
  return r && { id: r.id, name: r.name, email: r.email, categoria: r.classificacao, limiteCredito: cliente.limiteCredito };
}

export async function listarClientes(): Promise<ClienteListarResponse[]> {
  if (USAR_DADOS_LOCAIS) return listarClientesLocal();
  const lista = await get<ClienteBackListar>(ENDPOINTS.clientes);
  return lista.map((c, i) => ({
    id: idProvisorio(c.id, i),
    name: c.name,
    telefone: c.telefone,
    email: c.email,
    categoria: c.classificacao,
    limiteCredito: Number(c.limiteDeCredito ?? 0),
  }));
}

// ============================================================
//  Produtos
// ============================================================
export async function cadastrarProduto(produto: ProdutoCriarRequest): Promise<ProdutoCriarResponse | null> {
  if (USAR_DADOS_LOCAIS) return cadastrarProdutoLocal(produto);
  const corpo: ProdutoBackRequest = { ...produto };
  const r = await post<ProdutoBackCriarResponse>(ENDPOINTS.produtos, corpo);
  return r && { ...r, status: 'DISPONIVEL' };
}

export async function listarProdutos(): Promise<ProdutoListarResponse[]> {
  if (USAR_DADOS_LOCAIS) return listarProdutosLocal();
  const lista = await get<ProdutoBackListar>(ENDPOINTS.produtos);
  return lista.map((p, i) => ({
    id: idProvisorio(p.id, i),
    nome: p.nome,
    descricao: p.descricao ?? '',
    estoque: Number(p.estoque ?? 0),
    precoVenda: Number(p.precoVenda ?? p.preco ?? 0),
    precoAluguel: Number(p.precoAluguel ?? 0),
    status: p.statusProduto ?? 'DISPONIVEL',
  }));
}

// ============================================================
//  Colaboradores
// ============================================================
export async function listarColaboradores(): Promise<Colaborador[]> {
  if (USAR_DADOS_LOCAIS) return listarColaboradoresLocal();
  const lista = await get<ColaboradorBack>(ENDPOINTS.colaboradores);
  return lista.map((c, i) => ({ id: idProvisorio(c.id, i), nome: c.name, cpf: c.cpf, email: c.email }));
}

export async function cadastrarColaborador(colaborador: ColaboradorCriarRequest): Promise<Colaborador> {
  if (USAR_DADOS_LOCAIS) return cadastrarColaboradorLocal(colaborador);
  const corpo: ColaboradorBack = {
    name: colaborador.nome.trim(),
    cpf: colaborador.cpf.replace(/\D/g, ''),
    email: colaborador.email.trim(),
  };
  const r = await post<ColaboradorBack>(ENDPOINTS.colaboradores, corpo);
  return { id: r?.id ?? -1, nome: r?.name ?? corpo.name, cpf: r?.cpf ?? corpo.cpf, email: r?.email ?? corpo.email };
}

// ============================================================
//  Pedidos e descontos
// ============================================================
/**
 * O back já tem rotas de pedido (POST/GET /pedidos, /{id}/desconto, /{id}/finalizar, /{id}/devolucao),
 * mas as regras ainda estão diferentes das do front (o Lucas está terminando). Por isso pedidos e
 * descontos continuam só no modo local por enquanto.
 */
function exigirModoLocal() {
  if (!USAR_DADOS_LOCAIS) {
    throw new Error('Pedidos e descontos ainda não estão ligados ao back-end (só funcionam com os dados locais).');
  }
}

export async function criarPedido(pedido: PedidoCriarRequest) {
  exigirModoLocal();
  return criarPedidoLocal(pedido);
}

export async function listarPedidos() {
  exigirModoLocal();
  return listarPedidosLocal();
}

export async function decidirDesconto(pedidoId: number, aprovar: boolean, colaboradorId: number) {
  exigirModoLocal();
  return decidirDescontoLocal(pedidoId, aprovar, colaboradorId);
}

export async function confirmarPedido(pedidoId: number) {
  exigirModoLocal();
  return confirmarPedidoLocal(pedidoId);
}

export async function pagarPedido(pedidoId: number) {
  exigirModoLocal();
  return pagarPedidoLocal(pedidoId);
}

export async function devolverPedido(pedidoId: number) {
  exigirModoLocal();
  return devolverPedidoLocal(pedidoId);
}

export async function editarPedido(pedidoId: number, pedido: PedidoCriarRequest) {
  exigirModoLocal();
  return editarPedidoLocal(pedidoId, pedido);
}

// ============================================================
//  Edição, desativação e reposição de estoque
// ============================================================
/** O back ainda não tem rotas de editar, desativar nem repor estoque: por enquanto só nos dados locais. */
function exigirLocal(acao: string) {
  if (!USAR_DADOS_LOCAIS) {
    throw new Error(`${acao} ainda não existe no back-end (só funciona com os dados locais).`);
  }
}

export async function editarCliente(id: number, cliente: ClienteCriarRequest) {
  exigirLocal('Editar cliente');
  return editarClienteLocal(id, cliente);
}

export async function definirClienteAtivo(id: number, ativo: boolean) {
  exigirLocal(ativo ? 'Reativar cliente' : 'Desativar cliente');
  return definirClienteAtivoLocal(id, ativo);
}

export async function editarProduto(id: number, produto: ProdutoEditarRequest) {
  exigirLocal('Editar produto');
  return editarProdutoLocal(id, produto);
}

export async function reporEstoque(id: number, quantidade: number) {
  exigirLocal('Repor estoque');
  return reporEstoqueLocal(id, quantidade);
}

export async function editarColaborador(id: number, colaborador: ColaboradorCriarRequest) {
  exigirLocal('Editar colaborador');
  return editarColaboradorLocal(id, colaborador);
}

export async function definirColaboradorAtivo(id: number, ativo: boolean) {
  exigirLocal(ativo ? 'Reativar colaborador' : 'Desativar colaborador');
  return definirColaboradorAtivoLocal(id, ativo);
}

export async function cancelarPedido(pedidoId: number) {
  exigirModoLocal();
  return cancelarPedidoLocal(pedidoId);
}
