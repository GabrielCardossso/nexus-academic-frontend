import { API_BASE_URL, ENDPOINTS, USAR_DADOS_LOCAIS } from '../config/api';
import type {
  ClienteCriarRequest,
  ClienteCriarResponse,
  ClienteListarResponse,
  PedidoCriarRequest,
  ProdutoCriarRequest,
  ProdutoCriarResponse,
  ProdutoListarResponse,
} from '../types';
import {
  cadastrarClienteLocal,
  cadastrarProdutoLocal,
  criarPedidoLocal,
  decidirDescontoLocal,
  devolverPedidoLocal,
  listarClientesLocal,
  listarColaboradoresLocal,
  listarPedidosLocal,
  listarProdutosLocal,
} from './dadosLocais';

/**
 * Autenticação (Spring Security).
 * Se o back-end exigir token (JWT), retorne o header aqui.
 * Ex.: return { Authorization: `Bearer ${localStorage.getItem('token')}` };
 * Se não exigir nada, deixe retornando {}.
 */
function getAuthHeaders(): Record<string, string> {
  // TODO: coloque aqui o header de autenticação, se precisar
  return {};
}

async function post<T>(endpoint: string, body: unknown): Promise<T | null> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const texto = await response.text();
    throw new Error(`Erro ${response.status}: ${texto || response.statusText}`);
  }

  // Alguns endpoints retornam 201/204 sem corpo
  const texto = await response.text();
  return texto ? (JSON.parse(texto) as T) : null;
}

async function get<T>(endpoint: string): Promise<T[]> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    const texto = await response.text();
    throw new Error(`Erro ${response.status}: ${texto || response.statusText}`);
  }

  const dados: unknown = await response.json();

  // Lista simples: [ {...}, {...} ]
  if (Array.isArray(dados)) return dados as T[];

  // Paginação do Spring (Page<T>): { content: [ {...} ], ... }
  const content = (dados as { content?: unknown } | null)?.content;
  if (Array.isArray(content)) return content as T[];

  return [];
}

export function cadastrarCliente(cliente: ClienteCriarRequest) {
  if (USAR_DADOS_LOCAIS) return cadastrarClienteLocal(cliente);
  return post<ClienteCriarResponse>(ENDPOINTS.cadastrarCliente, cliente);
}

export function cadastrarProduto(produto: ProdutoCriarRequest) {
  if (USAR_DADOS_LOCAIS) return cadastrarProdutoLocal(produto);
  return post<ProdutoCriarResponse>(ENDPOINTS.cadastrarProduto, produto);
}

export function listarClientes() {
  if (USAR_DADOS_LOCAIS) return listarClientesLocal();
  return get<ClienteListarResponse>(ENDPOINTS.listarClientes);
}

export function listarProdutos() {
  if (USAR_DADOS_LOCAIS) return listarProdutosLocal();
  return get<ProdutoListarResponse>(ENDPOINTS.listarProdutos);
}

/**
 * Pedidos (venda e aluguel), descontos, devolução e colaboradores: o back ainda não tem endpoint para isso,
 * então só funcionam no modo local. Quando existirem, troque pelo mesmo padrão
 * dos clientes/produtos acima (post/get + ENDPOINTS).
 */
function exigirModoLocal() {
  if (!USAR_DADOS_LOCAIS) {
    throw new Error('Pedidos, descontos e colaboradores ainda não têm endpoint no back-end.');
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

export async function devolverPedido(pedidoId: number) {
  exigirModoLocal();
  return devolverPedidoLocal(pedidoId);
}

export async function listarColaboradores() {
  exigirModoLocal();
  return listarColaboradoresLocal();
}
