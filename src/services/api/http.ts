/** Chamadas HTTP ao back-end (GET/POST/PUT/DELETE) e leitura do erro do Spring (ProblemDetail). */
import { API_BASE_URL } from '../../config/api';

/**
 * Autenticação (Spring Security).
 * Hoje o back libera tudo (SecurityConf: permitAll), então não precisa de header.
 * Se passar a exigir token (JWT), retorne aqui: { Authorization: `Bearer ...` }.
 */
function getAuthHeaders(): Record<string, string> {
  return {};
}

interface ProblemDetail {
  title?: string;
  detail?: string;
  /** Erros de validação (@Valid): GlobalExceptionHandler.criarErro. */
  errors?: { field?: string; rejectedValue?: string; message?: string }[];
  /** Valor inválido num enum: GlobalExceptionHandler.handleHttpMessageNotReadable. */
  field?: string;
  allowedValues?: string[];
}

/** Monta a mensagem do erro a partir do ProblemDetail do back (detail, errors e allowedValues). */
async function erroDaResposta(response: Response): Promise<Error> {
  const texto = await response.text();
  try {
    const p = JSON.parse(texto) as ProblemDetail;
    const campos = p.errors?.map((e) => [e.field, e.message].filter(Boolean).join(': ')).join('; ');
    const enumInvalido = p.field && p.allowedValues ? `${p.field}: use ${p.allowedValues.join(', ')}` : '';
    const msg = [p.detail, campos, enumInvalido].filter(Boolean).join(' — ') || p.title;
    if (msg) return new Error(msg);
  } catch {
    // não é JSON: usa o texto puro
  }
  return new Error(`Erro ${response.status}: ${texto || response.statusText}`);
}

async function requisicao<T>(metodo: string, endpoint: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: metodo,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...getAuthHeaders() },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      'Não foi possível falar com o back-end. Confira se ele está rodando e, fora do "npm run dev", se o CORS libera este endereço.',
    );
  }
  if (!response.ok) throw await erroDaResposta(response);
  const texto = await response.text();
  return (texto ? JSON.parse(texto) : null) as T;
}

export const get = <T>(endpoint: string) => requisicao<T>('GET', endpoint);
export const post = <T>(endpoint: string, body: unknown) => requisicao<T>('POST', endpoint, body);
export const put = <T>(endpoint: string, body?: unknown) => requisicao<T>('PUT', endpoint, body);
export const del = <T>(endpoint: string) => requisicao<T>('DELETE', endpoint);

/** Lista do back (array simples; se um dia vier paginado, lê o "content" do Page<T>). */
export async function getLista<T>(endpoint: string): Promise<T[]> {
  const dados = await get<unknown>(endpoint);
  if (Array.isArray(dados)) return dados as T[];
  const content = (dados as { content?: unknown } | null)?.content;
  return Array.isArray(content) ? (content as T[]) : [];
}

/** Enquanto o back não devolve id nas listagens, a tela usa um id negativo provisório só para mostrar. */
export const idProvisorio = (id: number | undefined, i: number) => id ?? -(i + 1);

/**
 * Ações que precisam do id (editar, excluir, reativar, repor estoque, decidir desconto) não podem
 * usar o id provisório: avisa em vez de chamar a API com um id que não existe.
 */
export function exigirId(id: number, oQue: string): number {
  if (id <= 0) {
    throw new Error(`${oQue}: o back ainda não devolve o id na listagem, então essa ação não pode ser feita pela tela.`);
  }
  return id;
}
