/** Chamadas HTTP ao back-end (GET/POST), leitura de erro do Spring e as travas do modo local. */
import { API_BASE_URL, USAR_DADOS_LOCAIS } from '../../config/api';

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

export async function post<T>(endpoint: string, body: unknown): Promise<T | null> {
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

export async function get<T>(endpoint: string): Promise<T[]> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'GET', headers: getAuthHeaders() });
  if (!response.ok) throw await erroDaResposta(response);

  const dados: unknown = await response.json();
  if (Array.isArray(dados)) return dados as T[]; // lista simples
  const content = (dados as { content?: unknown } | null)?.content; // paginação do Spring (Page<T>)
  return Array.isArray(content) ? (content as T[]) : [];
}

/** Enquanto o back não devolve id, usa um id negativo provisório só para a tela (não serve para pedido). */
export const idProvisorio = (id: number | undefined, i: number) => id ?? -(i + 1);

/**
 * O back já tem rotas de pedido (POST/GET /pedidos, /{id}/desconto, /{id}/finalizar, /{id}/devolucao),
 * mas as regras ainda estão diferentes das do front (o Lucas está terminando). Por isso pedidos e
 * descontos continuam só no modo local por enquanto.
 */
export function exigirModoLocal() {
  if (!USAR_DADOS_LOCAIS) {
    throw new Error('Pedidos e descontos ainda não estão ligados ao back-end (só funcionam com os dados locais).');
  }
}

/** O back ainda não tem rotas de editar, desativar nem repor estoque: por enquanto só nos dados locais. */
export function exigirLocal(acao: string) {
  if (!USAR_DADOS_LOCAIS) {
    throw new Error(`${acao} ainda não existe no back-end (só funciona com os dados locais).`);
  }
}
