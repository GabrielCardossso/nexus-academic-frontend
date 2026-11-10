import { API_BASE_URL, ENDPOINTS, USAR_DADOS_LOCAIS } from '../config/api';
import type {
  ClienteCriarRequest,
  ClienteCriarResponse,
  ClienteListarResponse,
  ProdutoCriarRequest,
  ProdutoCriarResponse,
  ProdutoListarResponse,
} from '../types';
import {
  cadastrarClienteLocal,
  cadastrarProdutoLocal,
  listarClientesLocal,
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
