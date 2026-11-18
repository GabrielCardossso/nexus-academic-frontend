/** Tipos de cliente. Espelham os DTOs do back (records Java), com os nomes que o front usa por dentro. */

export type ClienteCategoria = 'NORMAL' | 'VIP';

export interface ClienteCriarRequest {
  name: string; // nome ou razão social
  telefone: string;
  cnpj: string;
  email: string;
  categoria: ClienteCategoria;
  limiteCredito: number;
}

export interface ClienteCriarResponse {
  id: number;
  name: string;
  email: string;
  categoria: ClienteCategoria;
  limiteCredito: number;
}

export interface ClienteListarResponse {
  id: number; // necessário para o cliente poder ser escolhido no pedido
  name: string;
  telefone: string;
  email: string;
  categoria: ClienteCategoria;
  limiteCredito: number;
  inadimplente?: boolean; // calculado: tem pedido a prazo vencido e não pago
  ativo?: boolean; // false = desativado (não entra em pedido novo). Ausente = ativo.
  cnpj?: string; // só nos dados locais (o back ainda não devolve na listagem); usado na edição
}

/** Cliente como fica guardado (como a tabela do banco): tem id e cnpj. */
export type ClienteSalvo = ClienteCriarRequest & { id: number; ativo?: boolean };
