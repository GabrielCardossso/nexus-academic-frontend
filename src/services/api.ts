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

export function cadastrarCliente(cliente: ClienteRequest) {
  return post(ENDPOINTS.cadastrarCliente, cliente);
}

export function cadastrarProduto(produto: ProdutoRequest) {
  return post(ENDPOINTS.cadastrarProduto, produto);
}
