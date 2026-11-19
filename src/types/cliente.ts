/** Tipos de cliente. Espelham os DTOs do back (records Java), com os nomes que o front usa por dentro. */

/** enums/ClienteClassificao.java. */
export type ClienteCategoria = 'NORMAL' | 'VIP';

/** POST /clientes e PUT /clientes/{id}/editar (dtos/ClienteCriarRequest.java e ClienteEditarRequest.java). */
export interface ClienteCriarRequest {
  name: string; // nome ou razão social (3 a 60 caracteres)
  telefone: string;
  cnpj: string;
  email: string;
  categoria: ClienteCategoria; // "classificacao" no back
  limiteCredito: number; // "limiteDeCredito" no back
}

/** PUT /clientes/{id}/editar: o limite é opcional (sem ele, o back mantém o atual). */
export type ClienteEditarRequest = Omit<ClienteCriarRequest, 'limiteCredito'> & { limiteCredito?: number };

/** Resposta do POST /clientes (dtos/ClienteCriarResponse.java). */
export interface ClienteCriarResponse {
  id: number;
  name: string;
  email: string;
  categoria: ClienteCategoria;
  limiteCredito: number;
}

/**
 * GET /clientes (dtos/ClienteListarResponse.java): id, name, cnpj, telefone, email, limiteDeCredito e
 * classificacao. `inadimplente` é calculado pelo front; `ativo` só os dados locais preenchem (o back
 * não lista desativados).
 */
export interface ClienteListarResponse {
  id: number;
  name: string;
  telefone: string;
  email: string;
  categoria: ClienteCategoria;
  limiteCredito: number; // limite disponível (os pedidos a prazo pendentes já foram descontados)
  cnpj: string; // o pedido é criado pelo CNPJ do cliente
  inadimplente?: boolean; // calculado: tem pedido pendente com vencimento antes de hoje
  ativo?: boolean; // false = desativado (soft delete no back). Ausente = ativo.
}

/** Cliente como fica guardado nos dados locais (como a tabela do banco, com o "excluido" do @SoftDelete). */
export type ClienteSalvo = ClienteCriarRequest & { id: number; excluido?: boolean };
