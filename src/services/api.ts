import { API_BASE_URL, ENDPOINTS } from '../config/api';

/**
 * Formato dos dados enviados ao back-end.
 * TROQUE os nomes dos campos para bater com o DTO do Java
 * (ex.: se o DTO tiver "email" em vez de "contato", renomeie aqui).
 */
export interface ClienteRequest {
  nome: string;
  contato: string; // telefone ou e-mail
}

export interface ProdutoRequest {
  nome: string;
  codigo: string;
}

/**
 * Formato dos dados que o back-end devolve na listagem.
 * Normalmente é o mesmo do Request + o "id" gerado pelo banco.
 * Ajuste os nomes se o DTO de resposta for diferente.
 */
export interface ClienteResponse extends ClienteRequest {
  id?: number | string;
}

export interface ProdutoResponse extends ProdutoRequest {
  id?: number | string;
}

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

export function cadastrarCliente(cliente: ClienteRequest) {
  return post(ENDPOINTS.cadastrarCliente, cliente);
}

export function cadastrarProduto(produto: ProdutoRequest) {
  return post(ENDPOINTS.cadastrarProduto, produto);
}

export function listarClientes() {
  return get<ClienteResponse>(ENDPOINTS.listarClientes);
}

export function listarProdutos() {
  return get<ProdutoResponse>(ENDPOINTS.listarProdutos);
}