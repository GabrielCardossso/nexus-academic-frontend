/** Tipos de produto. Espelham os DTOs do back (records Java). */

export type ProdutoStatus = 'DISPONIVEL' | 'INDISPONIVEL' | 'DESATIVADO';

export interface ProdutoCriarRequest {
  nome: string;
  descricao: string;
  estoque: number;
  precoVenda: number; // BigDecimal no Java
  precoAluguel: number; // valor por mês
  // O status não vai no cadastro (o back não recebe): produto novo entra como DISPONIVEL nos dados locais.
}

export interface ProdutoCriarResponse extends ProdutoCriarRequest {
  id: number;
  status: ProdutoStatus;
}

export interface ProdutoListarResponse extends ProdutoCriarRequest {
  id: number; // necessário para o produto poder ser escolhido no pedido
  status: ProdutoStatus; // só produtos DISPONIVEL e com estoque entram no pedido
}

/** Edição de produto: o estoque não muda aqui (só por "Repor estoque" e pelos pedidos). */
export interface ProdutoEditarRequest {
  nome: string;
  descricao: string;
  precoVenda: number;
  precoAluguel: number;
  status: ProdutoStatus;
}
