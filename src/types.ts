/**
 * Tipos espelhando os DTOs do back-end (Java records).
 * Cada interface tem o mesmo nome do record correspondente.
 */

export type ClienteCategoria = 'NORMAL' | 'VIP';

/** ClienteCriarRequest */
export interface ClienteCriarRequest {
  name: string;
  telefone: string;
  cpf: string;
  email: string;
  categoria: ClienteCategoria;
}

/** ClienteCriarResponse */
export interface ClienteCriarResponse {
  id: number;
  name: string;
  email: string;
  categoria: ClienteCategoria;
}

/** ClienteListarResponse (não traz id nem cpf) */
export interface ClienteListarResponse {
  name: string;
  telefone: string;
  email: string;
  categoria: ClienteCategoria;
}

/** ProdutoCriarRequest */
export interface ProdutoCriarRequest {
  nome: string;
  descricao: string;
  estoque: number;
  preco: number; // BigDecimal no Java
}

/** ProdutoCriarResponse */
export interface ProdutoCriarResponse extends ProdutoCriarRequest {
  id: number;
}

/** ProdutoListarResponse (não traz id) */
export interface ProdutoListarResponse {
  nome: string;
  descricao: string;
  estoque: number;
  preco: number;
}
