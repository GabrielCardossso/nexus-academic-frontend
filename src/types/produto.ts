/** Tipos de produto. Espelham os DTOs do back (records Java), com os nomes que o front usa por dentro. */

/** enums/StatusProduto.java. O cadastro do back não define status (fica nulo). */
export type ProdutoStatus = 'DISPONIVEL' | 'INDISPONIVEL' | 'DESATIVADO';

/** POST /produtos (dtos/ProdutoCriarRequest.java). */
export interface ProdutoCriarRequest {
  nome: string;
  descricao: string;
  estoque: number;
  precoVenda: number; // BigDecimal no Java
  precoAluguel: number; // BigDecimal no Java (valor do aluguel por unidade)
}

/** Resposta do POST /produtos (dtos/ProdutoCriarResponse.java): não traz status. */
export interface ProdutoCriarResponse extends ProdutoCriarRequest {
  id: number;
}

/**
 * GET /produtos (dtos/ProdutoListarResponse.java). O back devolve só nome, descrição, estoque e
 * preços. `id` e `status` vêm dos dados locais; com o back real o id é provisório (negativo) e o
 * status fica vazio até o back devolver.
 */
export interface ProdutoListarResponse extends ProdutoCriarRequest {
  id: number;
  status?: ProdutoStatus | null;
}

/**
 * PUT /produtos/{id}/editar (dtos/ProdutoEditarRequest.java). Sem estoque (só por "Repor estoque")
 * e sem status (o back não recebe).
 */
export interface ProdutoEditarRequest {
  nome: string;
  descricao: string;
  precoVenda: number;
  precoAluguel: number;
}
